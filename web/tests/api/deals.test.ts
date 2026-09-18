import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { createClient, db, purgeClient } from './_crmdb';

describe('deals', () => {
  let token: string;
  let clientId: string;
  let dealId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token, 'Deals')).id;
  });

  after(async () => {
    await purgeClient(clientId);
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/deals'), 401);
    expectStatus(await api('POST', '/deals', {}), 401);
    expectStatus(await api('GET', '/deals/stats'), 401);
    expectStatus(await api('GET', '/deals/x'), 401);
    expectStatus(await api('PUT', '/deals/x', {}), 401);
    expectStatus(await api('PATCH', '/deals/x/stage', {}), 401);
    expectStatus(await api('DELETE', '/deals/x'), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/deals', { clientId }, { token }), 400);
    expectStatus(await api('POST', '/deals', { title: 'x', clientId: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/deals', { title: 'x', clientId, stage: 'BOGUS' }, { token }), 400);
    expectStatus(await api('POST', '/deals', { title: 'x', clientId, value: 'lots' }, { token }), 400);
    expectStatus(await api('POST', '/deals', { title: 'x', clientId, expectedCloseDate: 'soon' }, { token }), 400);
  });

  test('creates a deal and logs a SYSTEM activity', async () => {
    const res = await api('POST', '/deals', {
      title: `Deal ${TAG}`, clientId, value: '5000', stage: 'QUALIFIED', expectedCloseDate: '2026-12-01',
      probability: 99, createdBy: 'hacker',
    }, { token });
    expectStatus(res, 201);
    dealId = res.data.id;
    assert.equal(res.data.value, 5000);
    assert.equal(res.data.probability, 25);
    assert.equal(res.data.currency, 'AED');
    assert.notEqual(res.data.createdBy, 'hacker');
    const acts = await api('GET', `/activities?dealId=${dealId}`, undefined, { token });
    assert.equal(acts.data.data[0].type, 'SYSTEM');
  });

  test('lists with filters', async () => {
    const res = await api('GET', `/deals?clientId=${clientId}&limit=100`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.limit, 100);
    assert.equal(res.data.data[0].client.id, clientId);
    const search = await api('GET', `/deals?search=${TAG}&stage=QUALIFIED`, undefined, { token });
    assert.equal(search.data.total, 1);
    const none = await api('GET', `/deals?clientId=${clientId}&stage=WON`, undefined, { token });
    assert.equal(none.data.total, 0);
  });

  test('gets one with activities, 404 for unknown', async () => {
    const res = await api('GET', `/deals/${dealId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.activities.length, 1);
    expectStatus(await api('GET', '/deals/does-not-exist', undefined, { token }), 404);
  });

  test('partial update (title only) keeps the rest', async () => {
    const res = await api('PUT', `/deals/${dealId}`, { title: `Renamed ${TAG}` }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.title, `Renamed ${TAG}`);
    assert.equal(res.data.value, 5000);
    assert.equal(res.data.stage, 'QUALIFIED');
  });

  test('update validates and 404s', async () => {
    expectStatus(await api('PUT', `/deals/${dealId}`, { probability: 150 }, { token }), 400);
    expectStatus(await api('PUT', `/deals/${dealId}`, { value: 'x' }, { token }), 400);
    expectStatus(await api('PUT', `/deals/${dealId}`, { stage: 'BOGUS' }, { token }), 400);
    expectStatus(await api('PUT', `/deals/${dealId}`, { title: '' }, { token }), 400);
    // A bad field must not leave a half-applied stage change.
    expectStatus(await api('PUT', `/deals/${dealId}`, { stage: 'PROPOSAL', value: 'x' }, { token }), 400);
    const still = await api('GET', `/deals/${dealId}`, undefined, { token });
    assert.equal(still.data.stage, 'QUALIFIED');
    expectStatus(await api('PUT', '/deals/does-not-exist', { title: 'x' }, { token }), 404);
  });

  test('update with a stage change adjusts probability and logs it', async () => {
    const res = await api('PUT', `/deals/${dealId}`, { stage: 'NEGOTIATION', probability: '80' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.stage, 'NEGOTIATION');
    assert.equal(res.data.probability, 80);
  });

  test('stage move: validation, LOST needs a reason, WON sets close date', async () => {
    expectStatus(await api('PATCH', `/deals/${dealId}/stage`, {}, { token }), 400);
    expectStatus(await api('PATCH', `/deals/${dealId}/stage`, { stage: 'BOGUS' }, { token }), 400);
    expectStatus(await api('PATCH', `/deals/${dealId}/stage`, { stage: 'LOST' }, { token }), 400);
    expectStatus(await api('PATCH', '/deals/does-not-exist/stage', { stage: 'WON' }, { token }), 404);
    const lost = await api('PATCH', `/deals/${dealId}/stage`, { stage: 'LOST', lossReason: 'Price' }, { token });
    expectStatus(lost, 200);
    assert.equal(lost.data.lossReason, 'Price');
    assert.equal(lost.data.probability, 0);
    const won = await api('PATCH', `/deals/${dealId}/stage`, { stage: 'WON' }, { token });
    expectStatus(won, 200);
    assert.equal(won.data.probability, 100);
    assert.ok(won.data.actualCloseDate);
    assert.equal(won.data.lossReason, null);
    const same = await api('PATCH', `/deals/${dealId}/stage`, { stage: 'WON' }, { token });
    expectStatus(same, 200);
    const detail = await api('GET', `/deals/${dealId}`, undefined, { token });
    assert.equal(detail.data.activities.filter((a: any) => a.type === 'STAGE_CHANGE').length, 3);
  });

  test('stats returns the pipeline shape', async () => {
    const res = await api('GET', '/deals/stats', undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.byStage.length, 6);
    assert.equal(res.data.monthlyWonRevenue.length, 12);
    assert.ok(res.data.wonCount >= 1);
    for (const k of ['totalOpenValue', 'weightedForecast', 'winRate', 'avgDealSize', 'avgSalesCycleDays']) {
      assert.equal(typeof res.data[k], 'number');
    }
  });

  test('deletes, then 404', async () => {
    expectStatus(await api('DELETE', `/deals/${dealId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/deals/${dealId}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/deals/${dealId}`, undefined, { token }), 404);
  });

  test('RBAC: MANAGER creates/edits deals and activities; VIEWER and RECRUITER only read', async () => {
    const manager = await staffWithRole('MANAGER');
    const viewer = await staffWithRole('VIEWER');
    const recruiter = await staffWithRole('RECRUITER');
    try {
      const res = await api('POST', '/deals', { title: `Mgr Deal ${TAG}`, clientId }, { token: manager.token });
      expectStatus(res, 201);
      const id = res.data.id;
      expectStatus(await api('PUT', `/deals/${id}`, { title: `Mgr Deal 2 ${TAG}` }, { token: manager.token }), 200);
      expectStatus(await api('PATCH', `/deals/${id}/stage`, { stage: 'QUALIFIED' }, { token: manager.token }), 200);
      expectStatus(await api('POST', '/activities', { clientId, dealId: id, type: 'NOTE', content: 'mgr note' }, { token: manager.token }), 201);
      expectStatus(await api('DELETE', `/deals/${id}`, undefined, { token: manager.token }), 403);

      for (const t of [viewer.token, recruiter.token]) {
        expectStatus(await api('GET', '/deals', undefined, { token: t }), 200);
        expectStatus(await api('GET', '/deals/stats', undefined, { token: t }), 200);
        expectStatus(await api('GET', `/deals/${id}`, undefined, { token: t }), 200);
        expectStatus(await api('GET', `/activities?clientId=${clientId}`, undefined, { token: t }), 200);
        expectStatus(await api('GET', '/follow-ups', undefined, { token: t }), 200);
        expectStatus(await api('POST', '/deals', { title: 'x', clientId }, { token: t }), 403);
        expectStatus(await api('PUT', `/deals/${id}`, { title: 'x' }, { token: t }), 403);
        expectStatus(await api('PATCH', `/deals/${id}/stage`, { stage: 'WON' }, { token: t }), 403);
        expectStatus(await api('DELETE', `/deals/${id}`, undefined, { token: t }), 403);
        expectStatus(await api('POST', '/activities', { clientId, content: 'x' }, { token: t }), 403);
        expectStatus(await api('POST', '/follow-ups', { clientId, title: 'x', dueDate: '2030-01-01' }, { token: t }), 403);
      }
      expectStatus(await api('DELETE', `/deals/${id}`, undefined, { token }), 200);
    } finally {
      await manager.cleanup();
      await viewer.cleanup();
      await recruiter.cleanup();
    }
  });
});
