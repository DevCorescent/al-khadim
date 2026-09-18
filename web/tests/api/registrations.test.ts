import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, samplePdf, testEmail } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { cleanupTagged, db } from './_authDb';

function publicForm(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('registrations', () => {
  let admin: string;
  const email = testEmail('reg');
  let regId: string;
  let reg2Id: string;
  let reg3Id: string;

  before(async () => {
    admin = await adminAuth();
  });

  after(async () => {
    await cleanupTagged(); // the RBAC suite below disconnects the db client
  });

  test('POST /registrations/public validates required fields', async () => {
    expectStatus(await api('POST', '/registrations/public', publicForm({ firstName: 'A' })), 400);
    expectStatus(await api('POST', '/registrations/public', publicForm({ firstName: 'A', lastName: 'B', email: 'bad', phone: '1' })), 400);
  });

  test('POST /registrations/public stores only the form fields (allow-list)', async () => {
    const fd = publicForm({
      firstName: 'Reg', lastName: 'Tester', email: email.toUpperCase(), phone: '+971500000002',
      nationality: 'Filipino', experience: '3-5', skills: 'Excel, Sales',
      // not allowed from the public form
      status: 'APPROVED', password: 'x', notes: 'x', convertedTo: 'x', cvPath: 'uploads/evil.pdf', parsedData: '{"a":1}',
    });
    fd.append('cv', samplePdf('Reg CV'), 'cv.pdf');
    const res = await api('POST', '/registrations/public', fd);
    expectStatus(res, 201);
    regId = res.data.id;
    const reg = await db.candidateRegistration.findUnique({ where: { id: regId } });
    assert.equal(reg!.email, email);
    assert.equal(reg!.status, 'NEW');
    assert.equal(reg!.password, null);
    assert.equal(reg!.notes, null);
    assert.equal(reg!.convertedTo, null);
    assert.equal(reg!.parsedData, null);
    assert.match(reg!.cvPath!, /^uploads\/documents\//);
    assert.equal(reg!.skills, 'Excel, Sales');

    // JSON works too, and a duplicate email is a clean 409
    const dup = await api('POST', '/registrations/public', { firstName: 'Reg', lastName: 'Tester', email, phone: '1' });
    expectStatus(dup, 409);
  });

  test('staff endpoints need a staff token', async () => {
    expectStatus(await api('GET', '/registrations'), 401);
    expectStatus(await api('PUT', `/registrations/${regId}`, { notes: 'x' }), 401);
    expectStatus(await api('POST', `/registrations/${regId}/approve`, {}), 401);
    expectStatus(await api('POST', `/registrations/${regId}/reject`, {}), 401);
    expectStatus(await api('POST', `/registrations/${regId}/convert`, {}), 401);
  });

  test('GET /registrations lists (without password hashes) and filters by status', async () => {
    const res = await api('GET', '/registrations?status=NEW', undefined, { token: admin });
    expectStatus(res, 200);
    const mine = res.data.find((r: any) => r.id === regId);
    assert.ok(mine);
    assert.ok(res.data.every((r: any) => r.status === 'NEW'));
    assert.ok(res.data.every((r: any) => !('password' in r)));
  });

  test('PUT /registrations/:id applies the allow-list and validates', async () => {
    const res = await api('PUT', `/registrations/${regId}`, {
      notes: 'Called candidate', headline: 'Accountant',
      password: 'x', convertedTo: 'x', cvPath: 'uploads/evil.pdf', id: 'x', createdAt: '2020-01-01',
    }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.notes, 'Called candidate');
    assert.equal(res.data.headline, 'Accountant');
    assert.equal(res.data.password, undefined);
    const row = await db.candidateRegistration.findUnique({ where: { id: regId } });
    assert.equal(row!.password, null);
    assert.equal(row!.convertedTo, null);
    assert.match(row!.cvPath!, /^uploads\/documents\//);
    expectStatus(await api('PUT', `/registrations/${regId}`, { status: 'APPROVED' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/registrations/${regId}`, { email: 'bad' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/registrations/${regId}`, { firstName: '' }, { token: admin }), 400);
    expectStatus(await api('PUT', '/registrations/does-not-exist', { notes: 'x' }, { token: admin }), 404);
  });

  test('approve without a password: random temporary password that actually works', async () => {
    expectStatus(await api('POST', '/registrations/does-not-exist/approve', {}, { token: admin }), 404);
    expectStatus(await api('POST', `/registrations/${regId}/approve`, { isPublic: 'maybe' }, { token: admin }), 400);
    const res = await api('POST', `/registrations/${regId}/approve`, {}, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.message, 'Candidate approved and portal account created.');
    assert.ok(res.data.candidateId);
    const temp = res.data.temporaryPassword;
    assert.ok(temp && temp.length >= 12 && temp !== 'AlKhadim@123');

    const candidate = await db.candidate.findUnique({ where: { id: res.data.candidateId } });
    assert.equal(candidate!.isPublic, true);
    assert.equal(candidate!.experience, 3);
    assert.deepEqual(candidate!.skills, ['Excel', 'Sales']);
    const reg = await db.candidateRegistration.findUnique({ where: { id: regId } });
    assert.equal(reg!.status, 'APPROVED');
    assert.equal(reg!.convertedTo, res.data.candidateId);

    expectStatus(await api('POST', '/candidate-auth/login', { email, password: 'AlKhadim@123' }), 401);
    expectStatus(await api('POST', '/candidate-auth/login', { email, password: temp }), 200);

    // the login details were emailed (logged as a direct send)
    const mail = await db.scheduledEmail.findFirst({ where: { to: email, subject: 'Your Al Khadim candidate portal login' } });
    assert.ok(mail, 'login details email was sent');
    assert.ok(mail!.html!.includes(temp));

    expectStatus(await api('POST', `/registrations/${regId}/approve`, {}, { token: admin }), 409);
  });

  test('POST /registrations/:id/convert performs the approve action with the same response', async () => {
    const created = await api('POST', '/registrations/public', { firstName: 'Conv', lastName: 'Tester', email: testEmail('conv'), phone: '1' });
    expectStatus(created, 201);
    reg2Id = created.data.id;
    expectStatus(await api('POST', '/registrations/does-not-exist/convert', {}, { token: admin }), 404);
    const res = await api('POST', `/registrations/${reg2Id}/convert`, { isPublic: false }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.message, 'Candidate approved and portal account created.');
    assert.ok(res.data.candidateId);
    assert.ok(res.data.temporaryPassword);
    const candidate = await db.candidate.findUnique({ where: { id: res.data.candidateId } });
    assert.equal(candidate!.isPublic, false);
    expectStatus(await api('POST', `/registrations/${reg2Id}/convert`, {}, { token: admin }), 409);
  });

  test('POST /registrations/:id/reject', async () => {
    const created = await api('POST', '/registrations/public', { firstName: 'Rej', lastName: 'Tester', email: testEmail('rej'), phone: '1' });
    expectStatus(created, 201);
    reg3Id = created.data.id;
    expectStatus(await api('POST', '/registrations/does-not-exist/reject', {}, { token: admin }), 404);
    const res = await api('POST', `/registrations/${reg3Id}/reject`, { reason: 'Incomplete' }, { token: admin });
    expectStatus(res, 200);
    const row = await db.candidateRegistration.findUnique({ where: { id: reg3Id } });
    assert.equal(row!.status, 'REJECTED');
    assert.equal(row!.notes, 'Incomplete');
  });
});

describe('registrations RBAC', () => {
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  let regId: string;

  before(async () => {
    staff = await staffUsers('VIEWER', 'RECRUITER', 'HR');
    custom = await staffWithCustomRole({ candidates: ['view', 'edit'] });
    const created = await api('POST', '/registrations/public', { firstName: 'Rbac', lastName: 'Tester', email: testEmail('reg-rbac'), phone: '1' });
    expectStatus(created, 201);
    regId = created.data.id;
  });

  after(async () => {
    await staff?.cleanup();
    await custom?.cleanup();
    await cleanupTagged();
    await db.$disconnect();
  });

  test('VIEWER can list but not edit, approve, convert or reject', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', '/registrations', undefined, { token }), 200);
    expectStatus(await api('PUT', `/registrations/${regId}`, { notes: 'x' }, { token }), 403);
    expectStatus(await api('POST', `/registrations/${regId}/approve`, {}, { token }), 403);
    expectStatus(await api('POST', `/registrations/${regId}/convert`, {}, { token }), 403);
    expectStatus(await api('POST', `/registrations/${regId}/reject`, {}, { token }), 403);
  });

  test('HR has no access to registrations', async () => {
    expectStatus(await api('GET', '/registrations', undefined, { token: staff.users.HR.token }), 403);
  });

  test('RECRUITER can edit and approve', async () => {
    const token = staff.users.RECRUITER.token;
    expectStatus(await api('PUT', `/registrations/${regId}`, { notes: 'Recruiter note' }, { token }), 200);
    expectStatus(await api('POST', '/registrations/does-not-exist/approve', {}, { token }), 404);
    expectStatus(await api('POST', '/registrations/does-not-exist/convert', {}, { token }), 404);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', '/registrations', undefined, { token }), 200);
    expectStatus(await api('POST', `/registrations/${regId}/approve`, {}, { token }), 403);
    expectStatus(await api('POST', `/registrations/${regId}/reject`, { reason: 'RBAC' }, { token }), 200);
  });
});
