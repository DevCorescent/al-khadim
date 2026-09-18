import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { staffUser } from './_rbac';
import { db, purgeClient } from './_crmdb';

describe('clients', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  let clientId: string;
  const extraClients: string[] = [];

  const base = () => ({
    companyName: `Clients Co ${TAG}`, contactPerson: 'Jane Doe', email: testEmail('clients'), phone: '+971500000001',
  });

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('RECRUITER');
  });

  after(async () => {
    await purgeClient(clientId);
    for (const id of extraClients) await purgeClient(id);
    await viewer?.cleanup();
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/clients'), 401);
    expectStatus(await api('POST', '/clients', {}), 401);
    expectStatus(await api('GET', '/clients/tags/all'), 401);
    expectStatus(await api('GET', '/clients/x'), 401);
    expectStatus(await api('GET', '/clients/x/detail'), 401);
    expectStatus(await api('PUT', '/clients/x', {}), 401);
    expectStatus(await api('DELETE', '/clients/x'), 401);
    expectStatus(await api('PATCH', '/clients/x/approve'), 401);
    expectStatus(await api('PATCH', '/clients/x/reject', {}), 401);
  });

  test('create validates required fields', async () => {
    const { companyName, ...noName } = base();
    assert.ok(companyName);
    const res = await api('POST', '/clients', noName, { token });
    expectStatus(res, 400);
    assert.match(res.data.error, /companyName/);
    expectStatus(await api('POST', '/clients', { ...base(), phone: '  ' }, { token }), 400);
  });

  test('regression: create ignores approval/system fields (mass assignment)', async () => {
    const res = await api('POST', '/clients', {
      ...base(), status: 'REJECTED', approvedByUserId: 'someone', rejectionReason: 'x', id: 'custom-id',
      industryId: '', tags: ['vip', 'vip', ' gold '], isActive: 'true',
    }, { token });
    expectStatus(res, 201);
    clientId = res.data.id;
    assert.notEqual(clientId, 'custom-id');
    assert.equal(res.data.status, 'APPROVED');
    assert.equal(res.data.approvedByUserId, null);
    assert.equal(res.data.rejectionReason, null);
    assert.equal(res.data.industryId, null);
    assert.deepEqual(res.data.tags, ['vip', 'gold']);
    assert.equal(res.data.isActive, true);
  });

  test('lists with filters and paging', async () => {
    const res = await api('GET', `/clients?search=${encodeURIComponent(TAG)}&limit=5`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.page, 1);
    assert.equal(res.data.limit, 5);
    const c = res.data.data[0];
    assert.equal(c.id, clientId);
    assert.equal(c.totalRevenue, 0);
    assert.equal(c.openJobs, 0);
    const bad = await api('GET', `/clients?search=${TAG}&page=x&limit=y`, undefined, { token });
    expectStatus(bad, 200);
    assert.equal(bad.data.limit, 20);
    const inactive = await api('GET', `/clients?search=${TAG}&isActive=false`, undefined, { token });
    assert.equal(inactive.data.total, 0);
  });

  test('tags autocomplete includes our tags', async () => {
    const res = await api('GET', '/clients/tags/all', undefined, { token });
    expectStatus(res, 200);
    assert.ok(res.data.includes('vip'));
  });

  test('get one, 404 for unknown', async () => {
    const res = await api('GET', `/clients/${clientId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.companyName, base().companyName);
    assert.ok(Array.isArray(res.data.invoices));
    expectStatus(await api('GET', '/clients/does-not-exist', undefined, { token }), 404);
  });

  test('partial update only touches sent fields and ignores status', async () => {
    const res = await api('PUT', `/clients/${clientId}`, { tags: ['vip'], status: 'PENDING' }, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.tags, ['vip']);
    assert.equal(res.data.status, 'APPROVED');
    assert.equal(res.data.contactPerson, 'Jane Doe');
    expectStatus(await api('PUT', `/clients/${clientId}`, { companyName: '' }, { token }), 400);
    expectStatus(await api('PUT', '/clients/does-not-exist', { notes: 'x' }, { token }), 404);
  });

  test('regression: detail pendingRevenue counts SENT + OVERDUE invoices', async () => {
    for (const [status, price] of [['SENT', 100], ['OVERDUE', 50], ['PAID', 25], ['DRAFT', 5]] as const) {
      const r = await api('POST', '/invoices', { clientId, status, taxRate: 0, items: [{ description: status, qty: 1, unitPrice: price }] }, { token });
      expectStatus(r, 201);
    }
    const res = await api('GET', `/clients/${clientId}/detail`, undefined, { token });
    expectStatus(res, 200);
    const rev = res.data.analytics.revenue;
    assert.equal(rev.totalRevenue, 180);
    assert.equal(rev.paidRevenue, 25);
    assert.equal(rev.pendingRevenue, 150);
    assert.equal(rev.overdueRevenue, 50);
    assert.equal(res.data.client.id, clientId);
    assert.equal(res.data.invoices.length, 4);
    assert.equal(res.data.revenueByMonth.length, 12);
    expectStatus(await api('GET', '/clients/does-not-exist/detail', undefined, { token }), 404);
  });

  test('approve / reject are admin-only', async () => {
    expectStatus(await api('PATCH', `/clients/${clientId}/approve`, undefined, { token: viewer.token }), 403);
    expectStatus(await api('PATCH', `/clients/${clientId}/reject`, { reason: 'x' }, { token: viewer.token }), 403);
  });

  test('reject then approve', async () => {
    const rej = await api('PATCH', `/clients/${clientId}/reject`, { reason: 'Incomplete docs' }, { token });
    expectStatus(rej, 200);
    assert.equal(rej.data.status, 'REJECTED');
    assert.equal(rej.data.rejectionReason, 'Incomplete docs');
    const app = await api('PATCH', `/clients/${clientId}/approve`, undefined, { token });
    expectStatus(app, 200);
    assert.equal(app.data.status, 'APPROVED');
    assert.equal(app.data.rejectionReason, null);
    assert.ok(app.data.approvedByUserId);
    expectStatus(await api('PATCH', '/clients/does-not-exist/approve', undefined, { token }), 404);
    expectStatus(await api('PATCH', '/clients/does-not-exist/reject', {}, { token }), 404);
  });

  test('delete: 409 with linked records, 200 otherwise, then 404', async () => {
    const linked = await api('DELETE', `/clients/${clientId}`, undefined, { token });
    expectStatus(linked, 409);
    assert.ok(linked.data.error);

    const fresh = await api('POST', '/clients', { ...base(), email: testEmail('clients2') }, { token });
    expectStatus(fresh, 201);
    extraClients.push(fresh.data.id);
    expectStatus(await api('DELETE', `/clients/${fresh.data.id}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/clients/${fresh.data.id}`, undefined, { token }), 404);
  });

  describe('RBAC', () => {
    let viewerRole: Awaited<ReturnType<typeof staffWithRole>>;
    let manager: Awaited<ReturnType<typeof staffWithRole>>;
    let accountant: Awaited<ReturnType<typeof staffWithRole>>;
    let custom: Awaited<ReturnType<typeof staffWithRole>>;
    let override: Awaited<ReturnType<typeof staffWithRole>>;
    let targetId: string;
    let roleId: string;
    const roleName = `Client Creator ${TAG}`;

    before(async () => {
      viewerRole = await staffUser('viewer', 'VIEWER');
      manager = await staffWithRole('MANAGER');
      accountant = await staffWithRole('ACCOUNTANT');
      custom = await staffUser('custom', 'VIEWER');
      override = await staffUser('override', 'RECRUITER');
      const target = await api('POST', '/clients', { ...base(), email: testEmail('rbactarget') }, { token });
      expectStatus(target, 201);
      targetId = target.data.id;
      extraClients.push(targetId);
      // Custom role: only clients view + create.
      const role = await api('POST', '/roles', { name: roleName, permissions: { clients: ['view', 'create'] } }, { token });
      expectStatus(role, 201);
      roleId = role.data.id;
      expectStatus(await api('PUT', `/users/${custom.user.id}`, { customRole: roleName }, { token }), 200);
      // Per-user override on a RECRUITER: clients view + delete only.
      expectStatus(await api('PUT', `/users/${override.user.id}`, { permissions: { clients: ['view', 'delete'] } }, { token }), 200);
    });

    after(async () => {
      for (const u of [viewerRole, manager, accountant, custom, override]) await u?.cleanup();
      if (roleId) await api('DELETE', `/roles/${roleId}`, undefined, { token });
    });

    test('VIEWER reads clients but cannot create/edit/delete', async () => {
      const t = viewerRole.token;
      expectStatus(await api('GET', '/clients', undefined, { token: t }), 200);
      expectStatus(await api('GET', `/clients/${targetId}`, undefined, { token: t }), 200);
      expectStatus(await api('GET', `/clients/${targetId}/detail`, undefined, { token: t }), 200);
      expectStatus(await api('GET', '/clients/tags/all', undefined, { token: t }), 200);
      expectStatus(await api('POST', '/clients', { ...base(), email: testEmail('viewerc') }, { token: t }), 403);
      expectStatus(await api('PUT', `/clients/${targetId}`, { notes: 'x' }, { token: t }), 403);
      expectStatus(await api('DELETE', `/clients/${targetId}`, undefined, { token: t }), 403);
    });

    test('MANAGER creates and edits clients, cannot delete or approve (approve stays admin-only)', async () => {
      const t = manager.token;
      const res = await api('POST', '/clients', { ...base(), email: testEmail('managerc') }, { token: t });
      expectStatus(res, 201);
      extraClients.push(res.data.id);
      expectStatus(await api('PUT', `/clients/${res.data.id}`, { notes: 'by manager' }, { token: t }), 200);
      expectStatus(await api('DELETE', `/clients/${res.data.id}`, undefined, { token: t }), 403);
      expectStatus(await api('PATCH', `/clients/${res.data.id}/approve`, undefined, { token: t }), 403);
      expectStatus(await api('PATCH', `/clients/${res.data.id}/reject`, {}, { token: t }), 403);
    });

    test('ACCOUNTANT views clients but cannot create them', async () => {
      const t = accountant.token;
      expectStatus(await api('GET', '/clients', undefined, { token: t }), 200);
      expectStatus(await api('POST', '/clients', { ...base(), email: testEmail('acctc') }, { token: t }), 403);
    });

    test('a custom role grants exactly what it lists', async () => {
      const t = custom.token;
      expectStatus(await api('GET', '/clients', undefined, { token: t }), 200);
      const res = await api('POST', '/clients', { ...base(), email: testEmail('customc') }, { token: t });
      expectStatus(res, 201);
      extraClients.push(res.data.id);
      expectStatus(await api('PUT', `/clients/${res.data.id}`, { notes: 'x' }, { token: t }), 403);
      expectStatus(await api('DELETE', `/clients/${res.data.id}`, undefined, { token: t }), 403);
      // Nothing outside the role, not even the dashboard from the VIEWER preset.
      expectStatus(await api('GET', '/dashboard/stats', undefined, { token: t }), 403);
      expectStatus(await api('GET', '/invoices', undefined, { token: t }), 403);
    });

    test('per-user permissions override the role preset', async () => {
      const t = override.token;
      const res = await api('POST', '/clients', { ...base(), email: testEmail('overridec') }, { token });
      expectStatus(res, 201);
      extraClients.push(res.data.id);
      expectStatus(await api('GET', `/clients/${res.data.id}`, undefined, { token: t }), 200);
      expectStatus(await api('PUT', `/clients/${res.data.id}`, { notes: 'x' }, { token: t }), 403);
      expectStatus(await api('DELETE', `/clients/${res.data.id}`, undefined, { token: t }), 200);
      // The dashboard access of the RECRUITER preset is replaced by the override.
      expectStatus(await api('GET', '/dashboard/stats', undefined, { token: t }), 403);
    });
  });
});
