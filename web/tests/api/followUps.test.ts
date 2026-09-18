import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus } from './_client';
import { createClient, db, purgeClient } from './_crmdb';

describe('follow-ups', () => {
  let token: string;
  let clientId: string;
  let followUpId: string;
  let noClientId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token, 'FollowUps')).id;
  });

  after(async () => {
    if (noClientId) await db.followUp.deleteMany({ where: { id: noClientId } });
    await purgeClient(clientId);
    await db.$disconnect();
  });

  test('requires a staff token on every endpoint', async () => {
    expectStatus(await api('GET', '/follow-ups'), 401);
    expectStatus(await api('POST', '/follow-ups', {}), 401);
    expectStatus(await api('PUT', '/follow-ups/x', {}), 401);
    expectStatus(await api('DELETE', '/follow-ups/x'), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/follow-ups', { dueDate: '2026-10-01T10:00' }, { token }), 400);
    expectStatus(await api('POST', '/follow-ups', { subject: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/follow-ups', { subject: 'x', dueDate: 'tomorrow' }, { token }), 400);
    expectStatus(await api('POST', '/follow-ups', { subject: 'x', dueDate: '2026-10-01', type: 'FAX' }, { token }), 400);
    expectStatus(await api('POST', '/follow-ups', { subject: 'x', dueDate: '2026-10-01', clientId: 'nope' }, { token }), 400);
  });

  test('creates a follow-up (form payload, extra fields ignored)', async () => {
    const res = await api('POST', '/follow-ups', {
      subject: `Call ${TAG}`, type: 'CALL', dueDate: '2026-10-01T10:00', clientId, notes: '',
      completedAt: '2020-01-01', id: 'custom',
    }, { token });
    expectStatus(res, 201);
    followUpId = res.data.id;
    assert.notEqual(followUpId, 'custom');
    assert.equal(res.data.completedAt, null);
    assert.equal(res.data.isCompleted, false);
    assert.ok(res.data.assignedTo, 'defaults to the current user');
    // Empty client select from the form means "no client" instead of a FK error.
    const noClient = await api('POST', '/follow-ups', { subject: `Solo ${TAG}`, dueDate: '2026-10-02', clientId: '' }, { token });
    expectStatus(noClient, 201);
    noClientId = noClient.data.id;
    assert.equal(noClient.data.clientId, null);
  });

  test('lists with filters', async () => {
    const res = await api('GET', `/follow-ups?clientId=${clientId}&isCompleted=false`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].client.id, clientId);
    const done = await api('GET', `/follow-ups?clientId=${clientId}&isCompleted=true`, undefined, { token });
    assert.equal(done.data.length, 0);
  });

  test('completing sets completedAt; partial update keeps other fields', async () => {
    const res = await api('PUT', `/follow-ups/${followUpId}`, { isCompleted: true }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.isCompleted, true);
    assert.ok(res.data.completedAt);
    assert.equal(res.data.subject, `Call ${TAG}`);
    assert.equal(res.data.clientId, clientId);
    const reopen = await api('PUT', `/follow-ups/${followUpId}`, { isCompleted: false }, { token });
    assert.equal(reopen.data.completedAt, null);
  });

  test('update validates and 404s', async () => {
    expectStatus(await api('PUT', `/follow-ups/${followUpId}`, { dueDate: 'never' }, { token }), 400);
    expectStatus(await api('PUT', `/follow-ups/${followUpId}`, { subject: '' }, { token }), 400);
    expectStatus(await api('PUT', '/follow-ups/does-not-exist', { notes: 'x' }, { token }), 404);
  });

  test('deletes, then 404', async () => {
    expectStatus(await api('DELETE', `/follow-ups/${followUpId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/follow-ups/${followUpId}`, undefined, { token }), 404);
  });
});
