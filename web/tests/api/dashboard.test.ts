import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, staffWithRole } from './_client';
import { staffUser } from './_rbac';
import { createClient, db, purgeClient } from './_crmdb';

describe('dashboard', () => {
  let token: string;
  let clientId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token, 'Dashboard')).id;
  });

  after(async () => {
    await purgeClient(clientId);
    await db.$disconnect();
  });

  test('requires a staff token', async () => {
    expectStatus(await api('GET', '/dashboard/stats'), 401);
  });

  test('returns the stats shape', async () => {
    const res = await api('GET', '/dashboard/stats', undefined, { token });
    expectStatus(res, 200);
    const { kpis, recentActivity, charts } = res.data;
    for (const k of ['totalCandidates', 'totalClients', 'totalJobs', 'totalEmployees', 'openJobs', 'activeEmployees',
      'pendingFollowUps', 'newCandidatesThisMonth', 'pendingLeaves', 'expiringDocs', 'totalRevenue', 'paidRevenue',
      'pendingRevenue', 'overdueInvoices', 'draftInvoices']) {
      assert.equal(typeof kpis[k], 'number', k);
    }
    assert.ok(Array.isArray(recentActivity.recentCandidates));
    assert.ok(Array.isArray(recentActivity.recentClients));
    assert.equal(charts.monthlyRevenue.length, 12);
  });

  test('regression: pendingRevenue counts SENT + OVERDUE invoices of this year', async () => {
    const before = (await api('GET', '/dashboard/stats', undefined, { token })).data.kpis;
    const year = new Date().getFullYear();
    for (const [status, price] of [['SENT', 100], ['OVERDUE', 40], ['PAID', 7]] as const) {
      const r = await api('POST', '/invoices', {
        clientId, status, taxRate: 0, issueDate: `${year}-01-15`, items: [{ description: status, qty: 1, unitPrice: price }],
      }, { token });
      expectStatus(r, 201);
    }
    // Next year's invoices don't count towards this year's revenue.
    const future = await api('POST', '/invoices', {
      clientId, status: 'SENT', taxRate: 0, issueDate: `${year + 1}-01-15`, items: [{ description: 'future', qty: 1, unitPrice: 1000 }],
    }, { token });
    expectStatus(future, 201);

    const after = (await api('GET', '/dashboard/stats', undefined, { token })).data.kpis;
    assert.equal(after.pendingRevenue - before.pendingRevenue, 140);
    assert.equal(after.paidRevenue - before.paidRevenue, 7);
    assert.equal(after.totalRevenue - before.totalRevenue, 147);
    assert.equal(after.overdueInvoices - before.overdueInvoices, 1);
  });

  test('RBAC: needs dashboard view (RECRUITER/VIEWER presets have it; an override without it does not)', async () => {
    const recruiter = await staffWithRole('RECRUITER');
    const viewer = await staffWithRole('VIEWER');
    const noDash = await staffUser('nodash', 'VIEWER');
    try {
      expectStatus(await api('GET', '/dashboard/stats', undefined, { token: recruiter.token }), 200);
      expectStatus(await api('GET', '/dashboard/stats', undefined, { token: viewer.token }), 200);
      expectStatus(await api('PUT', `/users/${noDash.user.id}`, { permissions: { clients: ['view'] } }, { token }), 200);
      expectStatus(await api('GET', '/dashboard/stats', undefined, { token: noDash.token }), 403);
    } finally {
      await recruiter.cleanup();
      await viewer.cleanup();
      await noDash.cleanup();
    }
  });
});
