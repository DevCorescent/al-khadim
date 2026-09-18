import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, testEmail } from './_client';
import { cleanupTagged, db, otpTicket } from './_authDb';

describe('company portal flow (client-auth)', () => {
  let admin: string;
  const email = testEmail('company');
  let password = 'Comp@12345';
  let clientId: string;
  let clientUserId: string;
  let access: string;
  let refresh: string;
  const mateEmail = testEmail('mate');
  let mateId: string;
  let mateAccess: string;
  let mateRefresh: string;

  const company = () => ({
    companyName: `Test Co ${TAG}`, contactPerson: 'Owner <b>Bold</b>', email, phone: '+97140000000',
    city: 'Dubai', website: 'https://example.test', password,
  });

  before(async () => {
    admin = await adminAuth();
  });

  after(async () => {
    await cleanupTagged();
    await db.$disconnect();
  });

  test('POST /client-auth/register validates input', async () => {
    expectStatus(await api('POST', '/client-auth/register', {}), 400);
    expectStatus(await api('POST', '/client-auth/register', { ...company(), password: 'short' }), 400);
    expectStatus(await api('POST', '/client-auth/register', { ...company(), email: 'not-an-email' }), 400);
    expectStatus(await api('POST', '/client-auth/register', { ...company(), industryId: 'no-such-industry', emailVerificationTicket: 'x' }), 400);
    const noTicket = await api('POST', '/client-auth/register', company());
    expectStatus(noTicket, 400);
    assert.equal(noTicket.data.error, 'Please verify your email first');
  });

  test('otp → register creates a PENDING company whose admin is logged in', async () => {
    const ticket = await otpTicket(api, email, 'COMPANY_REGISTRATION');
    const res = await api('POST', '/client-auth/register', {
      ...company(),
      emailVerificationTicket: ticket,
      // mass-assignment attempts: ignored
      status: 'APPROVED', isActive: false, source: 'HACK', notes: 'x', approvedByUserId: 'x', tags: ['vip'],
    });
    expectStatus(res, 201);
    assert.ok(res.data.accessToken && res.data.refreshToken);
    assert.equal(res.data.clientUser.email, email);
    assert.equal(res.data.clientUser.role, 'COMPANY_ADMIN');
    assert.equal(res.data.clientUser.client.status, 'PENDING');
    clientId = res.data.clientUser.client.id;
    clientUserId = res.data.clientUser.id;
    access = res.data.accessToken;
    refresh = res.data.refreshToken;

    const client = await db.client.findUnique({ where: { id: clientId } });
    assert.equal(client!.status, 'PENDING');
    assert.equal(client!.source, 'SELF_SIGNUP');
    assert.equal(client!.isActive, true);
    assert.equal(client!.notes, null);
    assert.deepEqual(client!.tags, []);
    assert.equal(client!.country, 'UAE');

    // ticket is single-use
    expectStatus(await api('POST', '/client-auth/register', { ...company(), emailVerificationTicket: ticket }), 400);
  });

  test('POST /client-auth/login works while pending; approved-only routes are 403', async () => {
    expectStatus(await api('POST', '/client-auth/login', {}), 400);
    expectStatus(await api('POST', '/client-auth/login', { email, password: 'Wrong@12345' }), 401);
    const res = await api('POST', '/client-auth/login', { email: email.toUpperCase(), password });
    expectStatus(res, 200);
    assert.equal(res.data.clientUser.client.status, 'PENDING');
    access = res.data.accessToken;
    refresh = res.data.refreshToken;

    const me = await api('GET', '/client-auth/me', undefined, { token: access });
    expectStatus(me, 200);
    assert.equal(me.data.id, clientUserId);

    const team = await api('GET', '/client-auth/team', undefined, { token: access });
    expectStatus(team, 403);
    assert.equal(team.data.status, 'PENDING');
    expectStatus(await api('POST', '/client-auth/team/invite', { name: 'x', email: mateEmail }, { token: access }), 403);
    expectStatus(await api('PATCH', `/client-auth/team/${clientUserId}/toggle-active`, undefined, { token: access }), 403);
  });

  test('client endpoints reject missing and staff tokens', async () => {
    for (const [m, p] of [
      ['GET', '/client-auth/me'], ['POST', '/client-auth/logout'], ['PUT', '/client-auth/change-password'],
      ['GET', '/client-auth/team'], ['POST', '/client-auth/team/invite'], ['PATCH', '/client-auth/team/x/toggle-active'],
    ] as const) {
      expectStatus(await api(m, p, m === 'GET' ? undefined : {}), 401);
      expectStatus(await api(m, p, m === 'GET' ? undefined : {}, { token: admin }), 401);
    }
  });

  test('staff approves the company (PATCH /clients/:id/approve)', async () => {
    const res = await api('PATCH', `/clients/${clientId}/approve`, undefined, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'APPROVED');
  });

  test('after approval the team routes open up', async () => {
    const team = await api('GET', '/client-auth/team', undefined, { token: access });
    expectStatus(team, 200);
    assert.equal(team.data.length, 1);
    assert.equal(team.data[0].password, undefined);
  });

  test('POST /client-auth/team/invite validates and invites a teammate', async () => {
    expectStatus(await api('POST', '/client-auth/team/invite', { name: 'Mate' }, { token: access }), 400);
    expectStatus(await api('POST', '/client-auth/team/invite', { name: 'Mate', email: 'bad' }, { token: access }), 400);
    const res = await api('POST', '/client-auth/team/invite', { name: 'Mate', email: mateEmail, role: 'COMPANY_MEMBER' }, { token: access });
    expectStatus(res, 201);
    assert.deepEqual(Object.keys(res.data).sort(), ['email', 'id', 'name', 'role']);
    mateId = res.data.id;
    expectStatus(await api('POST', '/client-auth/team/invite', { name: 'Mate', email: mateEmail }, { token: access }), 409);
  });

  test('accept-invite: view, validate, accept; teammate logs in', async () => {
    const row = await db.clientUser.findUnique({ where: { id: mateId } });
    const token = row!.inviteToken!;
    assert.ok(token);

    expectStatus(await api('GET', '/client-auth/accept-invite/not-a-token'), 404);
    const view = await api('GET', `/client-auth/accept-invite/${token}`);
    expectStatus(view, 200);
    assert.deepEqual(view.data, { name: 'Mate', email: mateEmail, companyName: `Test Co ${TAG}` });

    expectStatus(await api('POST', `/client-auth/accept-invite/${token}`, { password: 'short' }), 400);
    expectStatus(await api('POST', '/client-auth/accept-invite/not-a-token', { password: 'Mate@12345' }), 404);
    const accepted = await api('POST', `/client-auth/accept-invite/${token}`, { password: 'Mate@12345' });
    expectStatus(accepted, 200);
    assert.equal(accepted.data.clientUser.role, 'COMPANY_MEMBER');
    // token is single-use
    expectStatus(await api('GET', `/client-auth/accept-invite/${token}`), 404);

    const login = await api('POST', '/client-auth/login', { email: mateEmail, password: 'Mate@12345' });
    expectStatus(login, 200);
    mateAccess = login.data.accessToken;
    mateRefresh = login.data.refreshToken;
    const team = await api('GET', '/client-auth/team', undefined, { token: mateAccess });
    expectStatus(team, 200);
    assert.equal(team.data.length, 2);
  });

  test('only a company admin can invite or toggle teammates', async () => {
    expectStatus(await api('POST', '/client-auth/team/invite', { name: 'X', email: testEmail('x') }, { token: mateAccess }), 403);
    expectStatus(await api('PATCH', `/client-auth/team/${clientUserId}/toggle-active`, undefined, { token: mateAccess }), 403);
  });

  test('PATCH /client-auth/team/:id/toggle-active', async () => {
    expectStatus(await api('PATCH', `/client-auth/team/${clientUserId}/toggle-active`, undefined, { token: access }), 400);
    expectStatus(await api('PATCH', '/client-auth/team/does-not-exist/toggle-active', undefined, { token: access }), 404);
    const off = await api('PATCH', `/client-auth/team/${mateId}/toggle-active`, undefined, { token: access });
    expectStatus(off, 200);
    assert.deepEqual(off.data, { id: mateId, isActive: false });
    // deactivated teammate: tokens, refresh and login all stop working
    expectStatus(await api('GET', '/client-auth/me', undefined, { token: mateAccess }), 401);
    expectStatus(await api('POST', '/client-auth/refresh', { refreshToken: mateRefresh }), 401);
    expectStatus(await api('POST', '/client-auth/login', { email: mateEmail, password: 'Mate@12345' }), 401);
    const on = await api('PATCH', `/client-auth/team/${mateId}/toggle-active`, undefined, { token: access });
    expectStatus(on, 200);
    assert.equal(on.data.isActive, true);
  });

  test('an invite for a deactivated teammate cannot be accepted', async () => {
    const invite = await api('POST', '/client-auth/team/invite', { name: 'Late', email: testEmail('late') }, { token: access });
    expectStatus(invite, 201);
    expectStatus(await api('PATCH', `/client-auth/team/${invite.data.id}/toggle-active`, undefined, { token: access }), 200);
    const token = (await db.clientUser.findUnique({ where: { id: invite.data.id } }))!.inviteToken!;
    expectStatus(await api('GET', `/client-auth/accept-invite/${token}`), 403);
    expectStatus(await api('POST', `/client-auth/accept-invite/${token}`, { password: 'Late@12345' }), 403);
    const row = await db.clientUser.findUnique({ where: { id: invite.data.id } });
    assert.equal(row!.password, null);
    assert.equal(row!.acceptedAt, null);
  });

  test('POST /client-auth/refresh rotates the token', async () => {
    expectStatus(await api('POST', '/client-auth/refresh', {}), 401);
    expectStatus(await api('POST', '/client-auth/refresh', { refreshToken: access }), 401);
    await new Promise((r) => setTimeout(r, 1100));
    const res = await api('POST', '/client-auth/refresh', { refreshToken: refresh });
    expectStatus(res, 200);
    assert.notEqual(res.data.refreshToken, refresh);
    expectStatus(await api('POST', '/client-auth/refresh', { refreshToken: refresh }), 401);
    refresh = res.data.refreshToken;
    access = res.data.accessToken;
  });

  test('PUT /client-auth/change-password', async () => {
    expectStatus(await api('PUT', '/client-auth/change-password', { currentPassword: password }, { token: access }), 400);
    expectStatus(await api('PUT', '/client-auth/change-password', { currentPassword: password, newPassword: 'short' }, { token: access }), 400);
    expectStatus(await api('PUT', '/client-auth/change-password', { currentPassword: 'Wrong@12345', newPassword: 'Newer@12345' }, { token: access }), 400);
    expectStatus(await api('PUT', '/client-auth/change-password', { currentPassword: password, newPassword: 'Newer@12345' }, { token: access }), 200);
    expectStatus(await api('POST', '/client-auth/login', { email, password }), 401);
    password = 'Newer@12345';
    const login = await api('POST', '/client-auth/login', { email, password });
    expectStatus(login, 200);
    access = login.data.accessToken;
    refresh = login.data.refreshToken;
  });

  test('a deactivated company cannot refresh its tokens', async () => {
    await db.client.update({ where: { id: clientId }, data: { isActive: false } });
    try {
      expectStatus(await api('POST', '/client-auth/refresh', { refreshToken: refresh }), 401);
      expectStatus(await api('GET', '/client-auth/me', undefined, { token: access }), 401);
    } finally {
      await db.client.update({ where: { id: clientId }, data: { isActive: true } });
    }
  });

  test('POST /client-auth/logout revokes the refresh token', async () => {
    expectStatus(await api('POST', '/client-auth/logout', {}, { token: access }), 200);
    expectStatus(await api('POST', '/client-auth/refresh', { refreshToken: refresh }), 401);
  });
});
