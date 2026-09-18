import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { createCandidate, deleteCandidate } from './_recruitment';

describe('categories', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let categoryId: string;
  let candidateId: string;

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
  });

  after(async () => {
    if (candidateId) await deleteCandidate(token, candidateId);
    if (categoryId) await api('DELETE', `/categories/${categoryId}`, undefined, { token });
    await recruiter?.cleanup();
  });

  test('GET /categories is public and returns an ordered array', async () => {
    const res = await api('GET', '/categories');
    expectStatus(res, 200);
    assert.ok(Array.isArray(res.data));
  });

  test('POST requires auth and an admin role', async () => {
    expectStatus(await api('POST', '/categories', { name: `Cat ${TAG}` }), 401);
    expectStatus(await api('POST', '/categories', { name: `Cat ${TAG}` }, { token: recruiter.token }), 403);
  });

  test('POST validates the name', async () => {
    expectStatus(await api('POST', '/categories', {}, { token }), 400);
    expectStatus(await api('POST', '/categories', { name: '   ' }, { token }), 400);
    expectStatus(await api('POST', '/categories', { name: `Cat ${TAG}`, order: 'abc' }, { token }), 400);
  });

  test('POST creates a category and ignores unknown fields', async () => {
    const res = await api('POST', '/categories', { name: `Cat ${TAG}`, order: '3', id: 'hijack', createdAt: '2000-01-01' }, { token });
    expectStatus(res, 201);
    categoryId = res.data.id;
    assert.notEqual(res.data.id, 'hijack');
    assert.equal(res.data.order, 3);
    assert.equal(res.data.color, '#6366f1');
    assert.notEqual(new Date(res.data.createdAt).getFullYear(), 2000);
  });

  test('duplicate name returns 409', async () => {
    expectStatus(await api('POST', '/categories', { name: `Cat ${TAG}` }, { token }), 409);
  });

  test('PUT only updates the fields that were sent', async () => {
    const res = await api('PUT', `/categories/${categoryId}`, { description: 'Updated' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.description, 'Updated');
    assert.equal(res.data.name, `Cat ${TAG}`);
    assert.equal(res.data.order, 3);
  });

  test('PUT role check, validation and 404', async () => {
    expectStatus(await api('PUT', `/categories/${categoryId}`, { name: 'x' }, { token: recruiter.token }), 403);
    expectStatus(await api('PUT', `/categories/${categoryId}`, { name: '' }, { token }), 400);
    expectStatus(await api('PUT', '/categories/does-not-exist', { name: `Nope ${TAG}` }, { token }), 404);
  });

  test('DELETE is blocked while a candidate uses the category', async () => {
    const c = await createCandidate(token, { categoryId });
    candidateId = c.id;
    expectStatus(await api('DELETE', `/categories/${categoryId}`, undefined, { token }), 409);
    await deleteCandidate(token, candidateId);
    candidateId = '';
  });

  test('DELETE role check, success and 404', async () => {
    expectStatus(await api('DELETE', `/categories/${categoryId}`, undefined, { token: recruiter.token }), 403);
    expectStatus(await api('DELETE', `/categories/${categoryId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/categories/${categoryId}`, undefined, { token }), 404);
    categoryId = '';
  });
});

describe('categories RBAC', () => {
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let settingsEditor: StaffUser;
  let settingsViewer: StaffUser;
  let categoryId: string;

  before(async () => {
    staff = await staffUsers('VIEWER', 'MANAGER', 'ADMIN');
    settingsEditor = await staffWithCustomRole({ settings: ['view', 'edit'] });
    settingsViewer = await staffWithCustomRole({ settings: ['view'] });
  });

  after(async () => {
    if (categoryId) await api('DELETE', `/categories/${categoryId}`, undefined, { token: await adminAuth() });
    await staff?.cleanup();
    await settingsEditor?.cleanup();
    await settingsViewer?.cleanup();
  });

  test('roles without settings edit get 403 on mutations', async () => {
    for (const token of [staff.users.VIEWER.token, staff.users.MANAGER.token, settingsViewer.token]) {
      expectStatus(await api('POST', '/categories', { name: `RBAC Cat ${TAG}` }, { token }), 403);
      expectStatus(await api('PUT', '/categories/x', { name: 'x' }, { token }), 403);
      expectStatus(await api('DELETE', '/categories/x', undefined, { token }), 403);
    }
  });

  test('ADMIN and a custom role with settings edit can manage categories', async () => {
    const res = await api('POST', '/categories', { name: `RBAC Cat ${TAG}` }, { token: settingsEditor.token });
    expectStatus(res, 201);
    categoryId = res.data.id;
    expectStatus(await api('PUT', `/categories/${categoryId}`, { description: 'Admin' }, { token: staff.users.ADMIN.token }), 200);
    expectStatus(await api('DELETE', `/categories/${categoryId}`, undefined, { token: settingsEditor.token }), 200);
    categoryId = '';
  });
});
