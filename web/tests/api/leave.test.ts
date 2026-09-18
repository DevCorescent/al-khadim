import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, testEmail, staffWithRole } from './_client';

describe('leave', () => {
  let token: string;
  let employeeId: string;
  let leaveId: string;

  before(async () => {
    token = await adminAuth();
    const emp = await api('POST', '/employees', {
      employeeId: `EMP-${TAG}`, firstName: 'Leave', lastName: 'Tester', email: testEmail('leave'),
      phone: '+971500000000', designation: 'QA', joiningDate: '2026-01-01', basicSalary: 5000,
    }, { token });
    expectStatus(emp, 201);
    employeeId = emp.data.id;
  });

  after(async () => {
    if (leaveId) await api('DELETE', `/leave/${leaveId}`, undefined, { token });
    if (employeeId) await api('DELETE', `/employees/${employeeId}`, undefined, { token });
  });

  test('requires a staff token', async () => {
    expectStatus(await api('GET', '/leave'), 401);
    expectStatus(await api('POST', '/leave', {}), 401);
    expectStatus(await api('PUT', '/leave/x', {}), 401);
    expectStatus(await api('DELETE', '/leave/x'), 401);
  });

  test('creates a leave request', async () => {
    const res = await api('POST', '/leave', {
      employeeId, leaveType: 'ANNUAL', startDate: '2026-10-01', endDate: '2026-10-02', days: 2,
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.status, 'PENDING');
    assert.equal(res.data.days, 2);
    leaveId = res.data.id;
  });

  test('create ignores status/approval fields (mass assignment)', async () => {
    const res = await api('POST', '/leave', {
      employeeId, leaveType: 'SICK', startDate: '2026-11-01', endDate: '2026-11-01', days: '1',
      status: 'APPROVED', approvedBy: 'Mallory', approvedAt: '2026-01-01', id: 'hijack',
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.status, 'PENDING');
    assert.equal(res.data.approvedBy, null);
    assert.notEqual(res.data.id, 'hijack');
    expectStatus(await api('DELETE', `/leave/${res.data.id}`, undefined, { token }), 200);
  });

  test('create validation', async () => {
    const ok = { employeeId, leaveType: 'ANNUAL', startDate: '2026-10-01', endDate: '2026-10-02', days: 2 };
    expectStatus(await api('POST', '/leave', { employeeId }, { token }), 400);
    expectStatus(await api('POST', '/leave', { ...ok, startDate: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/leave', { ...ok, days: 'two' }, { token }), 400);
    expectStatus(await api('POST', '/leave', { ...ok, days: 0 }, { token }), 400);
    expectStatus(await api('POST', '/leave', { ...ok, endDate: '2026-09-01' }, { token }), 400);
    expectStatus(await api('POST', '/leave', { ...ok, employeeId: 'no-such-employee' }, { token }), 400);
  });

  test('lists and filters by employee', async () => {
    const res = await api('GET', `/leave?employeeId=${employeeId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].employee.id, employeeId);
    const pending = await api('GET', `/leave?employeeId=${employeeId}&status=PENDING`, undefined, { token });
    assert.equal(pending.data.length, 1);
    expectStatus(await api('GET', '/leave?status=BOGUS', undefined, { token }), 400);
  });

  test('update validates and ignores system fields', async () => {
    expectStatus(await api('PUT', `/leave/${leaveId}`, { status: 'BOGUS' }, { token }), 400);
    expectStatus(await api('PUT', `/leave/${leaveId}`, { endDate: '2026-01-01' }, { token }), 400);
    const res = await api('PUT', `/leave/${leaveId}`, { reason: 'Trip', employeeId: 'other', approvedBy: 'Mallory' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.reason, 'Trip');
    assert.equal(res.data.employeeId, employeeId);
    assert.equal(res.data.approvedBy, null);
    assert.equal(res.data.days, 2);
  });

  test('approving records who approved it', async () => {
    const res = await api('PUT', `/leave/${leaveId}`, { status: 'APPROVED' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'APPROVED');
    assert.ok(res.data.approvedBy);
    assert.ok(res.data.approvedAt);
  });

  test('unknown id returns 404', async () => {
    expectStatus(await api('PUT', '/leave/does-not-exist', { status: 'APPROVED' }, { token }), 404);
    expectStatus(await api('DELETE', '/leave/does-not-exist', undefined, { token }), 404);
  });

  test('RBAC: HR creates and rejects, MANAGER approves, ACCOUNTANT/VIEWER blocked', async () => {
    const hr = await staffWithRole('HR');
    const manager = await staffWithRole('MANAGER');
    const accountant = await staffWithRole('ACCOUNTANT');
    const viewer = await staffWithRole('VIEWER');
    const ids: string[] = [];
    const req = { employeeId, leaveType: 'ANNUAL', startDate: '2097-03-01', endDate: '2097-03-02', days: 2 };
    try {
      let res = await api('POST', '/leave', req, { token: hr.token });
      expectStatus(res, 201);
      ids.push(res.data.id);
      res = await api('PUT', `/leave/${ids[0]}`, { status: 'REJECTED' }, { token: hr.token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'REJECTED');

      res = await api('POST', '/leave', req, { token: manager.token });
      expectStatus(res, 201);
      ids.push(res.data.id);
      res = await api('PUT', `/leave/${ids[1]}`, { status: 'APPROVED' }, { token: manager.token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'APPROVED');
      assert.equal(res.data.approvedBy, 'Test MANAGER');
      expectStatus(await api('GET', `/leave?employeeId=${employeeId}`, undefined, { token: manager.token }), 200);

      for (const t of [accountant.token, viewer.token]) {
        expectStatus(await api('GET', '/leave', undefined, { token: t }), 403);
        expectStatus(await api('POST', '/leave', req, { token: t }), 403);
        expectStatus(await api('PUT', `/leave/${ids[0]}`, { status: 'APPROVED' }, { token: t }), 403);
        expectStatus(await api('PUT', `/leave/${ids[0]}`, { status: 'REJECTED' }, { token: t }), 403);
        expectStatus(await api('PUT', `/leave/${ids[0]}`, { notes: 'x' }, { token: t }), 403);
        expectStatus(await api('DELETE', `/leave/${ids[0]}`, undefined, { token: t }), 403);
      }
      expectStatus(await api('DELETE', `/leave/${ids[0]}`, undefined, { token: hr.token }), 200);
      ids.shift();
    } finally {
      for (const id of ids) await api('DELETE', `/leave/${id}`, undefined, { token });
      await hr.cleanup();
      await manager.cleanup();
      await accountant.cleanup();
      await viewer.cleanup();
    }
  });
});
