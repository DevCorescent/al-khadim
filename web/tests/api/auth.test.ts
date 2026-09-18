import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, testEmail } from './_client';
import { cleanupTagged, db } from './_authDb';

describe('auth (staff)', () => {
  let admin: string;
  const email = testEmail('authuser');
  let password = 'Start@12345';
  let userId: string;
  let access: string;
  let refresh: string;

  before(async () => {
    admin = await adminAuth();
    const created = await api('POST', '/users', { name: 'Auth Tester', email, password, role: 'VIEWER' }, { token: admin });
    expectStatus(created, 201);
    userId = created.data.id;
  });

  after(async () => {
    if (userId) await api('DELETE', `/users/${userId}`, undefined, { token: admin });
    await cleanupTagged();
    await db.$disconnect();
  });

  test('POST /auth/login validates input with express-validator shaped errors', async () => {
    const res = await api('POST', '/auth/login', { email: 'not-an-email' });
    expectStatus(res, 400);
    assert.ok(Array.isArray(res.data.errors));
    assert.deepEqual(res.data.errors.map((e: any) => e.path).sort(), ['email', 'password']);
  });

  test('POST /auth/login rejects a wrong password and an unknown email', async () => {
    expectStatus(await api('POST', '/auth/login', { email, password: 'wrong-password' }), 401);
    expectStatus(await api('POST', '/auth/login', { email: testEmail('nobody'), password }), 401);
    // non-string password must not crash the handler
    expectStatus(await api('POST', '/auth/login', { email, password: 12345678 }), 401);
  });

  test('POST /auth/login returns tokens and the user', async () => {
    const res = await api('POST', '/auth/login', { email, password });
    expectStatus(res, 200);
    assert.ok(res.data.accessToken && res.data.refreshToken);
    assert.equal(res.data.user.email, email);
    assert.equal(res.data.user.role, 'VIEWER');
    assert.equal(res.data.user.password, undefined);
    access = res.data.accessToken;
    refresh = res.data.refreshToken;
  });

  test('GET /auth/me requires a token and returns the profile', async () => {
    expectStatus(await api('GET', '/auth/me'), 401);
    expectStatus(await api('GET', '/auth/me', undefined, { token: 'garbage' }), 401);
    const res = await api('GET', '/auth/me', undefined, { token: access });
    expectStatus(res, 200);
    assert.equal(res.data.id, userId);
    assert.equal(res.data.password, undefined);
  });

  test('POST /auth/refresh rotates the refresh token', async () => {
    expectStatus(await api('POST', '/auth/refresh', {}), 401);
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: 'garbage' }), 401);
    // JWTs issued in the same second are identical; wait so the rotated token differs.
    await new Promise((r) => setTimeout(r, 1100));
    const res = await api('POST', '/auth/refresh', { refreshToken: refresh });
    expectStatus(res, 200);
    assert.ok(res.data.accessToken);
    assert.notEqual(res.data.refreshToken, refresh);
    // the old refresh token is no longer accepted
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: refresh }), 401);
    refresh = res.data.refreshToken;
    access = res.data.accessToken;
    expectStatus(await api('GET', '/auth/me', undefined, { token: access }), 200);
  });

  test('PUT /auth/change-password validates and changes the password', async () => {
    expectStatus(await api('PUT', '/auth/change-password', { currentPassword: password, newPassword: 'New@12345' }), 401);
    const bad = await api('PUT', '/auth/change-password', { currentPassword: '', newPassword: 'short' }, { token: access });
    expectStatus(bad, 400);
    assert.deepEqual(bad.data.errors.map((e: any) => e.path).sort(), ['currentPassword', 'newPassword']);
    const wrong = await api('PUT', '/auth/change-password', { currentPassword: 'nope-nope', newPassword: 'New@12345' }, { token: access });
    expectStatus(wrong, 400);
    assert.equal(wrong.data.error, 'Current password is incorrect');

    const ok = await api('PUT', '/auth/change-password', { currentPassword: password, newPassword: 'New@12345' }, { token: access });
    expectStatus(ok, 200);
    expectStatus(await api('POST', '/auth/login', { email, password }), 401);
    password = 'New@12345';
    expectStatus(await api('POST', '/auth/login', { email, password }), 200);
  });

  test('POST /auth/logout revokes the refresh token', async () => {
    const login = await api('POST', '/auth/login', { email, password });
    expectStatus(login, 200);
    expectStatus(await api('POST', '/auth/logout'), 401);
    expectStatus(await api('POST', '/auth/logout', undefined, { token: login.data.accessToken }), 200);
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: login.data.refreshToken }), 401);
  });

  test('a deactivated user can no longer log in or refresh', async () => {
    const login = await api('POST', '/auth/login', { email, password });
    expectStatus(login, 200);
    expectStatus(await api('PUT', `/users/${userId}`, { isActive: false }, { token: admin }), 200);
    expectStatus(await api('POST', '/auth/login', { email, password }), 401);
    expectStatus(await api('POST', '/auth/refresh', { refreshToken: login.data.refreshToken }), 401);
    expectStatus(await api('GET', '/auth/me', undefined, { token: login.data.accessToken }), 401);
  });
});
