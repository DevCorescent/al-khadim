import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, fetchRaw, samplePdf, staffWithRole } from './_client';
import { db, purgeAccount, purgeExpense } from './_crmdb';

// A year nobody else uses, so the stats for it contain only this file's expenses.
const YEAR = 2092;
// RBAC tests post their expenses in a separate year so the year-scoped stats test stays exact.
const RBAC_YEAR = 2094;

describe('expenses', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  /** VIEWER with a per-user override: finance view/create/edit but no approve. */
  let clerk: Awaited<ReturnType<typeof staffWithRole>>;
  let accountant: Awaited<ReturnType<typeof staffWithRole>>;
  let accountId: string;
  let expenseId: string;
  const created: string[] = [];

  const mk = async (extra: Record<string, any> = {}) => {
    const res = await api('POST', '/expenses', {
      category: 'TRAVEL', description: `Taxi ${TAG}`, amount: 100, taxAmount: 5, date: `${YEAR}-02-10`, ...extra,
    }, { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    return res.data;
  };

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
    accountant = await staffWithRole('ACCOUNTANT');
    clerk = await staffWithRole('VIEWER');
    expectStatus(await api('PUT', `/users/${clerk.user.id}`, { permissions: { finance: ['view', 'create', 'edit'] } }, { token }), 200);
    const acc = await api('POST', '/bank-accounts', { name: `Exp Acc ${TAG}`, type: 'BANK', openingBalance: 1000 }, { token });
    expectStatus(acc, 201);
    accountId = acc.data.id;
  });

  after(async () => {
    for (const id of created) await purgeExpense(id);
    await purgeAccount(accountId);
    await recruiter?.cleanup();
    await accountant?.cleanup();
    await clerk?.cleanup();
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/expenses'), 401);
    expectStatus(await api('POST', '/expenses', {}), 401);
    expectStatus(await api('GET', '/expenses/stats'), 401);
    expectStatus(await api('GET', '/expenses/x'), 401);
    expectStatus(await api('PUT', '/expenses/x', {}), 401);
    expectStatus(await api('DELETE', '/expenses/x'), 401);
    expectStatus(await api('PATCH', '/expenses/x/approve'), 401);
    expectStatus(await api('PATCH', '/expenses/x/pay', {}), 401);
    expectStatus(await api('POST', '/expenses/x/receipt', new FormData()), 401);
  });

  test('create validates input', async () => {
    const ok = { category: 'TRAVEL', description: 'x', amount: 1, date: '2026-01-01' };
    expectStatus(await api('POST', '/expenses', { ...ok, category: undefined }, { token }), 400);
    expectStatus(await api('POST', '/expenses', { ...ok, category: 'FOOD' }, { token }), 400);
    expectStatus(await api('POST', '/expenses', { ...ok, amount: 'ten' }, { token }), 400);
    expectStatus(await api('POST', '/expenses', { ...ok, amount: -5 }, { token }), 400);
    expectStatus(await api('POST', '/expenses', { ...ok, date: 'yesterday' }, { token }), 400);
    expectStatus(await api('POST', '/expenses', { ...ok, dueDate: 'later' }, { token }), 400);
  });

  test('creates a draft expense (status/approver in the body are ignored)', async () => {
    const exp = await mk({ status: 'PAID', approvedByUserId: 'x', vendor: 'Careem' });
    expenseId = exp.id;
    assert.match(exp.expenseNo, /^EXP-\d{4}-\d{4,}$/);
    assert.equal(exp.status, 'DRAFT');
    assert.equal(exp.approvedByUserId, null);
    assert.equal(exp.totalAmount, 105);
  });

  test('concurrent creates get distinct expense numbers', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => api('POST', '/expenses', {
      category: 'OTHER', description: `Concurrent ${TAG}`, amount: 1, date: `${YEAR}-03-01`,
    }, { token })));
    results.forEach((r) => { expectStatus(r, 201); created.push(r.data.id); });
    assert.equal(new Set(results.map((r) => r.data.expenseNo)).size, 4);
  });

  test('lists with filters', async () => {
    const res = await api('GET', `/expenses?search=${TAG}&category=TRAVEL&limit=10`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.data[0].id, expenseId);
    const range = await api('GET', `/expenses?search=${TAG}&dateFrom=${YEAR}-03-01&dateTo=${YEAR}-12-31`, undefined, { token });
    assert.equal(range.data.total, 4);
    expectStatus(await api('GET', '/expenses?dateFrom=garbage', undefined, { token }), 400);
  });

  test('gets one, 404 for unknown', async () => {
    const res = await api('GET', `/expenses/${expenseId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.vendor, 'Careem');
    expectStatus(await api('GET', '/expenses/does-not-exist', undefined, { token }), 404);
  });

  test('partial update recomputes the total and keeps other fields', async () => {
    const res = await api('PUT', `/expenses/${expenseId}`, { taxAmount: 10 }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.totalAmount, 110);
    assert.equal(res.data.vendor, 'Careem');
    assert.equal(res.data.category, 'TRAVEL');
  });

  test('update validates input, status changes and 404s', async () => {
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { amount: 'x' }, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { category: 'FOOD' }, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { date: '' }, { token }), 400);
    // Approval/payment can't be bypassed through PUT.
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { status: 'APPROVED' }, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { status: 'PAID' }, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { status: 'REJECTED' }, { token: clerk.token }), 403);
    const submit = await api('PUT', `/expenses/${expenseId}`, { status: 'PENDING_APPROVAL' }, { token: clerk.token });
    expectStatus(submit, 200);
    assert.equal(submit.data.status, 'PENDING_APPROVAL');
    expectStatus(await api('PUT', '/expenses/does-not-exist', { notes: 'x' }, { token }), 404);
  });

  test('approve and pay need finance approve', async () => {
    for (const t of [recruiter.token, clerk.token]) {
      expectStatus(await api('PATCH', `/expenses/${expenseId}/approve`, undefined, { token: t }), 403);
      expectStatus(await api('PATCH', `/expenses/${expenseId}/pay`, {}, { token: t }), 403);
    }
  });

  test('RBAC: RECRUITER has no finance access at all', async () => {
    const t = recruiter.token;
    expectStatus(await api('GET', '/expenses', undefined, { token: t }), 403);
    expectStatus(await api('GET', '/expenses/stats', undefined, { token: t }), 403);
    expectStatus(await api('GET', `/expenses/${expenseId}`, undefined, { token: t }), 403);
    expectStatus(await api('POST', '/expenses', { category: 'OTHER', description: 'x', amount: 1, date: '2026-01-01' }, { token: t }), 403);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { notes: 'x' }, { token: t }), 403);
    expectStatus(await api('DELETE', `/expenses/${expenseId}`, undefined, { token: t }), 403);
  });

  test('RBAC: per-user permissions override (VIEWER + finance view/create/edit) can create and edit', async () => {
    const res = await api('POST', '/expenses', {
      category: 'OTHER', description: `Clerk ${TAG}`, amount: 10, date: `${RBAC_YEAR}-04-01`,
    }, { token: clerk.token });
    expectStatus(res, 201);
    created.push(res.data.id);
    expectStatus(await api('PUT', `/expenses/${res.data.id}`, { notes: 'edited' }, { token: clerk.token }), 200);
    expectStatus(await api('GET', `/expenses/${res.data.id}`, undefined, { token: clerk.token }), 200);
    // no delete in the override
    expectStatus(await api('DELETE', `/expenses/${res.data.id}`, undefined, { token: clerk.token }), 403);
  });

  test('RBAC + regression: ACCOUNTANT creates, approves and pays; pay only accepts APPROVED expenses', async () => {
    const t = accountant.token;
    const res = await api('POST', '/expenses', {
      category: 'OTHER', description: `Acct ${TAG}`, amount: 20, date: `${RBAC_YEAR}-05-01`,
    }, { token: t });
    expectStatus(res, 201);
    const id = res.data.id;
    created.push(id);
    // DRAFT cannot be paid
    const draftPay = await api('PATCH', `/expenses/${id}/pay`, {}, { token: t });
    expectStatus(draftPay, 400);
    assert.match(draftPay.data.error, /approved/i);
    // PENDING_APPROVAL cannot be paid either
    expectStatus(await api('PUT', `/expenses/${id}`, { status: 'PENDING_APPROVAL' }, { token: t }), 200);
    expectStatus(await api('PATCH', `/expenses/${id}/pay`, {}, { token: t }), 400);
    // REJECTED cannot be paid
    expectStatus(await api('PUT', `/expenses/${id}`, { status: 'REJECTED' }, { token: t }), 200);
    expectStatus(await api('PATCH', `/expenses/${id}/pay`, {}, { token: t }), 400);
    assert.equal((await api('GET', `/expenses/${id}`, undefined, { token: t })).data.status, 'REJECTED');
    // back to draft, approve, pay
    expectStatus(await api('PUT', `/expenses/${id}`, { status: 'DRAFT' }, { token: t }), 200);
    expectStatus(await api('PATCH', `/expenses/${id}/approve`, undefined, { token: t }), 200);
    const paid = await api('PATCH', `/expenses/${id}/pay`, {}, { token: t });
    expectStatus(paid, 200);
    assert.equal(paid.data.status, 'PAID');
    // ACCOUNTANT has no finance delete
    expectStatus(await api('DELETE', `/expenses/${id}`, undefined, { token: t }), 403);
  });

  test('approve: 404, then approves once', async () => {
    expectStatus(await api('PATCH', '/expenses/does-not-exist/approve', undefined, { token }), 404);
    const res = await api('PATCH', `/expenses/${expenseId}/approve`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'APPROVED');
    assert.ok(res.data.approvedBy);
  });

  test('pay: validates the account, posts one payment, then refuses a second pay', async () => {
    expectStatus(await api('PATCH', '/expenses/does-not-exist/pay', {}, { token }), 404);
    expectStatus(await api('PATCH', `/expenses/${expenseId}/pay`, { accountId: 'nope' }, { token }), 400);
    const still = await api('GET', `/expenses/${expenseId}`, undefined, { token });
    assert.equal(still.data.status, 'APPROVED');

    const res = await api('PATCH', `/expenses/${expenseId}/pay`, { accountId, paymentMethod: 'CARD', paymentRef: 'R1' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'PAID');
    assert.ok(res.data.paidDate);
    assert.equal(res.data.account.id, accountId);
    expectStatus(await api('PATCH', `/expenses/${expenseId}/pay`, { accountId }, { token }), 400);
    const acc = await api('GET', `/bank-accounts/${accountId}`, undefined, { token });
    const txns = acc.data.transactions.data.filter((t: any) => t.relatedExpenseId === expenseId);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].amount, -110);
    assert.equal(acc.data.currentBalance, 890);
  });

  test('a paid expense cannot be re-approved, re-amounted or deleted', async () => {
    expectStatus(await api('PATCH', `/expenses/${expenseId}/approve`, undefined, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { amount: 1 }, { token }), 400);
    expectStatus(await api('PUT', `/expenses/${expenseId}`, { status: 'DRAFT' }, { token }), 400);
    const same = await api('PUT', `/expenses/${expenseId}`, { amount: 100, notes: 'still editable' }, { token });
    expectStatus(same, 200);
    expectStatus(await api('DELETE', `/expenses/${expenseId}`, undefined, { token }), 400);
  });

  test('stats are scoped to the year', async () => {
    const res = await api('GET', `/expenses/stats?year=${YEAR}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.count, 5);
    assert.equal(res.data.total, 114);
    assert.equal(res.data.paid, 110);
    assert.equal(res.data.monthly.length, 12);
    assert.ok(res.data.byCategory.some((c: any) => c.category === 'TRAVEL' && c.amount === 110));
    assert.ok(res.data.byStatus.some((s: any) => s.status === 'PAID'));
    expectStatus(await api('GET', '/expenses/stats', undefined, { token }), 200);
  });

  test('receipt upload: 404, missing file, then stored and served', async () => {
    const fd = () => { const f = new FormData(); f.append('file', samplePdf('Receipt'), 'receipt.pdf'); return f; };
    expectStatus(await api('POST', '/expenses/does-not-exist/receipt', fd(), { token }), 404);
    expectStatus(await api('POST', `/expenses/${created[1]}/receipt`, new FormData(), { token }), 400);
    const res = await api('POST', `/expenses/${created[1]}/receipt`, fd(), { token });
    expectStatus(res, 200);
    assert.match(res.data.receiptPath, /^uploads\//);
    const file = await fetchRaw(res.data.receiptPath);
    assert.equal(file.status, 200);
  });

  test('deletes a draft expense (and its receipt), then 404', async () => {
    const id = created[1];
    const before = await api('GET', `/expenses/${id}`, undefined, { token });
    expectStatus(await api('DELETE', `/expenses/${id}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/expenses/${id}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/expenses/${id}`, undefined, { token }), 404);
    const file = await fetchRaw(before.data.receiptPath);
    assert.equal(file.status, 404);
  });
});
