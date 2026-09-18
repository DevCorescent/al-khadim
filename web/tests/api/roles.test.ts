import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { cleanupTagged, db } from './_authDb';

describe('roles (custom roles)', () => {
  let admin: string;
  let adminRole: Awaited<ReturnType<typeof staffWithRole>>;
  let roleId: string;
  const name = `Role ${TAG}`;

  before(async () => {
    admin = await adminAuth();
    adminRole = await staffWithRole('ADMIN');
  });

  after(async () => {
    if (roleId) await api('DELETE', `/roles/${roleId}`, undefined, { token: admin });
    await adminRole?.cleanup();
    await cleanupTagged();
    await db.$disconnect();
  });

  test('auth: 401 without token; ADMIN can list but only SUPER_ADMIN can write', async () => {
    expectStatus(await api('GET', '/roles'), 401);
    expectStatus(await api('GET', '/roles', undefined, { token: adminRole.token }), 200);
    expectStatus(await api('POST', '/roles', { name: `${name} x` }, { token: adminRole.token }), 403);
    expectStatus(await api('PUT', '/roles/any', { name: 'x' }, { token: adminRole.token }), 403);
    expectStatus(await api('DELETE', '/roles/any', undefined, { token: adminRole.token }), 403);
  });

  test('POST /roles validates and creates', async () => {
    expectStatus(await api('POST', '/roles', {}, { token: admin }), 400);
    expectStatus(await api('POST', '/roles', { name: '   ' }, { token: admin }), 400);
    expectStatus(await api('POST', '/roles', { name: `${name} p`, permissions: 'all' }, { token: admin }), 400);
    const res = await api('POST', '/roles', {
      name, description: 'Test role', permissions: { candidates: ['view', 'edit'] },
    }, { token: admin });
    expectStatus(res, 201);
    roleId = res.data.id;
    assert.equal(res.data.color, '#6366f1');
    assert.deepEqual(res.data.permissions, { candidates: ['view', 'edit'] });
    expectStatus(await api('POST', '/roles', { name }, { token: admin }), 409);
  });

  test('GET /roles lists it', async () => {
    const res = await api('GET', '/roles', undefined, { token: admin });
    expectStatus(res, 200);
    assert.ok(res.data.some((r: any) => r.id === roleId));
  });

  test('PUT /roles/:id is partial, validates, and 404s', async () => {
    const res = await api('PUT', `/roles/${roleId}`, { color: '#ff0000' }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.color, '#ff0000');
    assert.equal(res.data.name, name);
    assert.deepEqual(res.data.permissions, { candidates: ['view', 'edit'] });
    expectStatus(await api('PUT', `/roles/${roleId}`, { name: '' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/roles/${roleId}`, { permissions: null }, { token: admin }), 400);
    expectStatus(await api('PUT', '/roles/does-not-exist', { color: '#000000' }, { token: admin }), 404);

    const other = await api('POST', '/roles', { name: `${name} other` }, { token: admin });
    expectStatus(other, 201);
    expectStatus(await api('PUT', `/roles/${other.data.id}`, { name }, { token: admin }), 409);
    expectStatus(await api('DELETE', `/roles/${other.data.id}`, undefined, { token: admin }), 200);
  });

  test('DELETE /roles/:id deletes, then 404', async () => {
    expectStatus(await api('DELETE', `/roles/${roleId}`, undefined, { token: admin }), 200);
    expectStatus(await api('DELETE', `/roles/${roleId}`, undefined, { token: admin }), 404);
    roleId = '';
  });
});
