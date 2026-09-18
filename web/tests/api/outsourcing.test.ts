import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

describe('outsourcing', () => {
  let token: string;
  let employeeId: string;
  let recordId: string;
  const clientName = `Client ${TAG}`;

  // What the admin form posts: every value is a string.
  const formBody = () => ({
    employeeId, clientName, designation: 'Driver', startDate: '2026-10-01', endDate: '',
    salary: '3500', visaStatus: 'COMPANY', accommodation: '', isActive: 'true',
  });

  before(async () => {
    token = await adminAuth();
    employeeId = (await createEmployee(token)).id;
  });

  after(async () => {
    if (recordId) await api('DELETE', `/outsourcing/${recordId}`, undefined, { token });
    await purgeEmployee(employeeId);
    await db.$disconnect();
  });

  test('every endpoint requires a staff token', async () => {
    expectStatus(await api('GET', '/outsourcing'), 401);
    expectStatus(await api('POST', '/outsourcing', {}), 401);
    expectStatus(await api('PUT', '/outsourcing/x', {}), 401);
    expectStatus(await api('DELETE', '/outsourcing/x'), 401);
  });

  test('creates an assignment from form strings', async () => {
    const res = await api('POST', '/outsourcing', { ...formBody(), id: 'hijack', createdAt: '2000-01-01' }, { token });
    expectStatus(res, 201);
    recordId = res.data.id;
    assert.notEqual(res.data.id, 'hijack');
    assert.equal(res.data.salary, 3500);
    assert.equal(res.data.isActive, true);
    assert.equal(res.data.insurance, false);
    assert.equal(res.data.endDate, null);
    assert.equal(res.data.employee.id, employeeId);
  });

  test('create validation', async () => {
    const missing = await api('POST', '/outsourcing', { employeeId }, { token });
    expectStatus(missing, 400);
    assert.match(missing.data.error, /clientName/);
    expectStatus(await api('POST', '/outsourcing', { ...formBody(), salary: 'abc' }, { token }), 400);
    expectStatus(await api('POST', '/outsourcing', { ...formBody(), startDate: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/outsourcing', { ...formBody(), endDate: '2026-01-01' }, { token }), 400);
    expectStatus(await api('POST', '/outsourcing', { ...formBody(), employeeId: 'no-such-employee' }, { token }), 400);
  });

  test('lists with search and isActive filter', async () => {
    const res = await api('GET', `/outsourcing?search=${encodeURIComponent(clientName)}`, undefined, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.map((r: any) => r.id), [recordId]);
    assert.equal(res.data[0].employee.id, employeeId);
    const inactive = await api('GET', `/outsourcing?search=${encodeURIComponent(clientName)}&isActive=false`, undefined, { token });
    assert.equal(inactive.data.length, 0);
  });

  test('edit form (strings, isActive=false) updates only what was sent', async () => {
    const res = await api('PUT', `/outsourcing/${recordId}`, { ...formBody(), salary: '4000', isActive: 'false', endDate: '2026-12-31' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.salary, 4000);
    assert.equal(res.data.isActive, false);
    assert.equal(res.data.endDate.slice(0, 10), '2026-12-31');
    const partial = await api('PUT', `/outsourcing/${recordId}`, { notes: 'Renewed' }, { token });
    expectStatus(partial, 200);
    assert.equal(partial.data.notes, 'Renewed');
    assert.equal(partial.data.salary, 4000);
    assert.equal(partial.data.clientName, clientName);
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/outsourcing/${recordId}`, { salary: 'x' }, { token }), 400);
    expectStatus(await api('PUT', `/outsourcing/${recordId}`, { endDate: '2020-01-01' }, { token }), 400);
    expectStatus(await api('PUT', `/outsourcing/${recordId}`, { employeeId: 'no-such-employee' }, { token }), 400);
    expectStatus(await api('PUT', '/outsourcing/does-not-exist', { notes: 'x' }, { token }), 404);
  });

  test('deletes, then 404', async () => {
    expectStatus(await api('DELETE', `/outsourcing/${recordId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/outsourcing/${recordId}`, undefined, { token }), 404);
    recordId = '';
  });

  test('RBAC: uses the employees module (HR edits, ACCOUNTANT views, VIEWER blocked)', async () => {
    const hr = await staffWithRole('HR');
    const accountant = await staffWithRole('ACCOUNTANT');
    const viewer = await staffWithRole('VIEWER');
    let id: string | undefined;
    try {
      const res = await api('POST', '/outsourcing', { ...formBody(), clientName: `${clientName} RBAC` }, { token: hr.token });
      expectStatus(res, 201);
      id = res.data.id;
      expectStatus(await api('PUT', `/outsourcing/${id}`, { designation: 'Supervisor' }, { token: hr.token }), 200);
      expectStatus(await api('DELETE', `/outsourcing/${id}`, undefined, { token: hr.token }), 403);

      expectStatus(await api('GET', '/outsourcing', undefined, { token: accountant.token }), 200);
      expectStatus(await api('POST', '/outsourcing', formBody(), { token: accountant.token }), 403);

      expectStatus(await api('GET', '/outsourcing', undefined, { token: viewer.token }), 403);
      expectStatus(await api('PUT', `/outsourcing/${id}`, { designation: 'X' }, { token: viewer.token }), 403);
      expectStatus(await api('DELETE', `/outsourcing/${id}`, undefined, { token: viewer.token }), 403);
    } finally {
      if (id) await api('DELETE', `/outsourcing/${id}`, undefined, { token });
      await hr.cleanup();
      await accountant.cleanup();
      await viewer.cleanup();
    }
  });
});
