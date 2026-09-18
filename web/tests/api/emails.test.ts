import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { staffUser } from './_rbac';
import { deleteHistoryFor, disconnectDb, prisma, siteConfig } from './_emailDb';

/**
 * /emails — identities, SMTP settings, compose send/schedule, send history,
 * cancel and the manual scheduler flush. The test server has no SMTP, so the
 * mailer's JSON transport "sends" (logs) every message and history rows end
 * up SENT.
 */
describe('emails', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  let smtpBefore: Awaited<ReturnType<typeof siteConfig>>;

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('VIEWER');
    smtpBefore = await siteConfig('smtp');
  });

  after(async () => {
    await deleteHistoryFor(TAG);
    // Put the SMTP settings back exactly as they were (row may not have existed).
    if (smtpBefore) {
      await prisma.siteConfig.update({
        where: { key: 'smtp' },
        data: { value: smtpBefore.value as any, updatedBy: smtpBefore.updatedBy },
      });
    } else {
      await prisma.siteConfig.deleteMany({ where: { key: 'smtp' } });
    }
    await viewer?.cleanup();
    await disconnectDb();
  });

  describe('auth and roles', () => {
    test('every endpoint requires a staff token', async () => {
      const calls: [string, string][] = [
        ['GET', '/emails/identities'], ['GET', '/emails/settings'], ['PUT', '/emails/settings'],
        ['POST', '/emails/settings/test'], ['POST', '/emails/send'], ['POST', '/emails/schedule'],
        ['GET', '/emails/scheduled'], ['DELETE', '/emails/scheduled/x'], ['POST', '/emails/run-scheduler'],
      ];
      for (const [method, path] of calls) {
        const res = await api(method, path, method === 'GET' || method === 'DELETE' ? undefined : {});
        assert.equal(res.status, 401, `${method} ${path} -> ${res.status}`);
      }
    });

    test('identities stay open to any staff role', async () => {
      const res = await api('GET', '/emails/identities', undefined, { token: viewer.token });
      expectStatus(res, 200);
      assert.ok(Array.isArray(res.data));
      const system = res.data.find((i: any) => i.module === 'system');
      assert.ok(system?.address && system?.name);
    });

    test('VIEWER cannot send, schedule, list, cancel, flush or touch SMTP settings', async () => {
      const t = { token: viewer.token };
      expectStatus(await api('POST', '/emails/send', { to: testEmail('v'), subject: 'x' }, t), 403);
      expectStatus(await api('POST', '/emails/schedule', { to: testEmail('v'), subject: 'x', sendAt: new Date().toISOString() }, t), 403);
      expectStatus(await api('GET', '/emails/scheduled', undefined, t), 403);
      expectStatus(await api('DELETE', '/emails/scheduled/does-not-exist', undefined, t), 403);
      expectStatus(await api('POST', '/emails/run-scheduler', {}, t), 403);
      expectStatus(await api('GET', '/emails/settings', undefined, t), 403);
      expectStatus(await api('PUT', '/emails/settings', { enabled: false }, t), 403);
      expectStatus(await api('POST', '/emails/settings/test', { to: testEmail('v') }, t), 403);
    });
  });

  describe('SMTP settings', () => {
    test('GET never returns the password', async () => {
      const res = await api('GET', '/emails/settings', undefined, { token });
      expectStatus(res, 200);
      assert.equal(typeof res.data.hasPassword, 'boolean');
      assert.equal(res.data.pass, undefined);
      assert.ok('restrictFromToAuthUser' in res.data);
    });

    test('enabling without a host is rejected', async () => {
      expectStatus(await api('PUT', '/emails/settings', { enabled: true, host: '' }, { token }), 400);
      expectStatus(await api('PUT', '/emails/settings', { enabled: false, host: 'x', port: 'abc' }, { token }), 400);
    });

    test('saves a disabled dummy config (restored afterwards)', async () => {
      const res = await api('PUT', '/emails/settings', {
        enabled: false, host: `smtp.${TAG}.invalid`, port: 2525, user: 'dummy', pass: 'dummy-not-real', fromDomain: 'example.test',
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.enabled, false);
      assert.equal(res.data.hasPassword, true);
      const get = await api('GET', '/emails/settings', undefined, { token });
      assert.equal(get.data.host, `smtp.${TAG}.invalid`);
      assert.equal(get.data.port, 2525);
      assert.equal(get.data.enabled, false);
    });

    test('test endpoint requires a recipient', async () => {
      expectStatus(await api('POST', '/emails/settings/test', {}, { token }), 400);
    });

    test('testing the saved (disabled) config reports it is not configured', async () => {
      const res = await api('POST', '/emails/settings/test', { to: testEmail('smtp') }, { token });
      expectStatus(res, 400);
      assert.match(res.data.error, /No SMTP settings/);
    });

    test('testing an unreachable draft server fails with 400, not a crash', async () => {
      const res = await api('POST', '/emails/settings/test', {
        to: testEmail('smtp'), host: '127.0.0.1', port: 9, secure: false,
      }, { token });
      expectStatus(res, 400);
      assert.ok(res.data.error);
    });
  });

  describe('send', () => {
    test('validates to/subject and module', async () => {
      expectStatus(await api('POST', '/emails/send', { subject: 'x' }, { token }), 400);
      expectStatus(await api('POST', '/emails/send', { to: testEmail('a') }, { token }), 400);
      const bad = await api('POST', '/emails/send', { to: testEmail('a'), subject: 'x', module: 'nope' }, { token });
      expectStatus(bad, 400);
      assert.match(bad.data.error, /Unknown module/);
    });

    test('sends (logged) and records a SENT history row', async () => {
      const to = testEmail('send');
      const res = await api('POST', '/emails/send', {
        module: 'candidates', to, subject: `Hello ${TAG}`, html: '<p>Hi</p>',
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.module, 'candidates');

      const hist = await api('GET', `/emails/scheduled?search=${encodeURIComponent(to)}&source=compose`, undefined, { token });
      expectStatus(hist, 200);
      assert.equal(hist.data.total, 1);
      const row = hist.data.data[0];
      assert.equal(row.status, 'SENT');
      assert.equal(row.module, 'candidates');
      assert.ok(row.sentAt);
      assert.ok(row.createdBy);
    });
  });

  describe('schedule, list, cancel, run-scheduler', () => {
    let futureId: string;
    let dueId: string;

    test('validates required fields and the date', async () => {
      expectStatus(await api('POST', '/emails/schedule', { to: testEmail('s'), subject: 'x' }, { token }), 400);
      const bad = await api('POST', '/emails/schedule', { to: testEmail('s'), subject: 'x', sendAt: 'not-a-date' }, { token });
      expectStatus(bad, 400);
      expectStatus(await api('POST', '/emails/schedule', { to: testEmail('s'), subject: 'x', sendAt: new Date().toISOString(), module: 'nope' }, { token }), 400);
    });

    test('schedules a future email as PENDING', async () => {
      const res = await api('POST', '/emails/schedule', {
        to: testEmail('future'), subject: `Later ${TAG}`, html: '<p>later</p>',
        sendAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      }, { token });
      expectStatus(res, 201);
      assert.equal(res.data.status, 'PENDING');
      assert.equal(res.data.module, 'system');
      futureId = res.data.id;
    });

    test('lists scheduled emails with filters and safe pagination', async () => {
      const res = await api('GET', `/emails/scheduled?status=PENDING&search=${TAG}&page=1&limit=10`, undefined, { token });
      expectStatus(res, 200);
      assert.ok(res.data.data.some((e: any) => e.id === futureId));
      assert.equal(res.data.page, 1);
      assert.equal(res.data.limit, 10);

      const junk = await api('GET', `/emails/scheduled?page=abc&limit=-5&search=${TAG}`, undefined, { token });
      expectStatus(junk, 200);
      assert.equal(junk.data.page, 1);
      assert.equal(junk.data.limit, 1);

      const ranged = await api('GET', `/emails/scheduled?search=${TAG}&from=${encodeURIComponent(new Date(Date.now() + 86400_000).toISOString())}`, undefined, { token });
      expectStatus(ranged, 200);
      assert.ok(ranged.data.data.every((e: any) => new Date(e.sendAt) >= new Date(Date.now())));
    });

    test('rejects an invalid status or date filter with 400', async () => {
      expectStatus(await api('GET', '/emails/scheduled?status=BOGUS', undefined, { token }), 400);
      expectStatus(await api('GET', '/emails/scheduled?from=garbage', undefined, { token }), 400);
    });

    test('cancels a pending email, and only once', async () => {
      const res = await api('DELETE', `/emails/scheduled/${futureId}`, undefined, { token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'CANCELLED');
      const again = await api('DELETE', `/emails/scheduled/${futureId}`, undefined, { token });
      expectStatus(again, 400);
      assert.match(again.data.error, /CANCELLED/);
    });

    test('cancel of an unknown id is 404', async () => {
      expectStatus(await api('DELETE', '/emails/scheduled/does-not-exist', undefined, { token }), 404);
    });

    test('run-scheduler delivers due emails (logged) and marks them SENT', async () => {
      const res = await api('POST', '/emails/schedule', {
        to: testEmail('due'), subject: `Due ${TAG}`, text: 'due now',
        sendAt: new Date(Date.now() - 60_000).toISOString(),
      }, { token });
      expectStatus(res, 201);
      dueId = res.data.id;

      const run = await api('POST', '/emails/run-scheduler', {}, { token });
      expectStatus(run, 200);
      assert.equal(typeof run.data.processed, 'number');

      const row = await prisma.scheduledEmail.findUnique({ where: { id: dueId } });
      assert.equal(row?.status, 'SENT');
      assert.equal(row?.attempts, 1);
      assert.ok(row?.sentAt);
      assert.equal(row?.error, null);

      // Only one history row for it: the scheduler must not log a duplicate.
      const count = await prisma.scheduledEmail.count({ where: { to: testEmail('due') } });
      assert.equal(count, 1);

      // A SENT email can no longer be cancelled.
      expectStatus(await api('DELETE', `/emails/scheduled/${dueId}`, undefined, { token }), 400);
    });
  });

  describe('RBAC', () => {
    test('ADMIN reads the queue and SMTP settings; MANAGER and ACCOUNTANT cannot', async () => {
      const adminRole = await staffWithRole('ADMIN');
      const manager = await staffWithRole('MANAGER');
      const accountant = await staffWithRole('ACCOUNTANT');
      try {
        const a = { token: adminRole.token };
        expectStatus(await api('GET', '/emails/scheduled', undefined, a), 200);
        expectStatus(await api('GET', '/emails/settings', undefined, a), 200);
        expectStatus(await api('GET', '/emails/templates', undefined, a), 200);
        expectStatus(await api('GET', '/emails/groups', undefined, a), 200);
        expectStatus(await api('GET', '/emails/campaigns', undefined, a), 200);
        for (const u of [manager, accountant]) {
          const t = { token: u.token };
          expectStatus(await api('GET', '/emails/identities', undefined, t), 200);
          expectStatus(await api('GET', '/emails/scheduled', undefined, t), 403);
          expectStatus(await api('GET', '/emails/settings', undefined, t), 403);
          expectStatus(await api('PUT', '/emails/settings', { enabled: false }, t), 403);
          expectStatus(await api('POST', '/emails/send', { to: testEmail('m'), subject: 'x' }, t), 403);
          expectStatus(await api('GET', '/emails/templates', undefined, t), 403);
          expectStatus(await api('GET', '/emails/groups', undefined, t), 403);
          expectStatus(await api('GET', '/emails/campaigns', undefined, t), 403);
        }
      } finally {
        await adminRole.cleanup();
        await manager.cleanup();
        await accountant.cleanup();
      }
    });

    test('an emails-view override can list the queue but not send or cancel', async () => {
      const u = await staffUser('emailsview', 'VIEWER');
      try {
        expectStatus(await api('PUT', `/users/${u.user.id}`, { permissions: { emails: ['view'] } }, { token }), 200);
        const t = { token: u.token };
        expectStatus(await api('GET', '/emails/scheduled', undefined, t), 200);
        expectStatus(await api('GET', '/emails/templates', undefined, t), 200);
        expectStatus(await api('POST', '/emails/send', { to: testEmail('o'), subject: 'x' }, t), 403);
        expectStatus(await api('DELETE', '/emails/scheduled/does-not-exist', undefined, t), 403);
        expectStatus(await api('POST', '/emails/run-scheduler', {}, t), 403);
        expectStatus(await api('GET', '/emails/settings', undefined, t), 403);
      } finally {
        await u.cleanup();
      }
    });
  });
});
