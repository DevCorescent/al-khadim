import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, TAG, adminAuth, api, expectStatus, fetchRaw, samplePdf, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

describe('documents', () => {
  let token: string;
  let employeeId: string;
  let docId: string;
  let filePath: string;
  let expiringId: string;
  const created: string[] = [];

  function form(fields: Record<string, string>, file: Blob | null = samplePdf(`Doc ${TAG}`), name = 'passport.pdf') {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.append(k, v));
    if (file) f.append('file', file, name);
    return f;
  }

  before(async () => {
    token = await adminAuth();
    employeeId = (await createEmployee(token)).id;
  });

  after(async () => {
    for (const id of created) await api('DELETE', `/documents/${id}`, undefined, { token });
    await purgeEmployee(employeeId);
    await db.$disconnect();
  });

  test('every endpoint requires a staff token', async () => {
    expectStatus(await api('GET', '/documents'), 401);
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV' })), 401);
    expectStatus(await api('GET', '/documents/x/download'), 401);
    expectStatus(await api('DELETE', '/documents/x'), 401);
    expectStatus(await api('GET', '/documents/alerts/expiring'), 401);
  });

  test('uploads a document for an employee, ignoring system fields', async () => {
    const res = await api('POST', '/documents', form({
      title: `Passport ${TAG}`, type: 'PASSPORT', employeeId, expiryDate: '', notes: 'n',
      uploadedBy: 'Mallory', filePath: '../../etc/passwd', fileSize: '1',
    }), { token });
    expectStatus(res, 201);
    docId = res.data.id;
    created.push(docId);
    filePath = res.data.filePath;
    assert.match(filePath, /^uploads\/documents\/.+\.pdf$/);
    assert.notEqual(res.data.uploadedBy, 'Mallory');
    assert.equal(res.data.mimeType, 'application/pdf');
    assert.ok(res.data.fileSize > 1);
    assert.equal(res.data.expiryDate, null);
    assert.equal(res.data.employeeId, employeeId);
  });

  test('"None" employee (empty id) is stored as no employee', async () => {
    const res = await api('POST', '/documents', form({ title: `Unlinked ${TAG}`, type: 'OTHER', employeeId: '' }), { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    assert.equal(res.data.employeeId, null);
  });

  test('upload validation', async () => {
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV' }, null), { token }), 400);
    expectStatus(await api('POST', '/documents', form({ type: 'CV' }), { token }), 400);
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'BOGUS' }), { token }), 400);
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV', expiryDate: 'soon' }), { token }), 400);
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV', employeeId: 'no-such-employee' }), { token }), 400);
    const exe = new Blob(['MZ'], { type: 'application/x-msdownload' });
    expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV' }, exe, 'evil.exe'), { token }), 400);
  });

  test('lists and filters by employee and type', async () => {
    const res = await api('GET', `/documents?employeeId=${employeeId}`, undefined, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.map((d: any) => d.id), [docId]);
    assert.equal(res.data[0].employee.id, employeeId);
    const other = await api('GET', `/documents?employeeId=${employeeId}&type=VISA`, undefined, { token });
    assert.equal(other.data.length, 0);
  });

  test('downloads with the token, named after the title plus extension', async () => {
    const res = await fetch(`${BASE_URL}/api/documents/${docId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition') || '', new RegExp(`filename="Passport ${TAG}\\.pdf"`));
    const body = Buffer.from(await res.arrayBuffer()).toString('latin1');
    assert.ok(body.startsWith('%PDF'));
    assert.ok(body.includes(`Doc ${TAG}`));
    expectStatus(await api('GET', '/documents/does-not-exist/download', undefined, { token }), 404);
  });

  test('the stored /uploads path is served', async () => {
    const res = await fetchRaw(filePath);
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).toString('latin1').startsWith('%PDF'));
  });

  test('expiring alerts include documents expiring within 30 days only', async () => {
    const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const a = await api('POST', '/documents', form({ title: `Visa soon ${TAG}`, type: 'VISA', employeeId, expiryDate: soon }), { token });
    expectStatus(a, 201);
    expiringId = a.data.id;
    created.push(expiringId);
    const b = await api('POST', '/documents', form({ title: `Visa later ${TAG}`, type: 'VISA', employeeId, expiryDate: later }), { token });
    expectStatus(b, 201);
    created.push(b.data.id);
    const res = await api('GET', '/documents/alerts/expiring', undefined, { token });
    expectStatus(res, 200);
    const ids = res.data.map((d: any) => d.id);
    assert.ok(ids.includes(expiringId));
    assert.ok(!ids.includes(b.data.id));
    assert.ok(!ids.includes(docId));
  });

  test('delete removes the record and its file, then 404', async () => {
    expectStatus(await api('DELETE', `/documents/${docId}`, undefined, { token }), 200);
    assert.equal((await fetchRaw(filePath)).status, 404);
    expectStatus(await api('GET', `/documents/${docId}/download`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/documents/${docId}`, undefined, { token }), 404);
  });

  test('RBAC: RECRUITER uploads and reads but cannot delete; VIEWER has no access', async () => {
    const recruiter = await staffWithRole('RECRUITER');
    const viewer = await staffWithRole('VIEWER');
    try {
      const res = await api('POST', '/documents', form({ title: `CV ${TAG}`, type: 'CV', employeeId }), { token: recruiter.token });
      expectStatus(res, 201);
      created.push(res.data.id);
      expectStatus(await api('GET', `/documents?employeeId=${employeeId}`, undefined, { token: recruiter.token }), 200);
      expectStatus(await api('GET', `/documents/${res.data.id}/download`, undefined, { token: recruiter.token }), 200);
      expectStatus(await api('GET', '/documents/alerts/expiring', undefined, { token: recruiter.token }), 200);
      expectStatus(await api('DELETE', `/documents/${res.data.id}`, undefined, { token: recruiter.token }), 403);

      expectStatus(await api('GET', '/documents', undefined, { token: viewer.token }), 403);
      expectStatus(await api('GET', `/documents/${res.data.id}/download`, undefined, { token: viewer.token }), 403);
      expectStatus(await api('GET', '/documents/alerts/expiring', undefined, { token: viewer.token }), 403);
      expectStatus(await api('POST', '/documents', form({ title: 'x', type: 'CV' }), { token: viewer.token }), 403);
      expectStatus(await api('DELETE', `/documents/${res.data.id}`, undefined, { token: viewer.token }), 403);
      // Still there after the refused deletes.
      assert.ok(await db.document.findUnique({ where: { id: res.data.id } }));
    } finally {
      await recruiter.cleanup();
      await viewer.cleanup();
    }
  });
});
