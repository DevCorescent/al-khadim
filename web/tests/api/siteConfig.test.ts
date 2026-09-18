import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, fetchRaw, samplePdf, samplePng, staffWithRole } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';

const SECTIONS = ['general', 'theme', 'navbar', 'hero', 'sections', 'footer'];

describe('site-config', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let originalTheme: any;

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
    const res = await api('GET', '/site-config/theme');
    expectStatus(res, 200);
    originalTheme = res.data;
  });

  after(async () => {
    if (originalTheme) await api('PUT', '/site-config/theme', originalTheme, { token });
    await recruiter?.cleanup();
  });

  test('GET /site-config returns exactly the public sections', async () => {
    const res = await api('GET', '/site-config');
    expectStatus(res, 200);
    assert.deepEqual(Object.keys(res.data).sort(), [...SECTIONS].sort());
    assert.ok(res.data.theme.primaryColor);
  });

  test('GET /site-config never leaks secret rows (regression)', async () => {
    const res = await api('GET', '/site-config');
    const text = JSON.stringify(res.data);
    assert.ok(!('ai' in res.data) && !('smtp' in res.data));
    assert.doesNotMatch(text, /apiKey|"pass(word)?"\s*:|sk-[A-Za-z0-9]/);
  });

  test('GET /site-config/:key serves each public section', async () => {
    for (const key of SECTIONS) {
      const res = await api('GET', `/site-config/${key}`);
      expectStatus(res, 200);
      assert.equal(typeof res.data, 'object');
    }
  });

  test('secret keys are not readable publicly or by staff (regression)', async () => {
    for (const key of ['ai', 'smtp']) {
      const res = await api('GET', `/site-config/${key}`);
      expectStatus(res, 404);
      assert.deepEqual(Object.keys(res.data), ['error']);
      expectStatus(await api('GET', `/site-config/${key}`, undefined, { token }), 404);
    }
  });

  test('unknown keys are 404 and are not created (regression)', async () => {
    const key = `unknown-${TAG}`;
    expectStatus(await api('GET', `/site-config/${key}`), 404);
    expectStatus(await api('GET', `/site-config/${key}`), 404);
    expectStatus(await api('GET', '/site-config/__proto__'), 404);
    expectStatus(await api('GET', '/site-config/constructor'), 404);
  });

  test('PUT requires an admin', async () => {
    expectStatus(await api('PUT', '/site-config/theme', { primaryColor: '#000000' }), 401);
    expectStatus(await api('PUT', '/site-config/theme', { primaryColor: '#000000' }, { token: recruiter.token }), 403);
  });

  test('PUT cannot write secret or unknown keys (regression)', async () => {
    expectStatus(await api('PUT', '/site-config/ai', { apiKey: 'x' }, { token }), 404);
    expectStatus(await api('PUT', '/site-config/smtp', { host: 'evil' }, { token }), 404);
    expectStatus(await api('PUT', `/site-config/unknown-${TAG}`, { a: 1 }, { token }), 404);
  });

  test('PUT validates the value', async () => {
    expectStatus(await api('PUT', '/site-config/theme', [1, 2], { token }), 400);
    expectStatus(await api('PUT', '/site-config/theme', 'text', { token }), 400);
  });

  test('PUT updates a section and GET reflects it', async () => {
    const value = { ...originalTheme, testMarker: TAG };
    const res = await api('PUT', '/site-config/theme', value, { token });
    expectStatus(res, 200);
    assert.equal(res.data.testMarker, TAG);
    const read = await api('GET', '/site-config/theme');
    assert.equal(read.data.testMarker, TAG);
    const all = await api('GET', '/site-config');
    assert.equal(all.data.theme.testMarker, TAG);
    // restore
    expectStatus(await api('PUT', '/site-config/theme', originalTheme, { token }), 200);
  });

  test('image upload: auth, role, validation and success', async () => {
    const fd = () => { const f = new FormData(); f.append('image', samplePng(), 'logo.png'); return f; };
    expectStatus(await api('POST', '/site-config/upload/image', fd()), 401);
    expectStatus(await api('POST', '/site-config/upload/image', fd(), { token: recruiter.token }), 403);
    expectStatus(await api('POST', '/site-config/upload/image', new FormData(), { token }), 400);
    const pdf = new FormData();
    pdf.append('image', samplePdf(), 'doc.pdf');
    expectStatus(await api('POST', '/site-config/upload/image', pdf, { token }), 400);
    const res = await api('POST', '/site-config/upload/image', fd(), { token });
    expectStatus(res, 200);
    assert.match(res.data.path, /^uploads\/images\/.+\.png$/);
    assert.ok(res.data.url.endsWith(res.data.path));
    assert.equal((await fetchRaw(res.data.path)).status, 200);
  });
});

describe('site-config RBAC', () => {
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let siteEditor: StaffUser;
  let siteViewer: StaffUser;
  let theme: any;

  before(async () => {
    staff = await staffUsers('VIEWER', 'MANAGER', 'ADMIN');
    siteEditor = await staffWithCustomRole({ site_editor: ['view', 'edit'] });
    siteViewer = await staffWithCustomRole({ site_editor: ['view'] });
    const res = await api('GET', '/site-config/theme');
    expectStatus(res, 200);
    theme = res.data;
  });

  after(async () => {
    if (theme) await api('PUT', '/site-config/theme', theme, { token: await adminAuth() }); // updatedBy back to the admin
    await staff?.cleanup();
    await siteEditor?.cleanup();
    await siteViewer?.cleanup();
  });

  test('roles without site_editor edit get 403', async () => {
    const fd = new FormData();
    fd.append('image', samplePng(), 'logo.png');
    for (const token of [staff.users.VIEWER.token, staff.users.MANAGER.token, siteViewer.token]) {
      expectStatus(await api('PUT', '/site-config/theme', theme, { token }), 403);
      expectStatus(await api('POST', '/site-config/upload/image', fd, { token }), 403);
    }
  });

  test('ADMIN and a custom role with site_editor edit can update (value unchanged)', async () => {
    expectStatus(await api('PUT', '/site-config/theme', theme, { token: staff.users.ADMIN.token }), 200);
    expectStatus(await api('PUT', '/site-config/theme', theme, { token: siteEditor.token }), 200);
    expectStatus(await api('POST', '/site-config/upload/image', new FormData(), { token: siteEditor.token }), 400);
  });
});
