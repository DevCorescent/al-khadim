import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createEmployee, db, purgeEmployee } from './_hrdb';

// Far-future periods so only this test's data falls inside them.
const YEAR = 2097;

const REPORTS: Record<string, string[]> = {
  '/reports/overview': ['kpis', 'revenueByMonth'],
  '/reports/recruitment': ['summary', 'byStatus', 'byNationality', 'byExperience', 'bySource', 'monthlyPipeline', 'topSkills', 'jobsByStatus', 'appByStatus', 'intByStatus'],
  '/reports/revenue': ['summary', 'monthly', 'byClient', 'byStatus', 'byIndustry'],
  '/reports/hr': ['summary', 'byDepartment', 'byNationality', 'byStatus', 'leaveByType', 'leaveByStatus', 'payrollTrend'],
  '/reports/crm': ['summary', 'byIndustry', 'byCountry', 'monthlyClients', 'enquiryByService', 'followUpByType', 'jobStatus', 'pipeline'],
  '/reports/finance': ['pnl', 'cashflow', 'expensesByCategory', 'expensesMonthly', 'budgetVsActual', 'accountsSummary'],
  '/reports/placements-detail': ['summary', 'funnel', 'byClient', 'byIndustry', 'byNationality', 'monthlyPlacements', 'conversionStages', 'jobFillByClient'],
  '/reports/pipeline': ['summary', 'monthlyTrend', 'regByStatus', 'profileByStatus', 'interviewByStatus', 'interviewByType', 'publicVsPrivate', 'candidateByStatus'],
  '/reports/payroll-summary': ['totalEmployees', 'totalGross', 'totalNet', 'totalDeductions', 'payrolls'],
};

describe('reports', () => {
  let token: string;
  let employeeId: string;
  let accountId: string;

  before(async () => {
    token = await adminAuth();
    employeeId = (await createEmployee(token)).id;
    // Attendance on the last day of the month (regression for the off-by-one range).
    expectStatus(await api('POST', '/attendance', { employeeId, date: `${YEAR}-03-31`, status: 'PRESENT', hoursWorked: 8 }, { token }), 201);
    expectStatus(await api('POST', '/attendance', { employeeId, date: `${YEAR}-03-15`, status: 'ABSENT' }, { token }), 201);
    // A cash movement on the last day of the year (finance `to` is a date-only, inclusive bound in the UI).
    accountId = (await db.bankAccount.create({ data: { name: `Report Account ${TAG}` } })).id;
    await db.accountTransaction.create({
      data: { accountId, type: 'DEPOSIT', amount: 1234, date: new Date(`${YEAR}-12-31T12:00:00Z`), description: `test ${TAG}` },
    });
  });

  after(async () => {
    await purgeEmployee(employeeId);
    if (accountId) {
      await db.accountTransaction.deleteMany({ where: { accountId } });
      await db.bankAccount.deleteMany({ where: { id: accountId } });
    }
    await db.$disconnect();
  });

  test('every report requires a staff token', async () => {
    for (const path of [...Object.keys(REPORTS), '/reports/placements', '/reports/attendance-summary']) {
      expectStatus(await api('GET', path), 401);
    }
  });

  for (const [path, keys] of Object.entries(REPORTS)) {
    test(`${path} returns 200 with its top-level keys`, async () => {
      const res = await api('GET', path, undefined, { token });
      expectStatus(res, 200);
      for (const k of keys) assert.ok(k in res.data, `${path} missing ${k}`);
    });
  }

  test('/reports/placements returns an array', async () => {
    const res = await api('GET', '/reports/placements', undefined, { token });
    expectStatus(res, 200);
    assert.ok(Array.isArray(res.data));
  });

  test('/reports/attendance-summary includes the whole last day of the month (regression)', async () => {
    const res = await api('GET', `/reports/attendance-summary?month=3&year=${YEAR}`, undefined, { token });
    expectStatus(res, 200);
    assert.ok(Array.isArray(res.data));
    const mine = res.data.find((r: any) => r.employee.employeeId.includes(TAG));
    assert.ok(mine, 'employee present');
    assert.equal(mine.present, 1);
    assert.equal(mine.absent, 1);
    assert.equal(mine.totalHours, 8);
  });

  test('/reports/hr counts last-day attendance in the month', async () => {
    const res = await api('GET', `/reports/hr?month=3&year=${YEAR}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.summary.totalPresent, 1);
    assert.equal(res.data.summary.totalAbsent, 1);
    assert.equal(res.data.payrollTrend.length, 12);
  });

  test('/reports/finance treats a date-only `to` as inclusive', async () => {
    const res = await api('GET', `/reports/finance?from=${YEAR}-01-01&to=${YEAR}-12-31`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.cashflow.cashIn, 1234);
    assert.equal(res.data.cashflow.monthly.length, 12);
    assert.equal(res.data.cashflow.monthly[11].in, 1234);
  });

  test('year-scoped reports accept a year param', async () => {
    for (const path of ['/reports/overview', '/reports/recruitment', '/reports/revenue', '/reports/crm', '/reports/placements-detail', '/reports/pipeline']) {
      expectStatus(await api('GET', `${path}?year=${YEAR}`, undefined, { token }), 200);
    }
    const summary = await api('GET', `/reports/payroll-summary?month=3&year=${YEAR}`, undefined, { token });
    expectStatus(summary, 200);
    assert.equal(summary.data.totalEmployees, 0);
  });

  test('invalid year/month/date params are 400, not 500', async () => {
    expectStatus(await api('GET', '/reports/overview?year=abc', undefined, { token }), 400);
    expectStatus(await api('GET', '/reports/hr?month=13', undefined, { token }), 400);
    expectStatus(await api('GET', '/reports/attendance-summary?month=0', undefined, { token }), 400);
    expectStatus(await api('GET', '/reports/payroll-summary?year=x', undefined, { token }), 400);
    expectStatus(await api('GET', '/reports/finance?from=garbage', undefined, { token }), 400);
    expectStatus(await api('GET', `/reports/finance?from=${YEAR}-12-31&to=${YEAR}-01-01`, undefined, { token }), 400);
  });

  describe('RBAC', () => {
    let hr: Awaited<ReturnType<typeof staffWithRole>>;
    let accountant: Awaited<ReturnType<typeof staffWithRole>>;
    let viewer: Awaited<ReturnType<typeof staffWithRole>>;
    let manager: Awaited<ReturnType<typeof staffWithRole>>;

    before(async () => {
      [hr, accountant, viewer, manager] = await Promise.all(['HR', 'ACCOUNTANT', 'VIEWER', 'MANAGER'].map((r) => staffWithRole(r)));
    });
    after(async () => {
      for (const u of [hr, accountant, viewer, manager]) await u?.cleanup();
    });

    const get = (path: string, t: string) => api('GET', path, undefined, { token: t });

    test('VIEWER: overview is 200 without revenue figures; salary/finance/HR reports are 403', async () => {
      const res = await get(`/reports/overview?year=${YEAR}`, viewer.token);
      expectStatus(res, 200);
      assert.equal(res.data.kpis.totalRevenue, null);
      assert.equal(res.data.kpis.paidRevenue, null);
      assert.equal(res.data.kpis.pendingRevenue, null);
      assert.deepEqual(res.data.revenueByMonth, []);
      for (const path of ['/reports/payroll-summary', '/reports/finance', '/reports/revenue', '/reports/hr', '/reports/attendance-summary']) {
        expectStatus(await get(path, viewer.token), 403);
      }
      expectStatus(await get('/reports/recruitment', viewer.token), 200);
    });

    test('HR: payroll-summary, hr and attendance-summary allowed; finance is 403', async () => {
      expectStatus(await get(`/reports/payroll-summary?month=3&year=${YEAR}`, hr.token), 200);
      const hrReport = await get(`/reports/hr?month=3&year=${YEAR}`, hr.token);
      expectStatus(hrReport, 200);
      assert.equal(hrReport.data.payrollTrend.length, 12);
      expectStatus(await get(`/reports/attendance-summary?month=3&year=${YEAR}`, hr.token), 200);
      expectStatus(await get('/reports/finance', hr.token), 403);
      expectStatus(await get('/reports/revenue', hr.token), 403);
    });

    test('ACCOUNTANT: payroll-summary, finance and revenue allowed', async () => {
      expectStatus(await get(`/reports/payroll-summary?month=3&year=${YEAR}`, accountant.token), 200);
      expectStatus(await get(`/reports/finance?from=${YEAR}-01-01&to=${YEAR}-12-31`, accountant.token), 200);
      expectStatus(await get(`/reports/revenue?year=${YEAR}`, accountant.token), 200);
      const overview = await get(`/reports/overview?year=${YEAR}`, accountant.token);
      expectStatus(overview, 200);
      assert.equal(typeof overview.data.kpis.totalRevenue, 'number');
    });

    test('MANAGER: hr report without payroll figures; payroll-summary and finance are 403', async () => {
      const res = await get(`/reports/hr?month=3&year=${YEAR}`, manager.token);
      expectStatus(res, 200);
      assert.deepEqual(res.data.payrollTrend, []);
      assert.equal(res.data.summary.totalPresent, 1);
      expectStatus(await get('/reports/payroll-summary', manager.token), 403);
      expectStatus(await get('/reports/finance', manager.token), 403);
      // Invoices viewers see revenue.
      expectStatus(await get(`/reports/revenue?year=${YEAR}`, manager.token), 200);
    });
  });

  test('pending revenue = SENT + OVERDUE invoices (regression: used a non-existent PENDING status)', async () => {
    const Y = 2093;
    const client = await db.client.create({
      data: { companyName: `Report Client ${TAG}`, contactPerson: 'T', email: `client.${TAG}@example.test`, phone: '+971500000009' },
    });
    try {
      const at = new Date(`${Y}-04-10T12:00:00Z`);
      const amounts: Record<string, number> = { SENT: 100, OVERDUE: 20, PAID: 3000, DRAFT: 400 };
      for (const [status, totalAmount] of Object.entries(amounts)) {
        await db.invoice.create({ data: { invoiceNo: `RPT-${TAG}-${status}`, clientId: client.id, status, totalAmount, createdAt: at } });
      }
      const overview = await api('GET', `/reports/overview?year=${Y}`, undefined, { token });
      expectStatus(overview, 200);
      assert.equal(overview.data.kpis.pendingRevenue, 120);
      assert.equal(overview.data.kpis.paidRevenue, 3000);

      const revenue = await api('GET', `/reports/revenue?year=${Y}`, undefined, { token });
      expectStatus(revenue, 200);
      assert.equal(revenue.data.summary.pending, 120);
      assert.equal(revenue.data.summary.overdue, 20);
      assert.equal(revenue.data.monthly[3].pending, 120);
    } finally {
      await db.invoice.deleteMany({ where: { clientId: client.id } });
      await db.client.delete({ where: { id: client.id } });
    }
  });
});
