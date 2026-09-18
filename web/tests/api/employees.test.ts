import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, fetchRaw, samplePng, testEmail, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

describe('employees', () => {
  let token: string;
  const created: string[] = [];
  let photoEmployeeId: string;
  let photoPath: string;

  const base = (n: string) => ({
    employeeId: `EMP-${TAG}-${n}`, firstName: 'Emp', lastName: `Tester ${n}`, email: testEmail(`employees-${n}`),
    phone: '+971500000001', designation: 'Engineer', joiningDate: '2026-02-01', basicSalary: '6000',
  });

  before(async () => { token = await adminAuth(); });

  after(async () => {
    for (const id of created) await purgeEmployee(id);
    await db.$disconnect();
  });

  test('every endpoint requires a staff token', async () => {
    expectStatus(await api('GET', '/employees'), 401);
    expectStatus(await api('POST', '/employees', base('noauth')), 401);
    expectStatus(await api('GET', '/employees/x'), 401);
    expectStatus(await api('PUT', '/employees/x', {}), 401);
    expectStatus(await api('DELETE', '/employees/x'), 401);
  });

  test('creates an employee and converts form strings', async () => {
    const res = await api('POST', '/employees', { ...base('a'), passportExpiry: '', department: 'IT' }, { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    assert.equal(res.data.basicSalary, 6000);
    assert.equal(res.data.passportExpiry, null);
    assert.equal(res.data.status, 'ACTIVE');
    assert.equal(res.data.joiningDate.slice(0, 10), '2026-02-01');
  });

  test('ignores fields outside the allow-list (mass assignment)', async () => {
    const res = await api('POST', '/employees', {
      ...base('b'), id: `custom-${TAG}`, createdAt: '2000-01-01', photo: 'uploads/images/evil.png', unknownField: 1,
    }, { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    assert.notEqual(res.data.id, `custom-${TAG}`);
    assert.notEqual(res.data.createdAt.slice(0, 4), '2000');
    assert.equal(res.data.photo, null);
  });

  test('validates required fields, numbers, dates and status', async () => {
    const missing = await api('POST', '/employees', { firstName: 'Only' }, { token });
    expectStatus(missing, 400);
    assert.match(missing.data.error, /employeeId/);
    expectStatus(await api('POST', '/employees', { ...base('c'), basicSalary: 'lots' }, { token }), 400);
    expectStatus(await api('POST', '/employees', { ...base('c'), joiningDate: 'not-a-date' }, { token }), 400);
    expectStatus(await api('POST', '/employees', { ...base('c'), status: 'BOGUS' }, { token }), 400);
  });

  test('duplicate employee ID is a 409', async () => {
    const res = await api('POST', '/employees', { ...base('a'), email: testEmail('employees-dup') }, { token });
    expectStatus(res, 409);
  });

  test('uploads a photo (multipart) that is then served from /uploads', async () => {
    const form = new FormData();
    Object.entries(base('photo')).forEach(([k, v]) => form.append(k, String(v)));
    form.append('photo', samplePng(), 'face.png');
    const res = await api('POST', '/employees', form, { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    photoEmployeeId = res.data.id;
    photoPath = res.data.photo;
    assert.match(photoPath, /^uploads\/images\/.+\.png$/);
    const file = await fetchRaw(photoPath);
    assert.equal(file.status, 200);
    assert.ok((await file.arrayBuffer()).byteLength > 0);
  });

  test('replacing the photo stores the new one and removes the old file', async () => {
    const form = new FormData();
    form.append('photo', samplePng(), 'face2.png');
    const res = await api('PUT', `/employees/${photoEmployeeId}`, form, { token });
    expectStatus(res, 200);
    assert.notEqual(res.data.photo, photoPath);
    assert.equal((await fetchRaw(res.data.photo)).status, 200);
    assert.equal((await fetchRaw(photoPath)).status, 404);
    assert.equal(res.data.firstName, 'Emp'); // untouched
    photoPath = res.data.photo;
  });

  test('lists with search, pagination and status validation', async () => {
    const res = await api('GET', `/employees?search=${TAG}&limit=2&page=1`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.page, 1);
    assert.equal(res.data.limit, 2);
    assert.equal(res.data.data.length, 2);
    assert.ok(res.data.total >= 3);
    const page2 = await api('GET', `/employees?search=${TAG}&limit=2&page=2`, undefined, { token });
    expectStatus(page2, 200);
    assert.ok(page2.data.data.every((e: any) => !res.data.data.some((r: any) => r.id === e.id)));
    const junk = await api('GET', '/employees?page=abc&limit=-5', undefined, { token });
    expectStatus(junk, 200);
    assert.equal(junk.data.page, 1);
    assert.equal(junk.data.limit, 1);
    expectStatus(await api('GET', '/employees?status=NOPE', undefined, { token }), 400);
  });

  test('gets one employee with related records, 404 for unknown', async () => {
    const res = await api('GET', `/employees/${created[0]}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.id, created[0]);
    for (const k of ['attendances', 'leaves', 'payrolls', 'documents']) assert.ok(Array.isArray(res.data[k]), k);
    expectStatus(await api('GET', '/employees/does-not-exist', undefined, { token }), 404);
  });

  test('partial update only touches the fields sent', async () => {
    const before = await api('GET', `/employees/${created[0]}`, undefined, { token });
    const res = await api('PUT', `/employees/${created[0]}`, { designation: 'Lead', basicSalary: '7000', id: 'hijack' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.id, created[0]);
    assert.equal(res.data.designation, 'Lead');
    assert.equal(res.data.basicSalary, 7000);
    assert.equal(res.data.email, before.data.email);
    assert.equal(res.data.department, 'IT');
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/employees/${created[0]}`, { visaExpiry: 'garbage' }, { token }), 400);
    expectStatus(await api('PUT', `/employees/${created[0]}`, { joiningDate: '' }, { token }), 400);
    expectStatus(await api('PUT', '/employees/does-not-exist', { designation: 'X' }, { token }), 404);
  });

  test('delete: 409 while related records exist, then 200, then 404', async () => {
    const emp = await createEmployee(token);
    created.push(emp.id);
    const leave = await api('POST', '/leave', {
      employeeId: emp.id, leaveType: 'ANNUAL', startDate: '2026-10-01', endDate: '2026-10-01', days: 1,
    }, { token });
    expectStatus(leave, 201);
    expectStatus(await api('DELETE', `/employees/${emp.id}`, undefined, { token }), 409);
    expectStatus(await api('DELETE', `/leave/${leave.data.id}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/employees/${emp.id}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/employees/${emp.id}`, undefined, { token }), 404);
  });

  test('deleting an employee removes its photo file', async () => {
    const res = await api('DELETE', `/employees/${photoEmployeeId}`, undefined, { token });
    expectStatus(res, 200);
    const gone = await api('GET', `/employees/${photoEmployeeId}`, undefined, { token });
    expectStatus(gone, 404);
    assert.equal((await fetchRaw(photoPath)).status, 404);
  });

  test('RBAC: HR creates employees, ACCOUNTANT only views, VIEWER has no access', async () => {
    const hr = await staffWithRole('HR');
    const accountant = await staffWithRole('ACCOUNTANT');
    const viewer = await staffWithRole('VIEWER');
    try {
      const res = await api('POST', '/employees', base('rbac-hr'), { token: hr.token });
      expectStatus(res, 201);
      created.push(res.data.id);
      expectStatus(await api('PUT', `/employees/${res.data.id}`, { designation: 'Lead' }, { token: hr.token }), 200);
      // HR's preset has no employees:delete.
      expectStatus(await api('DELETE', `/employees/${res.data.id}`, undefined, { token: hr.token }), 403);

      expectStatus(await api('GET', '/employees', undefined, { token: accountant.token }), 200);
      expectStatus(await api('GET', `/employees/${res.data.id}`, undefined, { token: accountant.token }), 200);
      expectStatus(await api('POST', '/employees', base('rbac-acct'), { token: accountant.token }), 403);
      expectStatus(await api('PUT', `/employees/${res.data.id}`, { designation: 'X' }, { token: accountant.token }), 403);

      expectStatus(await api('GET', '/employees', undefined, { token: viewer.token }), 403);
      expectStatus(await api('GET', `/employees/${res.data.id}`, undefined, { token: viewer.token }), 403);
      expectStatus(await api('POST', '/employees', base('rbac-viewer'), { token: viewer.token }), 403);
      expectStatus(await api('DELETE', `/employees/${res.data.id}`, undefined, { token: viewer.token }), 403);
    } finally {
      await hr.cleanup();
      await accountant.cleanup();
      await viewer.cleanup();
    }
  });
});
