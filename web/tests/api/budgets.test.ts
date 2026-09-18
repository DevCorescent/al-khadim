import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { db, purgeExpense } from './_crmdb';

// A year nobody else uses, so budgets/expenses for it are only this file's.
const YEAR = 2093;

describe('budgets', () => {
  let token: string;
  const budgetIds = new Set<string>();
  const expenseIds: string[] = [];
  let monthlyId: string;

  before(async () => {
    token = await adminAuth();
  });

  after(async () => {
    for (const id of budgetIds) await api('DELETE', `/budgets/${id}`, undefined, { token });
    await db.budget.deleteMany({ where: { id: { in: [...budgetIds] } } });
    for (const id of expenseIds) await purgeExpense(id);
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/budgets'), 401);
    expectStatus(await api('GET', '/budgets/vs-actual'), 401);
    expectStatus(await api('POST', '/budgets', {}), 401);
    expectStatus(await api('PUT', '/budgets/x', {}), 401);
    expectStatus(await api('DELETE', '/budgets/x'), 401);
  });

  test('create validates input', async () => {
    const ok = { category: 'RENT', year: YEAR, period: 'MONTHLY', month: 1, amount: 100 };
    expectStatus(await api('POST', '/budgets', { ...ok, amount: undefined }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, year: undefined }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, category: 'FOOD' }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, period: 'WEEKLY' }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, month: 13 }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, month: undefined }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, period: 'QUARTERLY', quarter: 5 }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, amount: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, amount: -1 }, { token }), 400);
    expectStatus(await api('POST', '/budgets', { ...ok, year: 'abc' }, { token }), 400);
  });

  test('creates, then upserts the same category+period', async () => {
    const res = await api('POST', '/budgets', { category: 'RENT', year: YEAR, period: 'MONTHLY', month: 2, amount: 1000, notes: TAG, createdBy: 'x' }, { token });
    expectStatus(res, 201);
    monthlyId = res.data.id;
    budgetIds.add(monthlyId);
    assert.equal(res.data.quarter, null);
    assert.notEqual(res.data.createdBy, 'x');
    const again = await api('POST', '/budgets', { category: 'RENT', year: YEAR, period: 'MONTHLY', month: 2, amount: 1200 }, { token });
    expectStatus(again, 200);
    assert.equal(again.data.id, monthlyId);
    assert.equal(again.data.amount, 1200);
    assert.equal(again.data.notes, TAG);
    const yearly = await api('POST', '/budgets', { category: 'MARKETING', year: YEAR, period: 'YEARLY', month: 3, amount: 50 }, { token });
    expectStatus(yearly, 201);
    budgetIds.add(yearly.data.id);
    assert.equal(yearly.data.month, null, 'a YEARLY budget has no month');
  });

  test('lists with period filters', async () => {
    const res = await api('GET', `/budgets?year=${YEAR}&period=MONTHLY&month=2`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].id, monthlyId);
    const all = await api('GET', `/budgets?year=${YEAR}`, undefined, { token });
    assert.equal(all.data.length, 2);
    expectStatus(await api('GET', '/budgets?year=abc', undefined, { token }), 400);
    expectStatus(await api('GET', '/budgets?period=WEEKLY', undefined, { token }), 400);
  });

  test('vs-actual counts non-draft expenses in the period', async () => {
    const mk = async (amount: number, date: string) => {
      const r = await api('POST', '/expenses', { category: 'RENT', description: `Rent ${TAG}`, amount, date }, { token });
      expectStatus(r, 201);
      expenseIds.push(r.data.id);
      return r.data.id;
    };
    const counted = await mk(300, `${YEAR}-02-10`);
    expectStatus(await api('PUT', `/expenses/${counted}`, { status: 'PENDING_APPROVAL' }, { token }), 200);
    await mk(999, `${YEAR}-02-11`); // DRAFT: ignored
    const res = await api('GET', `/budgets/vs-actual?year=${YEAR}&period=MONTHLY&month=2`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    const row = res.data[0];
    assert.equal(row.budgeted, 1200);
    assert.equal(row.actual, 300);
    assert.equal(row.variance, 900);
    assert.equal(row.pctUsed, 25);
    expectStatus(await api('GET', '/budgets/vs-actual?month=0', undefined, { token }), 400);
  });

  test('update: partial, validated against the merged period, 404', async () => {
    const res = await api('PUT', `/budgets/${monthlyId}`, { amount: 1500 }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.amount, 1500);
    assert.equal(res.data.month, 2);
    assert.equal(res.data.category, 'RENT');
    expectStatus(await api('PUT', `/budgets/${monthlyId}`, { period: 'QUARTERLY' }, { token }), 400); // no quarter
    const q = await api('PUT', `/budgets/${monthlyId}`, { period: 'QUARTERLY', quarter: 1 }, { token });
    expectStatus(q, 200);
    assert.equal(q.data.month, null);
    assert.equal(q.data.quarter, 1);
    expectStatus(await api('PUT', `/budgets/${monthlyId}`, { amount: 'x' }, { token }), 400);
    expectStatus(await api('PUT', '/budgets/does-not-exist', { amount: 1 }, { token }), 404);
  });

  test('deletes, then 404', async () => {
    expectStatus(await api('DELETE', `/budgets/${monthlyId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/budgets/${monthlyId}`, undefined, { token }), 404);
  });

  test('RBAC: finance module (ACCOUNTANT manages, MANAGER/VIEWER have no access)', async () => {
    const accountant = await staffWithRole('ACCOUNTANT');
    const manager = await staffWithRole('MANAGER');
    const viewer = await staffWithRole('VIEWER');
    try {
      const t = accountant.token;
      const res = await api('POST', '/budgets', { category: 'UTILITIES', year: YEAR, period: 'YEARLY', amount: 50 }, { token: t });
      expectStatus(res, 201);
      budgetIds.add(res.data.id);
      expectStatus(await api('GET', `/budgets?year=${YEAR}`, undefined, { token: t }), 200);
      expectStatus(await api('GET', `/budgets/vs-actual?year=${YEAR}`, undefined, { token: t }), 200);
      expectStatus(await api('PUT', `/budgets/${res.data.id}`, { amount: 60 }, { token: t }), 200);
      // ACCOUNTANT preset has no finance delete
      expectStatus(await api('DELETE', `/budgets/${res.data.id}`, undefined, { token: t }), 403);
      for (const u of [manager, viewer]) {
        expectStatus(await api('GET', '/budgets', undefined, { token: u.token }), 403);
        expectStatus(await api('GET', '/budgets/vs-actual', undefined, { token: u.token }), 403);
        expectStatus(await api('POST', '/budgets', { category: 'RENT', year: YEAR, period: 'YEARLY', amount: 1 }, { token: u.token }), 403);
        expectStatus(await api('PUT', `/budgets/${res.data.id}`, { amount: 1 }, { token: u.token }), 403);
        expectStatus(await api('DELETE', `/budgets/${res.data.id}`, undefined, { token: u.token }), 403);
      }
    } finally {
      await accountant.cleanup();
      await manager.cleanup();
      await viewer.cleanup();
    }
  });
});
