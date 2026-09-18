import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { createCandidate, createClient, createJob, deleteCandidate } from './_recruitment';

describe('interviews', () => {
  let token: string;
  let clientId: string;
  let jobId: string;
  let candidateId: string;
  let interviewId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token)).id;
    jobId = (await createJob(token, clientId)).id;
    candidateId = (await createCandidate(token)).id;
  });

  after(async () => {
    if (interviewId) await api('DELETE', `/interviews/${interviewId}`, undefined, { token });
    if (candidateId) await deleteCandidate(token, candidateId);
    if (jobId) await api('DELETE', `/jobs/${jobId}`, undefined, { token });
    if (clientId) await api('DELETE', `/clients/${clientId}`, undefined, { token });
  });

  test('requires a staff token', async () => {
    expectStatus(await api('GET', '/interviews'), 401);
    expectStatus(await api('POST', '/interviews', {}), 401);
    expectStatus(await api('PUT', '/interviews/x', {}), 401);
    expectStatus(await api('DELETE', '/interviews/x'), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/interviews', { jobId, scheduledAt: '2026-11-01T10:00' }, { token }), 400);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId }, { token }), 400);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId, scheduledAt: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId, scheduledAt: '2026-11-01T10:00', mode: 'HYBRID' }, { token }), 400);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId, scheduledAt: '2026-11-01T10:00', rating: 9 }, { token }), 400);
    expectStatus(await api('POST', '/interviews', { candidateId: 'does-not-exist', jobId, scheduledAt: '2026-11-01T10:00' }, { token }), 400);
  });

  test('create (form payload) ignores protected fields', async () => {
    const res = await api('POST', '/interviews', {
      candidateId, jobId, scheduledAt: '2026-11-01T10:00', type: 'VIDEO', status: 'SCHEDULED',
      interviewers: 'a@example.test, b@example.test', profileShareId: 'hijack', id: 'hijack',
    }, { token });
    expectStatus(res, 201);
    interviewId = res.data.id;
    assert.notEqual(interviewId, 'hijack');
    assert.equal(res.data.profileShareId, null);
    assert.deepEqual(res.data.interviewers, ['a@example.test', 'b@example.test']);
    assert.equal(res.data.candidate.id, candidateId);
    assert.equal(res.data.job.client.id, clientId);
    assert.equal(res.data.mode, 'ONLINE');
  });

  test('list filters and paginates', async () => {
    const res = await api('GET', `/interviews?candidateId=${candidateId}&limit=50`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.limit, 50);
    assert.equal(res.data.data[0].id, interviewId);
    assert.ok(res.data.data[0].job.client.companyName);
    const byJob = await api('GET', `/interviews?jobId=${jobId}&status=SCHEDULED`, undefined, { token });
    assert.equal(byJob.data.total, 1);
    const bad = await api('GET', '/interviews?page=x&limit=y', undefined, { token });
    expectStatus(bad, 200);
  });

  test('update is partial and converts rating (edit form sends strings)', async () => {
    const res = await api('PUT', `/interviews/${interviewId}`, { status: 'COMPLETED', rating: '4', feedback: 'Good' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'COMPLETED');
    assert.equal(res.data.rating, 4);
    assert.equal(res.data.type, 'VIDEO');
    const cleared = await api('PUT', `/interviews/${interviewId}`, { rating: '' }, { token });
    expectStatus(cleared, 200);
    assert.equal(cleared.data.rating, null);
    assert.equal(cleared.data.feedback, 'Good');
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/interviews/${interviewId}`, { scheduledAt: 'nope' }, { token }), 400);
    expectStatus(await api('PUT', `/interviews/${interviewId}`, { rating: 'abc' }, { token }), 400);
    expectStatus(await api('PUT', `/interviews/${interviewId}`, { candidateId: 'does-not-exist' }, { token }), 400);
    const ignored = await api('PUT', `/interviews/${interviewId}`, { profileShareId: 'hijack' }, { token });
    expectStatus(ignored, 200);
    assert.equal(ignored.data.profileShareId, null);
    expectStatus(await api('PUT', '/interviews/does-not-exist', { status: 'X' }, { token }), 404);
  });

  test('delete and 404', async () => {
    expectStatus(await api('DELETE', `/interviews/${interviewId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/interviews/${interviewId}`, undefined, { token }), 404);
    interviewId = '';
  });
});

describe('interviews RBAC', () => {
  let admin: string;
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  let clientId: string;
  let jobId: string;
  let candidateId: string;
  let interviewId: string;

  before(async () => {
    admin = await adminAuth();
    staff = await staffUsers('VIEWER', 'RECRUITER', 'MANAGER');
    custom = await staffWithCustomRole({ interviews: ['view'] });
    clientId = (await createClient(admin)).id;
    jobId = (await createJob(admin, clientId)).id;
    candidateId = (await createCandidate(admin)).id;
  });

  after(async () => {
    if (interviewId) await api('DELETE', `/interviews/${interviewId}`, undefined, { token: admin });
    if (candidateId) await deleteCandidate(admin, candidateId);
    if (jobId) await api('DELETE', `/jobs/${jobId}`, undefined, { token: admin });
    if (clientId) await api('DELETE', `/clients/${clientId}`, undefined, { token: admin });
    await staff?.cleanup();
    await custom?.cleanup();
  });

  test('VIEWER has no interview access', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', '/interviews', undefined, { token }), 403);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId, scheduledAt: '2026-11-01T10:00' }, { token }), 403);
    expectStatus(await api('PUT', '/interviews/x', { status: 'COMPLETED' }, { token }), 403);
    expectStatus(await api('DELETE', '/interviews/x', undefined, { token }), 403);
  });

  test('RECRUITER can create, list and edit but not delete', async () => {
    const token = staff.users.RECRUITER.token;
    const created = await api('POST', '/interviews', { candidateId, jobId, scheduledAt: '2026-11-01T10:00' }, { token });
    expectStatus(created, 201);
    interviewId = created.data.id;
    expectStatus(await api('GET', `/interviews?candidateId=${candidateId}`, undefined, { token }), 200);
    expectStatus(await api('PUT', `/interviews/${interviewId}`, { status: 'COMPLETED' }, { token }), 200);
    expectStatus(await api('DELETE', `/interviews/${interviewId}`, undefined, { token }), 403);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', `/interviews?candidateId=${candidateId}`, undefined, { token }), 200);
    expectStatus(await api('POST', '/interviews', { candidateId, jobId, scheduledAt: '2026-11-01T10:00' }, { token }), 403);
    expectStatus(await api('PUT', `/interviews/${interviewId}`, { status: 'SCHEDULED' }, { token }), 403);
    expectStatus(await api('DELETE', `/interviews/${interviewId}`, undefined, { token }), 403);
  });

  test('MANAGER can delete', async () => {
    expectStatus(await api('DELETE', `/interviews/${interviewId}`, undefined, { token: staff.users.MANAGER.token }), 200);
    interviewId = '';
  });
});
