import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { cleanupTagged, db } from './_authDb';

describe('client-users (staff management of company portal users)', () => {
  let admin: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  let manager: Awaited<ReturnType<typeof staffWithRole>>;
  let clientId: string;
  let portalUserId: string;
  const portalEmail = testEmail('portal');

  before(async () => {
    admin = await adminAuth();
    viewer = await staffWithRole('VIEWER');
    manager = await staffWithRole('MANAGER');
    const client = await db.client.create({
      data: { companyName: `CU Co ${TAG}`, contactPerson: 'Contact', email: testEmail('cuclient'), phone: '+971400000' },
    });
    clientId = client.id;
  });

  after(async () => {
    await viewer?.cleanup();
    await manager?.cleanup();
    await cleanupTagged();
    await db.$disconnect();
  });

  test('401 without a token; VIEWER can list but not manage; MANAGER cannot delete', async () => {
    expectStatus(await api('GET', `/client-users?clientId=${clientId}`), 401);
    const t = viewer.token;
    // clients view is enough to list portal users
    expectStatus(await api('GET', `/client-users?clientId=${clientId}`, undefined, { token: t }), 200);
    expectStatus(await api('POST', '/client-users', { clientId, name: 'x', email: testEmail('x') }, { token: t }), 403);
    expectStatus(await api('PUT', '/client-users/x', { name: 'x' }, { token: t }), 403);
    expectStatus(await api('PATCH', '/client-users/x/toggle-active', undefined, { token: t }), 403);
    expectStatus(await api('POST', '/client-users/x/resend-invite', undefined, { token: t }), 403);
    expectStatus(await api('DELETE', '/client-users/x', undefined, { token: t }), 403);
    // delete needs clients delete (MANAGER has view/create/edit only)
    expectStatus(await api('DELETE', '/client-users/x', undefined, { token: manager.token }), 403);
  });

  test('POST /client-users validates, 404s for unknown client, creates an invite', async () => {
    expectStatus(await api('POST', '/client-users', { clientId }, { token: manager.token }), 400);
    expectStatus(await api('POST', '/client-users', { clientId, name: 'X', email: 'bad' }, { token: manager.token }), 400);
    expectStatus(await api('POST', '/client-users', { clientId: 'nope', name: 'X', email: testEmail('nope') }, { token: manager.token }), 404);
    const res = await api('POST', '/client-users', { clientId, name: 'Portal User', email: portalEmail.toUpperCase() }, { token: manager.token });
    expectStatus(res, 201);
    portalUserId = res.data.id;
    assert.equal(res.data.email, portalEmail);
    assert.equal(res.data.role, 'COMPANY_ADMIN');
    assert.equal(res.data.password, undefined);
    assert.equal(res.data.inviteToken, undefined, 'invite token is not leaked in the response');
    assert.equal(res.data.refreshToken, undefined);
    const row = await db.clientUser.findUnique({ where: { id: portalUserId } });
    assert.ok(row!.inviteToken);
    expectStatus(await api('POST', '/client-users', { clientId, name: 'Dup', email: portalEmail }, { token: admin }), 409);
  });

  test('GET /client-users requires clientId and lists the users', async () => {
    expectStatus(await api('GET', '/client-users', undefined, { token: manager.token }), 400);
    const res = await api('GET', `/client-users?clientId=${clientId}`, undefined, { token: manager.token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].id, portalUserId);
    assert.equal(res.data[0].inviteToken, undefined);
  });

  test('PUT /client-users/:id updates name/role, validates, 404s', async () => {
    const res = await api('PUT', `/client-users/${portalUserId}`, { name: 'Renamed', role: 'COMPANY_MEMBER', isActive: false, clientId: 'x' }, { token: manager.token });
    expectStatus(res, 200);
    assert.equal(res.data.name, 'Renamed');
    assert.equal(res.data.role, 'COMPANY_MEMBER');
    assert.equal(res.data.isActive, true);
    assert.equal(res.data.clientId, clientId);
    assert.equal(res.data.password, undefined);
    expectStatus(await api('PUT', `/client-users/${portalUserId}`, { role: 'OWNER' }, { token: manager.token }), 400);
    expectStatus(await api('PUT', '/client-users/does-not-exist', { name: 'x' }, { token: manager.token }), 404);
  });

  test('POST /client-users/:id/resend-invite rotates the token; 404; 400 once accepted', async () => {
    const before = (await db.clientUser.findUnique({ where: { id: portalUserId } }))!.inviteToken;
    const res = await api('POST', `/client-users/${portalUserId}/resend-invite`, undefined, { token: manager.token });
    expectStatus(res, 200);
    const afterTok = (await db.clientUser.findUnique({ where: { id: portalUserId } }))!.inviteToken;
    assert.notEqual(afterTok, before);
    expectStatus(await api('POST', '/client-users/does-not-exist/resend-invite', undefined, { token: manager.token }), 404);

    // accept the invite (client is APPROVED by default), then resend is refused
    expectStatus(await api('POST', `/client-auth/accept-invite/${afterTok}`, { password: 'Portal@12345' }), 200);
    expectStatus(await api('POST', `/client-users/${portalUserId}/resend-invite`, undefined, { token: manager.token }), 400);
  });

  test('PATCH /client-users/:id/toggle-active', async () => {
    const off = await api('PATCH', `/client-users/${portalUserId}/toggle-active`, undefined, { token: manager.token });
    expectStatus(off, 200);
    assert.deepEqual(off.data, { id: portalUserId, isActive: false });
    expectStatus(await api('POST', '/client-auth/login', { email: portalEmail, password: 'Portal@12345' }), 401);
    const on = await api('PATCH', `/client-users/${portalUserId}/toggle-active`, undefined, { token: manager.token });
    expectStatus(on, 200);
    assert.equal(on.data.isActive, true);
    expectStatus(await api('PATCH', '/client-users/does-not-exist/toggle-active', undefined, { token: manager.token }), 404);
  });

  test('DELETE /client-users/:id removes, then 404', async () => {
    expectStatus(await api('DELETE', `/client-users/${portalUserId}`, undefined, { token: admin }), 200);
    expectStatus(await api('DELETE', `/client-users/${portalUserId}`, undefined, { token: admin }), 404);
  });
});
