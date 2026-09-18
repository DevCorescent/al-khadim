import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { staffUser } from './_rbac';
import { cleanupTagged, db } from './_authDb';

const PASSWORD = 'Test@12345';

async function login(email: string, password = PASSWORD) {
  const res = await api('POST', '/auth/login', { email, password });
  expectStatus(res, 200);
  return res.data.accessToken as string;
}

describe('users', () => {
  let admin: string;
  const cleanups: Array<() => Promise<unknown>> = [];
  let manager: Awaited<ReturnType<typeof staffWithRole>>;
  let adminRole: Awaited<ReturnType<typeof staffWithRole>>;
  let userId: string;
  const userEmail = testEmail('user');

  before(async () => {
    admin = await adminAuth();
    manager = await staffWithRole('MANAGER');
    adminRole = await staffWithRole('ADMIN');
    cleanups.push(manager.cleanup, adminRole.cleanup);
  });

  after(async () => {
    for (const c of cleanups) await c().catch(() => {});
    await cleanupTagged();
    await db.$disconnect();
  });

  test('requires SUPER_ADMIN/ADMIN for every endpoint', async () => {
    expectStatus(await api('GET', '/users'), 401);
    const t = manager.token;
    expectStatus(await api('GET', '/users', undefined, { token: t }), 403);
    expectStatus(await api('GET', `/users/${manager.user.id}`, undefined, { token: t }), 403);
    expectStatus(await api('POST', '/users', { name: 'x', email: testEmail('x'), password: PASSWORD, role: 'VIEWER' }, { token: t }), 403);
    expectStatus(await api('PUT', `/users/${manager.user.id}`, { name: 'x' }, { token: t }), 403);
    expectStatus(await api('POST', `/users/${manager.user.id}/reset-password`, { newPassword: PASSWORD }, { token: t }), 403);
    expectStatus(await api('PATCH', `/users/${manager.user.id}/toggle-active`, undefined, { token: t }), 403);
    expectStatus(await api('DELETE', `/users/${manager.user.id}`, undefined, { token: t }), 403);
    // delete is SUPER_ADMIN only
    expectStatus(await api('DELETE', `/users/${manager.user.id}`, undefined, { token: adminRole.token }), 403);
  });

  test('POST /users validates input', async () => {
    const res = await api('POST', '/users', { name: '', email: 'bad', password: 'short', role: 'GOD' }, { token: admin });
    expectStatus(res, 400);
    assert.deepEqual(res.data.errors.map((e: any) => e.path).sort(), ['email', 'name', 'password', 'role']);
    const badPerms = await api('POST', '/users', {
      name: 'Bad perms', email: testEmail('badperms'), password: PASSWORD, role: 'VIEWER', permissions: '{not json',
    }, { token: admin });
    expectStatus(badPerms, 400);
  });

  test('POST /users creates a user (no password hash in the response); duplicate email is 409', async () => {
    const res = await api('POST', '/users', {
      name: 'User Tester', email: userEmail, password: PASSWORD, role: 'RECRUITER',
      department: 'QA', customRole: 'Custom QA', permissions: { candidates: ['view'] },
    }, { token: admin });
    expectStatus(res, 201);
    userId = res.data.id;
    assert.equal(res.data.password, undefined);
    assert.equal(res.data.customRole, 'Custom QA');
    assert.deepEqual(res.data.permissions, { candidates: ['view'] });
    expectStatus(await api('POST', '/users', { name: 'Dup', email: userEmail, password: PASSWORD, role: 'VIEWER' }, { token: admin }), 409);
  });

  test('ADMIN cannot create a SUPER_ADMIN', async () => {
    const res = await api('POST', '/users', { name: 'SA', email: testEmail('sa-by-admin'), password: PASSWORD, role: 'SUPER_ADMIN' }, { token: adminRole.token });
    expectStatus(res, 403);
  });

  test('GET /users lists and filters; GET /users/:id returns one or 404', async () => {
    const list = await api('GET', `/users?search=${TAG}&role=RECRUITER`, undefined, { token: admin });
    expectStatus(list, 200);
    assert.ok(list.data.some((u: any) => u.id === userId));
    assert.ok(list.data.every((u: any) => u.role === 'RECRUITER' && u.password === undefined));
    expectStatus(await api('GET', '/users?role=NOT_A_ROLE', undefined, { token: admin }), 400);
    const inactive = await api('GET', `/users?search=${TAG}&isActive=false`, undefined, { token: admin });
    expectStatus(inactive, 200);
    assert.ok(inactive.data.every((u: any) => u.isActive === false));

    const one = await api('GET', `/users/${userId}`, undefined, { token: admin });
    expectStatus(one, 200);
    assert.equal(one.data.email, userEmail);
    expectStatus(await api('GET', '/users/does-not-exist', undefined, { token: admin }), 404);
  });

  test('PUT /users/:id is a partial update (omitted customRole/permissions are kept)', async () => {
    const res = await api('PUT', `/users/${userId}`, { name: 'Renamed Tester' }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.name, 'Renamed Tester');
    assert.equal(res.data.customRole, 'Custom QA');
    assert.deepEqual(res.data.permissions, { candidates: ['view'] });
    assert.equal(res.data.department, 'QA');
    assert.equal(res.data.role, 'RECRUITER');
  });

  test('PUT /users/:id parses isActive strings properly', async () => {
    let res = await api('PUT', `/users/${userId}`, { isActive: 'false' }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, false);
    res = await api('PUT', `/users/${userId}`, { isActive: true }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, true);
    expectStatus(await api('PUT', `/users/${userId}`, { isActive: 'maybe' }, { token: admin }), 400);
  });

  test('PUT /users/:id clears customRole/permissions only when sent empty; validates role', async () => {
    const res = await api('PUT', `/users/${userId}`, { customRole: null, permissions: null, role: 'HR' }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.customRole, null);
    assert.equal(res.data.permissions, null);
    assert.equal(res.data.role, 'HR');
    expectStatus(await api('PUT', `/users/${userId}`, { role: 'GOD' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/users/${userId}`, { name: '' }, { token: admin }), 400);
    expectStatus(await api('PUT', '/users/does-not-exist', { name: 'x' }, { token: admin }), 404);
  });

  test('PUT /users/:id ignores fields outside the allow-list', async () => {
    const res = await api('PUT', `/users/${userId}`, {
      email: testEmail('hijack'), password: 'plaintext', refreshToken: 'x', lastLogin: '2020-01-01',
    }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.email, userEmail);
    await login(userEmail); // password unchanged
  });

  test('ADMIN cannot promote to or manage SUPER_ADMIN accounts', async () => {
    expectStatus(await api('PUT', `/users/${userId}`, { role: 'SUPER_ADMIN' }, { token: adminRole.token }), 403);
    // a throwaway SUPER_ADMIN is the target, never the seeded one
    const created = await api('POST', '/users', { name: 'Target SA', email: testEmail('targetsa'), password: PASSWORD, role: 'SUPER_ADMIN' }, { token: admin });
    expectStatus(created, 201);
    const id = created.data.id;
    cleanups.push(() => api('DELETE', `/users/${id}`, undefined, { token: admin }));
    expectStatus(await api('PUT', `/users/${id}`, { isActive: false }, { token: adminRole.token }), 403);
    expectStatus(await api('PUT', `/users/${id}`, { role: 'VIEWER' }, { token: adminRole.token }), 403);
    expectStatus(await api('PATCH', `/users/${id}/toggle-active`, undefined, { token: adminRole.token }), 403);
    expectStatus(await api('POST', `/users/${id}/reset-password`, { newPassword: 'Hijack@12345' }, { token: adminRole.token }), 403);
    const still = await api('GET', `/users/${id}`, undefined, { token: admin });
    assert.equal(still.data.isActive, true);
    assert.equal(still.data.role, 'SUPER_ADMIN');
    // a SUPER_ADMIN may demote another SUPER_ADMIN (one active SA always remains)
    const demoted = await api('PUT', `/users/${id}`, { role: 'ADMIN' }, { token: admin });
    expectStatus(demoted, 200);
    assert.equal(demoted.data.role, 'ADMIN');
  });

  test('self-protection: no self-deactivation, self-demotion or self-deletion', async () => {
    // A throwaway SUPER_ADMIN acts on itself, so the seeded admin is never at risk.
    const email = testEmail('selfsa');
    const created = await api('POST', '/users', { name: 'Self SA', email, password: PASSWORD, role: 'SUPER_ADMIN' }, { token: admin });
    expectStatus(created, 201);
    cleanups.push(() => api('DELETE', `/users/${created.data.id}`, undefined, { token: admin }));
    const me = await login(email);
    const id = created.data.id;

    expectStatus(await api('PUT', `/users/${id}`, { isActive: false }, { token: me }), 400);
    expectStatus(await api('PUT', `/users/${id}`, { isActive: 'false' }, { token: me }), 400);
    expectStatus(await api('PUT', `/users/${id}`, { role: 'VIEWER' }, { token: me }), 400);
    expectStatus(await api('PATCH', `/users/${id}/toggle-active`, undefined, { token: me }), 400);
    expectStatus(await api('DELETE', `/users/${id}`, undefined, { token: me }), 400);
    // editing other own fields (and re-sending the same role) is fine
    const ok = await api('PUT', `/users/${id}`, { name: 'Self SA Renamed', role: 'SUPER_ADMIN', isActive: true }, { token: me });
    expectStatus(ok, 200);
    const still = await api('GET', `/users/${id}`, undefined, { token: admin });
    assert.equal(still.data.isActive, true);
    assert.equal(still.data.role, 'SUPER_ADMIN');
  });

  test('POST /users/:id/reset-password validates, 404s and resets', async () => {
    expectStatus(await api('POST', `/users/${userId}/reset-password`, { newPassword: 'short' }, { token: admin }), 400);
    expectStatus(await api('POST', '/users/does-not-exist/reset-password', { newPassword: 'Reset@12345' }, { token: admin }), 404);
    expectStatus(await api('POST', `/users/${userId}/reset-password`, { newPassword: 'Reset@12345' }, { token: adminRole.token }), 200);
    await login(userEmail, 'Reset@12345');
  });

  test('PATCH /users/:id/toggle-active flips the flag; 404 for unknown', async () => {
    let res = await api('PATCH', `/users/${userId}/toggle-active`, undefined, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, false);
    res = await api('PATCH', `/users/${userId}/toggle-active`, undefined, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, true);
    expectStatus(await api('PATCH', '/users/does-not-exist/toggle-active', undefined, { token: admin }), 404);
  });

  test('DELETE /users/:id works even after the user logged in (audit log rows); 404 afterwards', async () => {
    // userId has logged in above, so it has LOGIN audit entries
    const res = await api('DELETE', `/users/${userId}`, undefined, { token: admin });
    expectStatus(res, 200);
    expectStatus(await api('GET', `/users/${userId}`, undefined, { token: admin }), 404);
    expectStatus(await api('DELETE', `/users/${userId}`, undefined, { token: admin }), 404);
  });

  describe('RBAC', () => {
    test('VIEWER and ACCOUNTANT presets have no user management', async () => {
      const viewer = await staffWithRole('VIEWER');
      const accountant = await staffWithRole('ACCOUNTANT');
      cleanups.push(viewer.cleanup, accountant.cleanup);
      for (const u of [viewer, accountant]) {
        expectStatus(await api('GET', '/users', undefined, { token: u.token }), 403);
        expectStatus(await api('GET', '/roles', undefined, { token: u.token }), 403);
        expectStatus(await api('POST', '/users', { name: 'x', email: testEmail('x2'), password: PASSWORD, role: 'VIEWER' }, { token: u.token }), 403);
      }
    });

    test('ADMIN creates, edits and resets users but cannot delete', async () => {
      const t = adminRole.token;
      const res = await api('POST', '/users', { name: 'By Admin', email: testEmail('byadmin'), password: PASSWORD, role: 'VIEWER' }, { token: t });
      expectStatus(res, 201);
      cleanups.push(() => api('DELETE', `/users/${res.data.id}`, undefined, { token: admin }));
      expectStatus(await api('GET', `/users/${res.data.id}`, undefined, { token: t }), 200);
      expectStatus(await api('PUT', `/users/${res.data.id}`, { name: 'Renamed' }, { token: t }), 200);
      expectStatus(await api('POST', `/users/${res.data.id}/reset-password`, { newPassword: 'Other@12345' }, { token: t }), 200);
      expectStatus(await api('PATCH', `/users/${res.data.id}/toggle-active`, undefined, { token: t }), 200);
      expectStatus(await api('DELETE', `/users/${res.data.id}`, undefined, { token: t }), 403);
    });

    test('a custom role with users view lists users and roles, nothing more; delete stays SUPER_ADMIN-only', async () => {
      const roleName = `User Auditor ${TAG}`;
      const role = await api('POST', '/roles', { name: roleName, permissions: { users: ['view', 'delete'] } }, { token: admin });
      expectStatus(role, 201);
      cleanups.push(() => api('DELETE', `/roles/${role.data.id}`, undefined, { token: admin }));
      const u = await staffUser('auditor', 'VIEWER');
      cleanups.unshift(u.cleanup); // before the role is deleted
      expectStatus(await api('PUT', `/users/${u.user.id}`, { customRole: roleName }, { token: admin }), 200);
      expectStatus(await api('GET', '/users', undefined, { token: u.token }), 200);
      expectStatus(await api('GET', '/roles', undefined, { token: u.token }), 200);
      expectStatus(await api('PUT', `/users/${u.user.id}`, { name: 'x' }, { token: u.token }), 403);
      expectStatus(await api('POST', '/roles', { name: `${roleName} x` }, { token: u.token }), 403);
      // users:delete from a custom role is not enough: deletion is SUPER_ADMIN-only.
      expectStatus(await api('DELETE', `/users/${manager.user.id}`, undefined, { token: u.token }), 403);
      // Custom role replaces the VIEWER preset entirely.
      expectStatus(await api('GET', '/clients', undefined, { token: u.token }), 403);
    });
  });
});
