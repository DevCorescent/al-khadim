import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, testEmail } from './_client';
import { cleanupTagged, db } from './_authDb';

const PURPOSE = 'CANDIDATE_REGISTRATION';

describe('otp', () => {
  after(async () => {
    await cleanupTagged();
    await db.$disconnect();
  });

  test('POST /otp/send validates input', async () => {
    expectStatus(await api('POST', '/otp/send', {}), 400);
    expectStatus(await api('POST', '/otp/send', { email: testEmail('otp0') }), 400);
    expectStatus(await api('POST', '/otp/send', { email: testEmail('otp0'), purpose: 'LOGIN' }), 400);
  });

  test('POST /otp/verify validates input', async () => {
    expectStatus(await api('POST', '/otp/verify', {}), 400);
    expectStatus(await api('POST', '/otp/verify', { email: testEmail('otp0'), code: '1', purpose: 'NOPE' }), 400);
    const none = await api('POST', '/otp/verify', { email: testEmail('never-sent'), code: '111111', purpose: PURPOSE });
    expectStatus(none, 400);
    assert.match(none.data.error, /No verification code/);
  });

  test('send → devCode (SMTP not configured) → cooldown 429 → bypass code rejected → verify', async () => {
    const email = testEmail('otp1');
    const sent = await api('POST', '/otp/send', { email: email.toUpperCase(), purpose: PURPOSE });
    expectStatus(sent, 200);
    assert.equal(sent.data.expiresIn, 600);
    assert.match(sent.data.devCode, /^\d{6}$/);
    const row = await db.otpCode.findFirst({ where: { email } });
    assert.ok(row, 'email is stored normalized');
    assert.notEqual(row!.codeHash, sent.data.devCode, 'code is stored hashed');

    expectStatus(await api('POST', '/otp/send', { email, purpose: PURPOSE }), 429);

    // Regression: the 123456 bypass is off unless OTP_DEV_BYPASS=true is set explicitly.
    if (sent.data.devCode !== '123456') {
      const bypass = await api('POST', '/otp/verify', { email, code: '123456', purpose: PURPOSE });
      expectStatus(bypass, 400);
      assert.equal(bypass.data.error, 'Incorrect code');
    }

    // purpose must match
    expectStatus(await api('POST', '/otp/verify', { email, code: sent.data.devCode, purpose: 'COMPANY_REGISTRATION' }), 400);

    const ok = await api('POST', '/otp/verify', { email, code: sent.data.devCode, purpose: PURPOSE });
    expectStatus(ok, 200);
    assert.ok(ok.data.ticket);
    // a consumed code can't be reused
    expectStatus(await api('POST', '/otp/verify', { email, code: sent.data.devCode, purpose: PURPOSE }), 400);
  });

  test('too many wrong attempts lock the code', async () => {
    const email = testEmail('otp2');
    const sent = await api('POST', '/otp/send', { email, purpose: 'COMPANY_REGISTRATION' });
    expectStatus(sent, 200);
    const wrong = sent.data.devCode === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await api('POST', '/otp/verify', { email, code: wrong, purpose: 'COMPANY_REGISTRATION' });
      expectStatus(r, 400);
      assert.equal(r.data.error, 'Incorrect code');
    }
    const locked = await api('POST', '/otp/verify', { email, code: sent.data.devCode, purpose: 'COMPANY_REGISTRATION' });
    expectStatus(locked, 400);
    assert.match(locked.data.error, /Too many incorrect attempts/);
  });

  test('send refuses emails that already have an account/record (409)', async () => {
    const email = testEmail('otp3');
    const client = await db.client.create({
      data: { companyName: 'OTP Co', contactPerson: 'X', email, phone: '1' },
    });
    try {
      const res = await api('POST', '/otp/send', { email, purpose: 'COMPANY_REGISTRATION' });
      expectStatus(res, 409);
    } finally {
      await db.client.delete({ where: { id: client.id } });
    }
    const reg = await db.candidateRegistration.create({
      data: { firstName: 'A', lastName: 'B', email, phone: '1' },
    });
    try {
      expectStatus(await api('POST', '/otp/send', { email, purpose: PURPOSE }), 409);
    } finally {
      await db.candidateRegistration.delete({ where: { id: reg.id } });
    }
  });
});
