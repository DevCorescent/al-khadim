import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createClient, db, purgeAccount, purgeClient } from './_crmdb';

// A year nobody else uses, so the stats for it contain only this file's invoices.
const YEAR = 2091;

describe('invoices', () => {
  let token: string;
  let clientId: string;
  let accountId: string;
  let invoiceId: string;

  const fullInvoice = () => ({
    clientId, docType: 'INVOICE', status: 'DRAFT', currency: 'EUR', subject: `Subject ${TAG}`,
    notes: 'Some notes', terms: 'Net 30', fromName: 'Al Khadim', billingName: 'Billing Co',
    bankName: 'Test Bank', bankIBAN: 'AE000000', template: 'modern', primaryColor: '#123456',
    showSignature: true, watermarkOpacity: 20,
    issueDate: `${YEAR}-03-15`, dueDate: `${YEAR}-04-15`,
    discountType: 'FIXED', discount: 10, taxRate: 5,
    items: [
      { description: 'Line A', qty: 2, unitPrice: 100 },
      { description: 'Line B', qty: 1, unitPrice: 50, unit: 'hr' },
    ],
  });

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token, 'Invoices')).id;
    const acc = await api('POST', '/bank-accounts', { name: `Inv Acc ${TAG}`, type: 'CASH' }, { token });
    expectStatus(acc, 201);
    accountId = acc.data.id;
  });

  after(async () => {
    await purgeClient(clientId);
    await purgeAccount(accountId);
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/invoices'), 401);
    expectStatus(await api('POST', '/invoices', {}), 401);
    expectStatus(await api('GET', '/invoices/stats'), 401);
    expectStatus(await api('GET', '/invoices/x'), 401);
    expectStatus(await api('PUT', '/invoices/x', {}), 401);
    expectStatus(await api('DELETE', '/invoices/x'), 401);
    expectStatus(await api('POST', '/invoices/x/duplicate'), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/invoices', { items: [] }, { token }), 400); // no clientId
    expectStatus(await api('POST', '/invoices', { clientId: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, status: 'PENDING' }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, docType: 'RECEIPT' }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, taxRate: 'abc' }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, items: [{ qty: 1, unitPrice: 5 }] }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, items: [{ description: 'x', qty: 'many' }] }, { token }), 400);
    expectStatus(await api('POST', '/invoices', { clientId, dueDate: 'not-a-date' }, { token }), 400);
  });

  test('creates an invoice with computed totals', async () => {
    const res = await api('POST', '/invoices', fullInvoice(), { token });
    expectStatus(res, 201);
    invoiceId = res.data.id;
    assert.match(res.data.invoiceNo, /^INV-\d{4}-\d{4,}$/);
    assert.equal(res.data.subtotal, 250);
    assert.equal(res.data.discount, 10);
    assert.equal(res.data.tax, 12);
    assert.equal(res.data.totalAmount, 252);
    assert.equal(res.data.items.length, 2);
    assert.equal(res.data.items[1].unit, 'hr');
    assert.equal(res.data.client.id, clientId);
    assert.equal(res.data.currency, 'EUR');
  });

  test('lists and filters', async () => {
    const res = await api('GET', `/invoices?clientId=${clientId}&year=${YEAR}&limit=5`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.data[0].id, invoiceId);
    const search = await api('GET', `/invoices?search=${encodeURIComponent(`Subject ${TAG}`)}`, undefined, { token });
    expectStatus(search, 200);
    assert.ok(search.data.data.some((d: any) => d.id === invoiceId));
    const other = await api('GET', `/invoices?clientId=${clientId}&year=${YEAR - 1}`, undefined, { token });
    assert.equal(other.data.total, 0);
    // Bad paging values fall back to defaults instead of erroring.
    expectStatus(await api('GET', '/invoices?page=abc&limit=-3', undefined, { token }), 200);
    expectStatus(await api('GET', '/invoices?year=abc', undefined, { token }), 400);
  });

  test('gets one invoice, 404 for unknown id', async () => {
    const res = await api('GET', `/invoices/${invoiceId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.items[0].description, 'Line A');
    expectStatus(await api('GET', '/invoices/does-not-exist', undefined, { token }), 404);
  });

  test('regression: a status-only update keeps every other field', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, { status: 'SENT' }, { token });
    expectStatus(res, 200);
    const d = res.data;
    assert.equal(d.status, 'SENT');
    assert.equal(d.subject, `Subject ${TAG}`);
    assert.equal(d.notes, 'Some notes');
    assert.equal(d.terms, 'Net 30');
    assert.equal(d.fromName, 'Al Khadim');
    assert.equal(d.billingName, 'Billing Co');
    assert.equal(d.bankName, 'Test Bank');
    assert.equal(d.bankIBAN, 'AE000000');
    assert.equal(d.currency, 'EUR');
    assert.equal(d.template, 'modern');
    assert.equal(d.primaryColor, '#123456');
    assert.equal(d.showSignature, true);
    assert.equal(d.watermarkOpacity, 20);
    assert.equal(d.totalAmount, 252);
    assert.equal(d.items.length, 2);
    assert.ok(d.dueDate);
  });

  test('update validates and 404s', async () => {
    expectStatus(await api('PUT', `/invoices/${invoiceId}`, { status: 'PENDING' }, { token }), 400);
    expectStatus(await api('PUT', `/invoices/${invoiceId}`, { discount: 'lots' }, { token }), 400);
    expectStatus(await api('PUT', `/invoices/${invoiceId}`, { items: 'nope' }, { token }), 400);
    expectStatus(await api('PUT', `/invoices/${invoiceId}`, { clientId: '' }, { token }), 400);
    expectStatus(await api('PUT', '/invoices/does-not-exist', { status: 'SENT' }, { token }), 404);
  });

  test('changing discount/tax without items recomputes totals from stored items', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, { discount: 50, taxRate: 10 }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.subtotal, 250);
    assert.equal(res.data.discount, 50);
    assert.equal(res.data.totalAmount, 220);
    assert.equal(res.data.items.length, 2);
    assert.equal(res.data.subject, `Subject ${TAG}`);
  });

  test('switching to a PERCENT discount recomputes the discount amount', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, { discountType: 'PERCENT', discount: 10, taxRate: 0 }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.discount, 25);
    assert.equal(res.data.totalAmount, 225);
    // A later tax-only change keeps the 10% (not "25%").
    const tax = await api('PUT', `/invoices/${invoiceId}`, { taxRate: 0 }, { token });
    assert.equal(tax.data.discount, 25);
    assert.equal(tax.data.totalAmount, 225);
  });

  test('sending items replaces them and recomputes totals', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, {
      discountType: 'FIXED', discount: 0, taxRate: 0,
      items: [{ description: 'Only line', qty: 3, unitPrice: 30 }],
    }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.items.length, 1);
    assert.equal(res.data.items[0].total, 90);
    assert.equal(res.data.totalAmount, 90);
    assert.equal(res.data.currency, 'EUR');
  });

  test('a failed payment update is atomic (bad account leaves items and status untouched)', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, {
      status: 'PAID', accountId: 'no-such-account',
      items: [{ description: 'Should not be saved', qty: 1, unitPrice: 1 }],
    }, { token });
    expectStatus(res, 400);
    const doc = await api('GET', `/invoices/${invoiceId}`, undefined, { token });
    assert.equal(doc.data.status, 'SENT');
    assert.equal(doc.data.items.length, 1);
    assert.equal(doc.data.items[0].description, 'Only line');
    assert.equal(doc.data.paidDate, null);
  });

  test('marking paid with an account posts exactly one INVOICE_PAYMENT', async () => {
    const res = await api('PUT', `/invoices/${invoiceId}`, { status: 'PAID', accountId }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'PAID');
    assert.ok(res.data.paidDate);
    const again = await api('PUT', `/invoices/${invoiceId}`, { status: 'PAID', accountId }, { token });
    expectStatus(again, 200);
    const acc = await api('GET', `/bank-accounts/${accountId}`, undefined, { token });
    const txns = acc.data.transactions.data.filter((t: any) => t.relatedInvoiceId === invoiceId);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].type, 'INVOICE_PAYMENT');
    assert.equal(txns[0].amount, 90);
    assert.equal(acc.data.currentBalance, 90);
  });

  test('stats: outstanding counts SENT + OVERDUE and byStatus/byType follow the year', async () => {
    const mk = async (status: string, price: number, docType = 'INVOICE') => {
      const r = await api('POST', '/invoices', {
        clientId, status, docType, issueDate: `${YEAR}-06-01`, taxRate: 0,
        items: [{ description: status, qty: 1, unitPrice: price }],
      }, { token });
      expectStatus(r, 201);
      return r.data;
    };
    await mk('SENT', 100);
    await mk('OVERDUE', 40);
    await mk('DRAFT', 7);
    const quote = await mk('DRAFT', 1000, 'QUOTATION');
    assert.match(quote.invoiceNo, /^QT-/);

    const res = await api('GET', `/invoices/stats?year=${YEAR}`, undefined, { token });
    expectStatus(res, 200);
    const { kpis, byStatus, byType, monthly, topClients } = res.data;
    assert.equal(kpis.totalOutstanding, 140);
    assert.equal(kpis.totalOverdue, 40);
    assert.equal(kpis.totalPaid, 90);
    assert.equal(kpis.totalDraft, 7);
    assert.equal(kpis.totalInvoiced, 237);
    assert.equal(kpis.invoiceCount, 4);
    assert.equal(kpis.totalDocuments, 5);
    // byStatus / byType are scoped to the same year as the KPIs.
    const statusSum = byStatus.reduce((s: number, x: any) => s + x.value, 0);
    assert.equal(statusSum, kpis.totalInvoiced);
    assert.equal(byStatus.find((s: any) => s.name === 'SENT').count, 1);
    const typeCount = byType.reduce((s: number, x: any) => s + x.count, 0);
    assert.equal(typeCount, kpis.totalDocuments);
    assert.equal(byType.find((t: any) => t.name === 'QUOTATION').value, 1000);
    assert.equal(monthly.length, 12);
    assert.equal(monthly[5].invoiced, 147);
    assert.equal(topClients[0].value, 237);

    expectStatus(await api('GET', '/invoices/stats?year=nope', undefined, { token }), 400);
    const current = await api('GET', '/invoices/stats', undefined, { token });
    expectStatus(current, 200);
    assert.ok(current.data.kpis);
  });

  test('concurrent creates get distinct invoice numbers', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      api('POST', '/invoices', { clientId, docType: 'PROFORMA_INVOICE', issueDate: `${YEAR}-01-01` }, { token })));
    results.forEach((r) => expectStatus(r, 201));
    const numbers = new Set(results.map((r) => r.data.invoiceNo));
    assert.equal(numbers.size, 5);
  });

  test('duplicates an invoice as a new draft', async () => {
    const res = await api('POST', `/invoices/${invoiceId}/duplicate`, undefined, { token });
    expectStatus(res, 201);
    assert.notEqual(res.data.id, invoiceId);
    assert.equal(res.data.status, 'DRAFT');
    assert.equal(res.data.paidDate, null);
    assert.equal(res.data.items.length, 1);
    assert.equal(res.data.subject, `Subject ${TAG}`);
    expectStatus(await api('POST', '/invoices/does-not-exist/duplicate', undefined, { token }), 404);
  });

  test('deletes an invoice, 404 afterwards', async () => {
    const created = await api('POST', '/invoices', { clientId }, { token });
    expectStatus(created, 201);
    assert.equal(created.data.currency, 'USD');
    expectStatus(await api('DELETE', `/invoices/${created.data.id}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/invoices/${created.data.id}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/invoices/${created.data.id}`, undefined, { token }), 404);
  });

  test('regression: creating an invoice as PAID sets paidDate (other statuses leave it null)', async () => {
    const paid = await api('POST', '/invoices', { clientId, status: 'PAID', issueDate: '2089-01-10' }, { token });
    expectStatus(paid, 201);
    assert.equal(paid.data.status, 'PAID');
    assert.ok(paid.data.paidDate, 'paidDate should be set');
    const sent = await api('POST', '/invoices', { clientId, status: 'SENT', issueDate: '2089-01-10' }, { token });
    expectStatus(sent, 201);
    assert.equal(sent.data.paidDate, null);
  });

  describe('RBAC', () => {
    let viewer: Awaited<ReturnType<typeof staffWithRole>>;
    let manager: Awaited<ReturnType<typeof staffWithRole>>;
    let accountant: Awaited<ReturnType<typeof staffWithRole>>;
    let docId: string;

    before(async () => {
      viewer = await staffWithRole('VIEWER');
      manager = await staffWithRole('MANAGER');
      accountant = await staffWithRole('ACCOUNTANT');
      const doc = await api('POST', '/invoices', { clientId, issueDate: '2089-02-01' }, { token });
      expectStatus(doc, 201);
      docId = doc.data.id;
    });

    after(async () => {
      await viewer?.cleanup();
      await manager?.cleanup();
      await accountant?.cleanup();
    });

    test('VIEWER has no invoice access', async () => {
      const t = viewer.token;
      expectStatus(await api('GET', '/invoices', undefined, { token: t }), 403);
      expectStatus(await api('GET', '/invoices/stats', undefined, { token: t }), 403);
      expectStatus(await api('GET', `/invoices/${docId}`, undefined, { token: t }), 403);
      expectStatus(await api('POST', '/invoices', { clientId }, { token: t }), 403);
    });

    test('MANAGER can view invoices but not create/edit/delete/duplicate', async () => {
      const t = manager.token;
      expectStatus(await api('GET', '/invoices', undefined, { token: t }), 200);
      expectStatus(await api('GET', '/invoices/stats', undefined, { token: t }), 200);
      expectStatus(await api('GET', `/invoices/${docId}`, undefined, { token: t }), 200);
      expectStatus(await api('POST', '/invoices', { clientId }, { token: t }), 403);
      expectStatus(await api('PUT', `/invoices/${docId}`, { notes: 'x' }, { token: t }), 403);
      expectStatus(await api('POST', `/invoices/${docId}/duplicate`, undefined, { token: t }), 403);
      expectStatus(await api('DELETE', `/invoices/${docId}`, undefined, { token: t }), 403);
    });

    test('ACCOUNTANT can view, create and edit invoices (no delete in the preset)', async () => {
      const t = accountant.token;
      expectStatus(await api('GET', '/invoices', undefined, { token: t }), 200);
      expectStatus(await api('GET', '/invoices/stats', undefined, { token: t }), 200);
      const created = await api('POST', '/invoices', { clientId, issueDate: '2089-03-01' }, { token: t });
      expectStatus(created, 201);
      const upd = await api('PUT', `/invoices/${created.data.id}`, { status: 'SENT' }, { token: t });
      expectStatus(upd, 200);
      assert.equal(upd.data.status, 'SENT');
      expectStatus(await api('POST', `/invoices/${created.data.id}/duplicate`, undefined, { token: t }), 201);
      expectStatus(await api('DELETE', `/invoices/${created.data.id}`, undefined, { token: t }), 403);
    });
  });
});
