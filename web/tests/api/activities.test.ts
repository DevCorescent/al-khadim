import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus } from './_client';
import { createClient, db, purgeClient } from './_crmdb';

describe('activities', () => {
  let token: string;
  let clientId: string;
  let otherClientId: string;
  let dealId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token, 'Activities')).id;
    otherClientId = (await createClient(token, 'Activities Other')).id;
    const deal = await api('POST', '/deals', { title: `Act deal ${TAG}`, clientId }, { token });
    expectStatus(deal, 201);
    dealId = deal.data.id;
  });

  after(async () => {
    await purgeClient(clientId);
    await purgeClient(otherClientId);
    await db.$disconnect();
  });

  test('requires a staff token', async () => {
    expectStatus(await api('GET', `/activities?clientId=${clientId}`), 401);
    expectStatus(await api('POST', '/activities', { clientId, content: 'x' }), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/activities', { content: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/activities', { clientId, content: '   ' }, { token }), 400);
    expectStatus(await api('POST', '/activities', { clientId, content: 'x', type: 'BOGUS' }, { token }), 400);
    // Server-only types can't be forged.
    expectStatus(await api('POST', '/activities', { clientId, content: 'x', type: 'STAGE_CHANGE' }, { token }), 400);
    expectStatus(await api('POST', '/activities', { clientId, content: 'x', dealId: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/activities', { clientId: otherClientId, content: 'x', dealId }, { token }), 400);
    expectStatus(await api('POST', '/activities', { clientId: 'nope', content: 'x' }, { token }), 400);
  });

  test('logs a note and a deal call (ignoring extra fields)', async () => {
    const note = await api('POST', '/activities', { clientId, content: 'Hello', createdBy: 'hacker', metadata: { a: 1 } }, { token });
    expectStatus(note, 201);
    assert.equal(note.data.type, 'NOTE');
    assert.notEqual(note.data.createdBy, 'hacker');
    assert.equal(note.data.metadata, null);
    assert.ok(note.data.createdByUser);
    const call = await api('POST', '/activities', { clientId, dealId, type: 'CALL', content: 'Called' }, { token });
    expectStatus(call, 201);
    assert.equal(call.data.dealId, dealId);
  });

  test('lists by client or deal with paging', async () => {
    expectStatus(await api('GET', '/activities', undefined, { token }), 400);
    const byClient = await api('GET', `/activities?clientId=${clientId}`, undefined, { token });
    expectStatus(byClient, 200);
    assert.equal(byClient.data.total, 3); // SYSTEM (deal created) + note + call
    const byDeal = await api('GET', `/activities?dealId=${dealId}&limit=1&page=2`, undefined, { token });
    expectStatus(byDeal, 200);
    assert.equal(byDeal.data.total, 2);
    assert.equal(byDeal.data.data.length, 1);
    assert.equal(byDeal.data.page, 2);
    assert.equal(byDeal.data.data[0].deal.id, dealId);
  });
});
