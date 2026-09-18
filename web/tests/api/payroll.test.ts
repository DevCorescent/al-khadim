import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

// A far-future period nobody else uses, so counts are ours alone.
const MONTH = 2;
const YEAR = 2098;

describe('payroll', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  let accountant: Awaited<ReturnType<typeof staffWithRole>>;
  let hr: Awaited<ReturnType<typeof staffWithRole>>;
  let employeeId: string;
  let employee2Id: string;
  let payrollId: string;
  let accountId: string;

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('VIEWER');
    accountant = await staffWithRole('ACCOUNTANT');
    hr = await staffWithRole('HR');
    employeeId = (await createEmployee(token, { basicSalary: 4800 })).id;
    employee2Id = (await createEmployee(token, { basicSalary: 3000 })).id;
    // 4h overtime on the LAST day of the month (regression: the range used to stop at midnight of that day).
    expectStatus(await api('POST', '/attendance', { employeeId, date: '2098-02-28', overtime: 4, status: 'PRESENT' }, { token }), 201);
    accountId = (await db.bankAccount.create({ data: { name: `Test Account ${TAG}` } })).id;
  });

  after(async () => {
    await purgeEmployee(employeeId);
    await purgeEmployee(employee2Id);
    if (accountId) {
      await db.accountTransaction.deleteMany({ where: { accountId } });
      await db.bankAccount.deleteMany({ where: { id: accountId } });
    }
    await viewer?.cleanup();
    await accountant?.cleanup();
    await hr?.cleanup();
    await db.$disconnect();
  });

  const process = (body: any, t = token) => api('POST', '/payroll/process', body, { token: t });

  test('every endpoint requires a staff token', async () => {
    expectStatus(await api('GET', '/payroll'), 401);
    expectStatus(await api('POST', '/payroll/process', {}), 401);
    expectStatus(await api('PUT', '/payroll/x', {}), 401);
    expectStatus(await api('POST', '/payroll/x/approve'), 401);
    expectStatus(await api('PATCH', '/payroll/x/pay', {}), 401);
  });

  test('role restrictions: VIEWER has no payroll access at all', async () => {
    expectStatus(await api('GET', `/payroll?month=${MONTH}&year=${YEAR}`, undefined, { token: viewer.token }), 403);
    expectStatus(await process({ month: MONTH, year: YEAR, employeeIds: [employeeId] }, viewer.token), 403);
    expectStatus(await api('PUT', '/payroll/x', { allowances: 1 }, { token: viewer.token }), 403);
    expectStatus(await api('POST', '/payroll/x/approve', undefined, { token: viewer.token }), 403);
    expectStatus(await api('PATCH', '/payroll/x/pay', {}, { token: viewer.token }), 403);
  });

  test('role restrictions: HR can view payroll but not process, edit, approve or pay it', async () => {
    expectStatus(await api('GET', `/payroll?month=${MONTH}&year=${YEAR}`, undefined, { token: hr.token }), 200);
    expectStatus(await process({ month: MONTH, year: YEAR, employeeIds: [employeeId] }, hr.token), 403);
    expectStatus(await api('PUT', '/payroll/x', { allowances: 1 }, { token: hr.token }), 403);
    expectStatus(await api('POST', '/payroll/x/approve', undefined, { token: hr.token }), 403);
    expectStatus(await api('PATCH', '/payroll/x/pay', {}, { token: hr.token }), 403);
  });

  test('role restrictions: ACCOUNTANT passes the guards for view, edit, approve and pay', async () => {
    expectStatus(await api('GET', `/payroll?month=${MONTH}&year=${YEAR}`, undefined, { token: accountant.token }), 200);
    // Past the permission check: unknown ids give 404, not 403.
    expectStatus(await api('PUT', '/payroll/does-not-exist', { allowances: 1 }, { token: accountant.token }), 404);
    expectStatus(await api('POST', '/payroll/does-not-exist/approve', undefined, { token: accountant.token }), 404);
    expectStatus(await api('PATCH', '/payroll/does-not-exist/pay', {}, { token: accountant.token }), 404);
  });

  test('process validates month, year and employeeIds', async () => {
    expectStatus(await process({ year: YEAR }), 400);
    expectStatus(await process({ month: 13, year: YEAR }), 400);
    expectStatus(await process({ month: 0, year: YEAR }), 400);
    expectStatus(await process({ month: MONTH, year: 'abc' }), 400);
    expectStatus(await process({ month: MONTH }), 400);
    expectStatus(await process({ month: MONTH, year: YEAR, employeeIds: 'x' }), 400);
  });

  test('process creates PROCESSED payroll including last-day overtime (accountant allowed)', async () => {
    const res = await process({ month: String(MONTH), year: String(YEAR), employeeIds: [employeeId] }, accountant.token);
    expectStatus(res, 200);
    assert.equal(res.data.processed, 1);
    const p = res.data.payrolls[0];
    payrollId = p.id;
    assert.equal(p.status, 'PROCESSED');
    assert.equal(p.month, MONTH);
    assert.equal(p.year, YEAR);
    assert.equal(p.basicSalary, 4800);
    assert.equal(p.overtime, 120); // 4800 / 30 / 8 * 1.5 * 4
    assert.equal(p.grossSalary, 4920);
    assert.equal(p.netSalary, 4920);
  });

  test('lists with filters and validates them', async () => {
    const res = await api('GET', `/payroll?month=${MONTH}&year=${YEAR}&employeeId=${employeeId}`, undefined, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.map((p: any) => p.id), [payrollId]);
    assert.equal(res.data[0].employee.id, employeeId);
    const byStatus = await api('GET', `/payroll?employeeId=${employeeId}&status=PROCESSED`, undefined, { token });
    assert.equal(byStatus.data.length, 1);
    expectStatus(await api('GET', '/payroll?month=13', undefined, { token }), 400);
    expectStatus(await api('GET', '/payroll?status=NOPE', undefined, { token }), 400);
  });

  test('partial update merges with stored amounts (regression)', async () => {
    let res = await api('PUT', `/payroll/${payrollId}`, { allowances: '500' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.basicSalary, 4800);
    assert.equal(res.data.overtime, 120);
    assert.equal(res.data.grossSalary, 5420);
    assert.equal(res.data.netSalary, 5420);
    res = await api('PUT', `/payroll/${payrollId}`, { deductions: 200, status: 'PAID', employeeId: 'x' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.allowances, 500);
    assert.equal(res.data.grossSalary, 5420);
    assert.equal(res.data.netSalary, 5220);
    assert.equal(res.data.status, 'PROCESSED'); // not assignable here
    assert.equal(res.data.employeeId, employeeId);
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/payroll/${payrollId}`, { deductions: -1 }, { token }), 400);
    expectStatus(await api('PUT', `/payroll/${payrollId}`, { allowances: 'lots' }, { token }), 400);
    expectStatus(await api('PUT', '/payroll/does-not-exist', { allowances: 1 }, { token }), 404);
  });

  test('re-processing keeps entered allowances and deductions', async () => {
    const res = await process({ month: MONTH, year: YEAR, employeeIds: [employeeId] });
    expectStatus(res, 200);
    const p = res.data.payrolls[0];
    assert.equal(p.id, payrollId);
    assert.equal(p.grossSalary, 5420);
    assert.equal(p.netSalary, 5220);
  });

  test('pay rejects payroll that is not APPROVED (regression)', async () => {
    const res = await process({ month: MONTH, year: YEAR, employeeIds: [employee2Id] });
    expectStatus(res, 200);
    const id = res.data.payrolls[0].id;
    const pay = await api('PATCH', `/payroll/${id}/pay`, { accountId }, { token });
    expectStatus(pay, 400);
    assert.match(pay.data.error, /approved/i);
    expectStatus(await api('PATCH', `/payroll/${payrollId}/pay`, {}, { token }), 400); // still PROCESSED
    assert.equal((await db.payroll.findUnique({ where: { id } })).status, 'PROCESSED');
    assert.equal(await db.accountTransaction.count({ where: { relatedPayrollId: id } }), 0);
  });

  test('approve: 404 for unknown, then APPROVED (accountant allowed)', async () => {
    expectStatus(await api('POST', '/payroll/does-not-exist/approve', undefined, { token }), 404);
    const res = await api('POST', `/payroll/${payrollId}/approve`, undefined, { token: accountant.token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'APPROVED');
  });

  test('pay: 404 for unknown, 400 for unknown account', async () => {
    expectStatus(await api('PATCH', '/payroll/does-not-exist/pay', {}, { token }), 404);
    expectStatus(await api('PATCH', `/payroll/${payrollId}/pay`, { accountId: 'no-such-account' }, { token }), 400);
  });

  test('pay marks PAID and posts one account transaction', async () => {
    const res = await api('PATCH', `/payroll/${payrollId}/pay`, { accountId, paymentMethod: 'BANK_TRANSFER' }, { token: accountant.token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'PAID');
    assert.equal(res.data.paymentMethod, 'BANK_TRANSFER');
    assert.ok(res.data.paymentDate);
    const txns = await db.accountTransaction.findMany({ where: { relatedPayrollId: payrollId } });
    assert.equal(txns.length, 1);
    assert.equal(txns[0].amount, -5220);
    assert.equal(txns[0].accountId, accountId);
  });

  test('paid payroll is locked: pay, approve, edit and re-process leave it alone', async () => {
    expectStatus(await api('PATCH', `/payroll/${payrollId}/pay`, { accountId }, { token }), 400);
    expectStatus(await api('POST', `/payroll/${payrollId}/approve`, undefined, { token }), 400);
    expectStatus(await api('PUT', `/payroll/${payrollId}`, { allowances: 1 }, { token }), 400);
    const res = await process({ month: MONTH, year: YEAR, employeeIds: [employeeId] });
    expectStatus(res, 200);
    assert.equal(res.data.processed, 0);
    const row = await db.payroll.findUnique({ where: { id: payrollId } });
    assert.equal(row.status, 'PAID');
    assert.equal(row.netSalary, 5220);
    assert.equal(await db.accountTransaction.count({ where: { relatedPayrollId: payrollId } }), 1);
  });
});
