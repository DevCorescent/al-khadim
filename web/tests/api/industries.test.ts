import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';

describe('industries', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let industryId: string;
  let industryKey: string;

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
  });

  after(async () => {
    if (industryId) await api('DELETE', `/industries/${industryId}`, undefined, { token });
    await recruiter?.cleanup();
  });

  test('GET /industries is public and filters by hasTracking', async () => {
    const all = await api('GET', '/industries');
    expectStatus(all, 200);
    assert.ok(Array.isArray(all.data));
    const tracked = await api('GET', '/industries?hasTracking=true');
    expectStatus(tracked, 200);
    assert.ok(tracked.data.every((i: any) => i.hasTracking === true));
    assert.ok(all.data.every((i: any) => !('trackingSections' in i)), 'list must not include templates');
  });

  test('POST requires auth and an admin role', async () => {
    expectStatus(await api('POST', '/industries', { name: `Ind ${TAG}` }), 401);
    expectStatus(await api('POST', '/industries', { name: `Ind ${TAG}` }, { token: recruiter.token }), 403);
  });

  test('POST validates name and tracking template', async () => {
    expectStatus(await api('POST', '/industries', {}, { token }), 400);
    expectStatus(await api('POST', '/industries', { name: `Ind ${TAG}`, hasTracking: true, trackingSections: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/industries', {
      name: `Ind ${TAG}`, hasTracking: true, trackingSections: [{ key: 's', label: 'S', fields: [{ label: 'no key' }] }],
    }, { token }), 400);
  });

  test('POST creates an industry with a generated key and ignores `key`', async () => {
    const res = await api('POST', '/industries', {
      name: `Ind ${TAG}`, key: 'HIJACK', hasTracking: true,
      trackingSections: [{ key: 's1', label: 'Section', fields: [{ key: 'c', label: 'Check', type: 'checklist' }] }],
    }, { token });
    expectStatus(res, 201);
    industryId = res.data.id;
    industryKey = res.data.key;
    assert.equal(industryKey, `IND_${TAG.toUpperCase()}`);
    assert.equal(res.data.hasTracking, true);
    // a checklist without items is normalised so the CSV tools never crash
    assert.deepEqual(res.data.trackingSections[0].fields[0].items, []);
  });

  test('GET /industries/:id requires staff and returns the template', async () => {
    expectStatus(await api('GET', `/industries/${industryId}`), 401);
    const res = await api('GET', `/industries/${industryId}`, undefined, { token: recruiter.token });
    expectStatus(res, 200);
    assert.equal(res.data.trackingSections.length, 1);
    expectStatus(await api('GET', '/industries/does-not-exist', undefined, { token }), 404);
  });

  test('sample CSV works for a normalised template', async () => {
    const res = await api('GET', `/candidate-tracking/sample-csv?industry=${industryKey}`, undefined, { token });
    expectStatus(res, 200);
    assert.match(String(res.data), /^Section,Field,Item,Value/);
  });

  test('PUT updates only sent fields; key is immutable', async () => {
    const res = await api('PUT', `/industries/${industryId}`, { description: 'Desc', key: 'CHANGED', order: '7' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.description, 'Desc');
    assert.equal(res.data.key, industryKey);
    assert.equal(res.data.order, 7);
    assert.equal(res.data.name, `Ind ${TAG}`);
    assert.equal(res.data.hasTracking, true);
  });

  test('PUT role check, validation and 404', async () => {
    expectStatus(await api('PUT', `/industries/${industryId}`, { name: 'x' }, { token: recruiter.token }), 403);
    expectStatus(await api('PUT', `/industries/${industryId}`, { trackingSections: { a: 1 } }, { token }), 400);
    expectStatus(await api('PUT', `/industries/${industryId}`, { order: 'abc' }, { token }), 400);
    expectStatus(await api('PUT', '/industries/does-not-exist', { name: 'x' }, { token }), 404);
  });

  test('DELETE role check, success and 404', async () => {
    expectStatus(await api('DELETE', `/industries/${industryId}`, undefined, { token: recruiter.token }), 403);
    expectStatus(await api('DELETE', `/industries/${industryId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/industries/${industryId}`, undefined, { token }), 404);
    industryId = '';
  });
});

describe('industries RBAC', () => {
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let settingsEditor: StaffUser;
  let settingsViewer: StaffUser;
  let industryId: string;

  before(async () => {
    staff = await staffUsers('VIEWER', 'HR', 'MANAGER', 'ADMIN');
    settingsEditor = await staffWithCustomRole({ settings: ['view', 'edit'] });
    settingsViewer = await staffWithCustomRole({ settings: ['view'] });
  });

  after(async () => {
    if (industryId) await api('DELETE', `/industries/${industryId}`, undefined, { token: await adminAuth() });
    await staff?.cleanup();
    await settingsEditor?.cleanup();
    await settingsViewer?.cleanup();
  });

  test('roles without settings edit get 403 on mutations', async () => {
    for (const token of [staff.users.VIEWER.token, staff.users.MANAGER.token, settingsViewer.token]) {
      expectStatus(await api('POST', '/industries', { name: `RBAC Ind ${TAG}` }, { token }), 403);
      expectStatus(await api('PUT', '/industries/x', { name: 'x' }, { token }), 403);
      expectStatus(await api('DELETE', '/industries/x', undefined, { token }), 403);
    }
  });

  test('a custom role with settings edit and ADMIN can manage industries; any staff can read one', async () => {
    const res = await api('POST', '/industries', { name: `RBAC Ind ${TAG}` }, { token: settingsEditor.token });
    expectStatus(res, 201);
    industryId = res.data.id;
    expectStatus(await api('PUT', `/industries/${industryId}`, { description: 'Admin' }, { token: staff.users.ADMIN.token }), 200);
    for (const token of [staff.users.VIEWER.token, staff.users.HR.token, settingsViewer.token]) {
      expectStatus(await api('GET', `/industries/${industryId}`, undefined, { token }), 200);
    }
    expectStatus(await api('DELETE', `/industries/${industryId}`, undefined, { token: staff.users.ADMIN.token }), 200);
    industryId = '';
  });
});
