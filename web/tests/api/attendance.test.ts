import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

describe('attendance', () => {
  let token: string;
  let employeeId: string;
  let otherEmployeeId: string;
  let recordId: string;

  before(async () => {
    token = await adminAuth();
    employeeId = (await createEmployee(token)).id;
    otherEmployeeId = (await createEmployee(token)).id;
  });

  after(async () => {
    await purgeEmployee(employeeId);
    await purgeEmployee(otherEmployeeId);
    await db.$disconnect();
  });

  test('every endpoint requires a staff token', async () => {
    expectStatus(await api('GET', '/attendance'), 401);
    expectStatus(await api('POST', '/attendance', {}), 401);
    expectStatus(await api('PUT', '/attendance/x', {}), 401);
    expectStatus(await api('POST', '/attendance/bulk', { records: [] }), 401);
  });

  test('creates a record from the admin form (HH:MM times, blank numbers)', async () => {
    const res = await api('POST', '/attendance', {
      employeeId, date: '2026-10-31', checkIn: '09:00', checkOut: '17:30',
      hoursWorked: '', overtime: '2', status: 'PRESENT', notes: '',
    }, { token });
    expectStatus(res, 201);
    recordId = res.data.id;
    assert.equal(res.data.date.slice(0, 10), '2026-10-31');
    assert.ok(res.data.checkIn, 'checkIn stored');
    assert.ok(new Date(res.data.checkOut) > new Date(res.data.checkIn));
    assert.equal(res.data.hoursWorked, null);
    assert.equal(res.data.overtime, 2);
  });

  test('posting the same employee+date upserts and ignores unknown fields', async () => {
    const res = await api('POST', '/attendance', {
      employeeId, date: '2026-10-31', hoursWorked: 8, id: 'hijack', createdAt: '2000-01-01',
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.id, recordId);
    assert.equal(res.data.hoursWorked, 8);
    assert.equal(res.data.overtime, 2);
  });

  test('create validation', async () => {
    expectStatus(await api('POST', '/attendance', { employeeId }, { token }), 400);
    expectStatus(await api('POST', '/attendance', { employeeId, date: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/attendance', { date: '2026-10-01' }, { token }), 400);
    expectStatus(await api('POST', '/attendance', { employeeId, date: '2026-10-01', hoursWorked: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/attendance', { employeeId: 'no-such-employee', date: '2026-10-01' }, { token }), 400);
  });

  test('month filter includes the last day of the month (regression)', async () => {
    const res = await api('GET', `/attendance?month=10&year=2026&employeeId=${employeeId}`, undefined, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.map((r: any) => r.id), [recordId]);
    assert.equal(res.data[0].employee.id, employeeId);
    const nov = await api('GET', `/attendance?month=11&year=2026&employeeId=${employeeId}`, undefined, { token });
    assert.equal(nov.data.length, 0);
    expectStatus(await api('GET', '/attendance?month=13&year=2026', undefined, { token }), 400);
  });

  test('updates only the sent fields, validates, 404 for unknown', async () => {
    const res = await api('PUT', `/attendance/${recordId}`, { hoursWorked: '7.5', employeeId: otherEmployeeId }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.hoursWorked, 7.5);
    assert.equal(res.data.employeeId, employeeId);
    assert.equal(res.data.overtime, 2);
    expectStatus(await api('PUT', `/attendance/${recordId}`, { checkIn: 'soon' }, { token }), 400);
    expectStatus(await api('PUT', '/attendance/does-not-exist', { hoursWorked: 1 }, { token }), 404);
  });

  test('bulk: missing / non-array / empty records are 400, not 500 (regression)', async () => {
    expectStatus(await api('POST', '/attendance/bulk', {}, { token }), 400);
    expectStatus(await api('POST', '/attendance/bulk', { records: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/attendance/bulk', { records: [] }, { token }), 400);
  });

  test('bulk: invalid rows are rejected with their index and nothing is written', async () => {
    const res = await api('POST', '/attendance/bulk', {
      records: [
        { employeeId: otherEmployeeId, date: '2026-09-01' },
        { employeeId: otherEmployeeId, date: 'bad-date' },
      ],
    }, { token });
    expectStatus(res, 400);
    assert.match(res.data.error, /records\[1\]/);
    expectStatus(await api('POST', '/attendance/bulk', { records: [{ employeeId: 'nope', date: '2026-09-01' }] }, { token }), 400);
    assert.equal(await db.attendance.count({ where: { employeeId: otherEmployeeId } }), 0);
  });

  test('bulk: imports valid rows in one transaction', async () => {
    const res = await api('POST', '/attendance/bulk', {
      records: [
        { employeeId: otherEmployeeId, date: '2026-09-01', status: 'PRESENT', hoursWorked: '8' },
        { employeeId: otherEmployeeId, date: '2026-09-30', status: 'ABSENT' },
      ],
    }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.imported, 2);
    const list = await api('GET', `/attendance?month=9&year=2026&employeeId=${otherEmployeeId}`, undefined, { token });
    assert.equal(list.data.length, 2);
  });

  test('RBAC: HR records attendance, MANAGER only views, VIEWER blocked', async () => {
    const hr = await staffWithRole('HR');
    const manager = await staffWithRole('MANAGER');
    const viewer = await staffWithRole('VIEWER');
    try {
      const res = await api('POST', '/attendance', { employeeId: otherEmployeeId, date: '2097-05-10', status: 'PRESENT' }, { token: hr.token });
      expectStatus(res, 201);
      expectStatus(await api('PUT', `/attendance/${res.data.id}`, { hoursWorked: 6 }, { token: hr.token }), 200);
      const bulk = await api('POST', '/attendance/bulk', { records: [{ employeeId: otherEmployeeId, date: '2097-05-11', status: 'PRESENT' }] }, { token: hr.token });
      expectStatus(bulk, 200);

      expectStatus(await api('GET', `/attendance?employeeId=${otherEmployeeId}`, undefined, { token: manager.token }), 200);
      expectStatus(await api('POST', '/attendance', { employeeId: otherEmployeeId, date: '2097-05-12', status: 'PRESENT' }, { token: manager.token }), 403);
      expectStatus(await api('PUT', `/attendance/${res.data.id}`, { hoursWorked: 1 }, { token: manager.token }), 403);
      expectStatus(await api('POST', '/attendance/bulk', { records: [] }, { token: manager.token }), 403);

      expectStatus(await api('GET', '/attendance', undefined, { token: viewer.token }), 403);
    } finally {
      await hr.cleanup();
      await manager.cleanup();
      await viewer.cleanup();
    }
  });
});
