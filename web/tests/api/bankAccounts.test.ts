import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { db, purgeAccount } from './_crmdb';

describe('bank accounts', () => {
  let token: string;
  let a: string; // main account
  let b: string; // transfer target
  let inactive: string;
  let empty: string; // no transactions, deleted by the test

  before(async () => {
    token = await adminAuth();
  });

  after(async () => {
    for (const id of [a, b, inactive, empty]) await purgeAccount(id);
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/bank-accounts'), 401);
    expectStatus(await api('POST', '/bank-accounts', {}), 401);
    expectStatus(await api('GET', '/bank-accounts/x'), 401);
    expectStatus(await api('PUT', '/bank-accounts/x', {}), 401);
    expectStatus(await api('DELETE', '/bank-accounts/x'), 401);
    expectStatus(await api('POST', '/bank-accounts/x/transactions', {}), 401);
    expectStatus(await api('POST', '/bank-accounts/transfer', {}), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/bank-accounts', { type: 'BANK' }, { token }), 400);
    expectStatus(await api('POST', '/bank-accounts', { name: 'x', type: 'VAULT' }, { token }), 400);
    expectStatus(await api('POST', '/bank-accounts', { name: 'x', openingBalance: 'lots' }, { token }), 400);
  });

  test('creates accounts (extra fields ignored)', async () => {
    const res = await api('POST', '/bank-accounts', {
      name: `Main ${TAG}`, type: 'BANK', bankName: 'ENBD', iban: 'AE01', openingBalance: '500', isActive: false, id: 'custom',
    }, { token });
    expectStatus(res, 201);
    a = res.data.id;
    assert.notEqual(a, 'custom');
    assert.equal(res.data.isActive, true);
    assert.equal(res.data.openingBalance, 500);
    assert.equal(res.data.currentBalance, 500);
    const rb = await api('POST', '/bank-accounts', { name: `Target ${TAG}`, type: 'CASH' }, { token });
    expectStatus(rb, 201);
    b = rb.data.id;
    assert.equal(rb.data.currency, 'AED');
    const ri = await api('POST', '/bank-accounts', { name: `Inactive ${TAG}`, type: 'PETTY_CASH' }, { token });
    inactive = ri.data.id;
    const re = await api('POST', '/bank-accounts', { name: `Empty ${TAG}` }, { token });
    empty = re.data.id;
  });

  test('lists accounts with balances', async () => {
    const res = await api('GET', '/bank-accounts', undefined, { token });
    expectStatus(res, 200);
    const mine = res.data.find((x: any) => x.id === a);
    assert.equal(mine.currentBalance, 500);
  });

  test('update: partial, validated, 404', async () => {
    const res = await api('PUT', `/bank-accounts/${inactive}`, { isActive: false }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, false);
    assert.equal(res.data.name, `Inactive ${TAG}`);
    assert.equal(res.data.type, 'PETTY_CASH');
    const str = await api('PUT', `/bank-accounts/${a}`, { isActive: 'false', name: `Main ${TAG}` }, { token });
    assert.equal(str.data.isActive, false, "'false' string is false");
    await api('PUT', `/bank-accounts/${a}`, { isActive: true }, { token });
    expectStatus(await api('PUT', `/bank-accounts/${a}`, { type: 'VAULT' }, { token }), 400);
    expectStatus(await api('PUT', `/bank-accounts/${a}`, { name: '' }, { token }), 400);
    expectStatus(await api('PUT', `/bank-accounts/${a}`, { openingBalance: 'x' }, { token }), 400);
    expectStatus(await api('PUT', '/bank-accounts/does-not-exist', { name: 'x' }, { token }), 404);
  });

  test('transactions: validation, signs and 404', async () => {
    const url = `/bank-accounts/${a}/transactions`;
    expectStatus(await api('POST', url, { type: 'DEPOSIT' }, { token }), 400);
    expectStatus(await api('POST', url, { type: 'TRANSFER_IN', amount: 5 }, { token }), 400);
    expectStatus(await api('POST', url, { type: 'DEPOSIT', amount: 'abc' }, { token }), 400);
    expectStatus(await api('POST', url, { type: 'DEPOSIT', amount: 0 }, { token }), 400);
    expectStatus(await api('POST', url, { type: 'DEPOSIT', amount: 5, date: 'someday' }, { token }), 400);
    expectStatus(await api('POST', '/bank-accounts/does-not-exist/transactions', { type: 'DEPOSIT', amount: 5 }, { token }), 404);

    const dep = await api('POST', url, { type: 'DEPOSIT', amount: -200, description: 'dep', date: '2026-01-05' }, { token });
    expectStatus(dep, 201);
    assert.equal(dep.data.amount, 200);
    const wd = await api('POST', url, { type: 'WITHDRAWAL', amount: 50 }, { token });
    assert.equal(wd.data.amount, -50);
    const adj = await api('POST', url, { type: 'ADJUSTMENT', amount: -10 }, { token });
    assert.equal(adj.data.amount, -10);
  });

  test('regression: transfer validates amount, accounts and active state', async () => {
    const t = (body: any) => api('POST', '/bank-accounts/transfer', body, { token });
    expectStatus(await t({ fromAccountId: a, toAccountId: b }), 400);
    expectStatus(await t({ fromAccountId: a, toAccountId: a, amount: 10 }), 400);
    expectStatus(await t({ fromAccountId: a, toAccountId: b, amount: -10 }), 400);
    expectStatus(await t({ fromAccountId: a, toAccountId: b, amount: 0 }), 400);
    expectStatus(await t({ fromAccountId: a, toAccountId: b, amount: 'ten' }), 400);
    expectStatus(await t({ fromAccountId: a, toAccountId: 'nope', amount: 10 }), 404);
    expectStatus(await t({ fromAccountId: a, toAccountId: inactive, amount: 10 }), 400);
    expectStatus(await t({ fromAccountId: inactive, toAccountId: a, amount: 10 }), 400);

    const ok = await t({ fromAccountId: a, toAccountId: b, amount: 100 });
    expectStatus(ok, 201);
    assert.equal(ok.data.out.amount, -100);
    assert.equal(ok.data.into.amount, 100);
    assert.equal(ok.data.out.type, 'TRANSFER_OUT');
  });

  test('detail shows balance and paginated transactions', async () => {
    const res = await api('GET', `/bank-accounts/${a}?page=1&limit=2`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.currentBalance, 500 + 200 - 50 - 10 - 100);
    assert.equal(res.data.transactions.total, 4);
    assert.equal(res.data.transactions.data.length, 2);
    assert.equal(res.data.transactions.limit, 2);
    const target = await api('GET', `/bank-accounts/${b}`, undefined, { token });
    assert.equal(target.data.currentBalance, 100);
    expectStatus(await api('GET', '/bank-accounts/does-not-exist', undefined, { token }), 404);
  });

  test('delete: refused with transactions, allowed when empty, then 404', async () => {
    expectStatus(await api('DELETE', `/bank-accounts/${a}`, undefined, { token }), 400);
    expectStatus(await api('DELETE', `/bank-accounts/${empty}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/bank-accounts/${empty}`, undefined, { token }), 404);
  });

  test('RBAC: finance module (ACCOUNTANT creates/posts, MANAGER/VIEWER have no access)', async () => {
    const accountant = await staffWithRole('ACCOUNTANT');
    const manager = await staffWithRole('MANAGER');
    const viewer = await staffWithRole('VIEWER');
    let acc = '';
    try {
      const t = accountant.token;
      const res = await api('POST', '/bank-accounts', { name: `RBAC ${TAG}`, type: 'CASH', openingBalance: 10 }, { token: t });
      expectStatus(res, 201);
      acc = res.data.id;
      expectStatus(await api('GET', '/bank-accounts', undefined, { token: t }), 200);
      expectStatus(await api('GET', `/bank-accounts/${acc}`, undefined, { token: t }), 200);
      expectStatus(await api('PUT', `/bank-accounts/${acc}`, { bankName: 'X' }, { token: t }), 200);
      expectStatus(await api('POST', `/bank-accounts/${acc}/transactions`, { type: 'DEPOSIT', amount: 5, description: 'x' }, { token: t }), 201);
      expectStatus(await api('DELETE', `/bank-accounts/${acc}`, undefined, { token: t }), 403);
      for (const u of [manager, viewer]) {
        expectStatus(await api('GET', '/bank-accounts', undefined, { token: u.token }), 403);
        expectStatus(await api('GET', `/bank-accounts/${acc}`, undefined, { token: u.token }), 403);
        expectStatus(await api('POST', '/bank-accounts', { name: 'x', type: 'CASH' }, { token: u.token }), 403);
        expectStatus(await api('PUT', `/bank-accounts/${acc}`, { bankName: 'Y' }, { token: u.token }), 403);
        expectStatus(await api('POST', `/bank-accounts/${acc}/transactions`, { type: 'DEPOSIT', amount: 1 }, { token: u.token }), 403);
        expectStatus(await api('POST', '/bank-accounts/transfer', { fromAccountId: acc, toAccountId: acc, amount: 1 }, { token: u.token }), 403);
      }
    } finally {
      await purgeAccount(acc);
      await accountant.cleanup();
      await manager.cleanup();
      await viewer.cleanup();
    }
  });
});
