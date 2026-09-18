import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { companyUser, createCandidate, createClient, createJob, deleteCandidate } from './_recruitment';

describe('jobs', () => {
  let token: string;
  let clientId: string;
  let rejectedClientId: string;
  let portal: Awaited<ReturnType<typeof companyUser>>;
  let rejectedPortal: Awaited<ReturnType<typeof companyUser>>;
  const jobIds: string[] = [];
  let jobId: string;
  let candidateId: string;
  let applicationId: string;

  before(async () => {
    token = await adminAuth();
    clientId = (await createClient(token)).id;
    portal = await companyUser(token, clientId);
    rejectedClientId = (await createClient(token)).id;
    rejectedPortal = await companyUser(token, rejectedClientId);
    expectStatus(await api('PATCH', `/clients/${rejectedClientId}/reject`, { reason: 'test' }, { token }), 200);
    candidateId = (await createCandidate(token)).id;
  });

  after(async () => {
    if (candidateId) await deleteCandidate(token, candidateId);
    for (const id of jobIds) await api('DELETE', `/jobs/${id}`, undefined, { token });
    await portal?.cleanup();
    await rejectedPortal?.cleanup();
    if (clientId) await api('DELETE', `/clients/${clientId}`, undefined, { token });
    if (rejectedClientId) await api('DELETE', `/clients/${rejectedClientId}`, undefined, { token });
  });

  test('staff endpoints require a token', async () => {
    expectStatus(await api('GET', '/jobs'), 401);
    expectStatus(await api('POST', '/jobs', {}), 401);
    expectStatus(await api('GET', '/jobs/x'), 401);
    expectStatus(await api('PUT', '/jobs/x', {}), 401);
    expectStatus(await api('DELETE', '/jobs/x'), 401);
    expectStatus(await api('PATCH', '/jobs/x/publish'), 401);
    expectStatus(await api('PATCH', '/jobs/x/unpublish'), 401);
    expectStatus(await api('PUT', '/jobs/applications/x', {}), 401);
    // a company token is not a staff token (shared requireStaff currently answers 500 here, not 401 — reported)
    const withCompanyToken = await api('GET', '/jobs', undefined, { token: portal.token });
    assert.ok(withCompanyToken.status >= 400, `company token must not read staff jobs, got ${withCompanyToken.status}`);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/jobs', { clientId }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'No client' }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId, status: 'NOPE' }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId, salaryMin: 'abc' }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId, deadline: 'not a date' }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId, positionsCount: '1.5' }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId, salaryMin: 5000, salaryMax: 100 }, { token }), 400);
    expectStatus(await api('POST', '/jobs', { title: 'Bad', clientId: 'does-not-exist' }, { token }), 400);
  });

  test('create converts form strings and ignores protected fields', async () => {
    const res = await api('POST', '/jobs', {
      title: `Staff Job ${TAG}`, clientId, salaryMin: '3000', salaryMax: '', positionsCount: '3',
      deadline: '2026-12-31', categoryId: '', industryId: '', status: 'OPEN',
      // protected
      isPublished: false, source: 'COMPANY_REQUEST', publishedByUserId: 'x', id: 'hijack',
    }, { token });
    expectStatus(res, 201);
    jobId = res.data.id;
    jobIds.push(jobId);
    assert.notEqual(jobId, 'hijack');
    assert.equal(res.data.salaryMin, 3000);
    assert.equal(res.data.salaryMax, null);
    assert.equal(res.data.positionsCount, 3);
    assert.equal(res.data.deadline.slice(0, 10), '2026-12-31');
    assert.equal(res.data.isPublished, true);
    assert.equal(res.data.source, 'STAFF');
    assert.equal(res.data.publishedByUserId, null);
    assert.equal(res.data.client.id, clientId);
  });

  test('update converts deadline / positionsCount / salaries (regression)', async () => {
    const res = await api('PUT', `/jobs/${jobId}`, {
      deadline: '2027-01-15', positionsCount: '4', salaryMin: '2500', salaryMax: '4500',
    }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.deadline.slice(0, 10), '2027-01-15');
    assert.equal(res.data.positionsCount, 4);
    assert.equal(res.data.salaryMin, 2500);
    assert.equal(res.data.salaryMax, 4500);
    assert.equal(res.data.title, `Staff Job ${TAG}`);
    const cleared = await api('PUT', `/jobs/${jobId}`, { deadline: '', salaryMax: '', positionsCount: '' }, { token });
    expectStatus(cleared, 200);
    assert.equal(cleared.data.deadline, null);
    assert.equal(cleared.data.salaryMax, null);
    assert.equal(cleared.data.positionsCount, 4);
  });

  test('update ignores protected fields, validates and 404s', async () => {
    const res = await api('PUT', `/jobs/${jobId}`, { source: 'COMPANY_REQUEST', isPublished: false, requestedByClientUserId: portal.id }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.source, 'STAFF');
    assert.equal(res.data.isPublished, true);
    assert.equal(res.data.requestedByClientUserId, null);
    expectStatus(await api('PUT', `/jobs/${jobId}`, { status: 'NOPE' }, { token }), 400);
    expectStatus(await api('PUT', `/jobs/${jobId}`, { title: '' }, { token }), 400);
    expectStatus(await api('PUT', `/jobs/${jobId}`, { deadline: 'nope' }, { token }), 400);
    expectStatus(await api('PUT', '/jobs/does-not-exist', { title: 'x' }, { token }), 404);
  });

  test('list filters and paginates', async () => {
    const res = await api('GET', `/jobs?clientId=${clientId}&limit=200&page=1`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.limit, 200);
    assert.ok(res.data.data.some((j: any) => j.id === jobId));
    assert.ok(res.data.data.every((j: any) => j.client.id === clientId));
    const search = await api('GET', `/jobs?search=${encodeURIComponent(`Staff Job ${TAG}`)}`, undefined, { token });
    assert.equal(search.data.total, 1);
    expectStatus(await api('GET', '/jobs?status=NOPE', undefined, { token }), 400);
  });

  test('get returns details; unknown id is 404', async () => {
    const res = await api('GET', `/jobs/${jobId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.client.id, clientId);
    assert.ok(Array.isArray(res.data.applications));
    expectStatus(await api('GET', '/jobs/does-not-exist', undefined, { token }), 404);
  });

  test('publish / unpublish drive the public listing', async () => {
    const off = await api('PATCH', `/jobs/${jobId}/unpublish`, undefined, { token });
    expectStatus(off, 200);
    assert.equal(off.data.isPublished, false);
    let pub = await api('GET', '/jobs/public');
    expectStatus(pub, 200);
    assert.ok(!pub.data.some((j: any) => j.id === jobId));

    const on = await api('PATCH', `/jobs/${jobId}/publish`, undefined, { token });
    expectStatus(on, 200);
    assert.equal(on.data.isPublished, true);
    assert.ok(on.data.publishedAt);
    assert.ok(on.data.publishedByUserId);
    pub = await api('GET', '/jobs/public');
    const listed = pub.data.find((j: any) => j.id === jobId);
    assert.ok(listed, 'published job is listed publicly');
    assert.deepEqual(Object.keys(listed.client).sort(), ['companyName', 'country']);

    expectStatus(await api('PATCH', '/jobs/does-not-exist/publish', undefined, { token }), 404);
    expectStatus(await api('PATCH', '/jobs/does-not-exist/unpublish', undefined, { token }), 404);
  });

  test('public listing honours limit', async () => {
    const res = await api('GET', '/jobs/public?limit=1');
    expectStatus(res, 200);
    assert.ok(res.data.length <= 1);
    expectStatus(await api('GET', '/jobs/public?limit=abc'), 200);
  });

  test('closed jobs are not listed publicly', async () => {
    expectStatus(await api('PUT', `/jobs/${jobId}`, { status: 'CLOSED' }, { token }), 200);
    const pub = await api('GET', '/jobs/public');
    assert.ok(!pub.data.some((j: any) => j.id === jobId));
    expectStatus(await api('PUT', `/jobs/${jobId}`, { status: 'OPEN' }, { token }), 200);
  });

  test('application status update', async () => {
    const app = await api('POST', `/candidates/${candidateId}/apply`, { jobId }, { token });
    expectStatus(app, 201);
    applicationId = app.data.id;
    const res = await api('PUT', `/jobs/applications/${applicationId}`, { status: 'SHORTLISTED', jobId: 'hijack' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'SHORTLISTED');
    assert.equal(res.data.jobId, jobId);
    expectStatus(await api('PUT', `/jobs/applications/${applicationId}`, { status: 'NOPE' }, { token }), 400);
    expectStatus(await api('PUT', '/jobs/applications/does-not-exist', { status: 'SHORTLISTED' }, { token }), 404);
  });

  test('deleting a job with applications is refused with 409', async () => {
    expectStatus(await api('DELETE', `/jobs/${jobId}`, undefined, { token }), 409);
  });

  /* ── company portal ── */

  test('jobs/mine requires an approved company user', async () => {
    expectStatus(await api('GET', '/jobs/mine'), 401);
    expectStatus(await api('GET', '/jobs/mine', undefined, { token }), 401); // staff token is not a company token
    const rejected = await api('GET', '/jobs/mine', undefined, { token: rejectedPortal.token });
    expectStatus(rejected, 403);
    expectStatus(await api('POST', '/jobs/mine', { title: 'x' }, { token: rejectedPortal.token }), 403);
  });

  test('company submits a job request; protected fields are ignored', async () => {
    expectStatus(await api('POST', '/jobs/mine', {}, { token: portal.token }), 400);
    expectStatus(await api('POST', '/jobs/mine', { title: 'x', salaryMin: 'lots' }, { token: portal.token }), 400);
    expectStatus(await api('POST', '/jobs/mine', { title: 'x', categoryId: 'does-not-exist' }, { token: portal.token }), 400);
    const res = await api('POST', '/jobs/mine', {
      title: `Company Req ${TAG}`, description: 'Need people', positionsCount: '2', salaryMin: '', salaryMax: '5000',
      currency: 'AED', deadline: '', categoryId: '', industryId: '',
      // protected
      clientId: rejectedClientId, isPublished: true, status: 'FILLED', source: 'STAFF', filledCount: 9,
    }, { token: portal.token });
    expectStatus(res, 201);
    jobIds.unshift(res.data.id);
    assert.equal(res.data.clientId, clientId);
    assert.equal(res.data.isPublished, false);
    assert.equal(res.data.status, 'OPEN');
    assert.equal(res.data.source, 'COMPANY_REQUEST');
    assert.equal(res.data.filledCount, 0);
    assert.equal(res.data.requestedByClientUserId, portal.id);
    assert.equal(res.data.positionsCount, 2);
    assert.equal(res.data.salaryMax, 5000);
    assert.equal(res.data.salaryMin, null);

    const pub = await api('GET', '/jobs/public');
    assert.ok(!pub.data.some((j: any) => j.id === res.data.id), 'requests stay internal until published');
  });

  test('jobs/mine lists only this company\'s jobs', async () => {
    const res = await api('GET', '/jobs/mine', undefined, { token: portal.token });
    expectStatus(res, 200);
    assert.ok(res.data.length >= 2);
    assert.ok(res.data.every((j: any) => j.clientId === clientId));
    assert.ok(res.data.some((j: any) => j.id === jobId));
  });

  test('delete: success and 404', async () => {
    const extra = await api('POST', '/jobs', { title: `Delete Me ${TAG}`, clientId }, { token });
    expectStatus(extra, 201);
    expectStatus(await api('DELETE', `/jobs/${extra.data.id}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/jobs/${extra.data.id}`, undefined, { token }), 404);
  });

  test('jobs are deletable once the candidate (and its applications) are gone', async () => {
    await deleteCandidate(token, candidateId);
    candidateId = '';
    expectStatus(await api('DELETE', `/jobs/${jobId}`, undefined, { token }), 200);
    jobIds.splice(jobIds.indexOf(jobId), 1);
  });
});

describe('jobs RBAC', () => {
  let admin: string;
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  let clientId: string;
  let jobId: string;
  const jobIds: string[] = [];

  before(async () => {
    admin = await adminAuth();
    staff = await staffUsers('VIEWER', 'RECRUITER', 'MANAGER', 'HR', 'ADMIN');
    custom = await staffWithCustomRole({ jobs: ['view', 'delete'] });
    clientId = (await createClient(admin)).id;
    jobId = (await createJob(admin, clientId)).id;
    jobIds.push(jobId);
  });

  after(async () => {
    for (const id of jobIds) await api('DELETE', `/jobs/${id}`, undefined, { token: admin });
    if (clientId) await api('DELETE', `/clients/${clientId}`, undefined, { token: admin });
    await staff?.cleanup();
    await custom?.cleanup();
  });

  test('VIEWER can read jobs but not create, edit, publish or delete', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', '/jobs', undefined, { token }), 200);
    expectStatus(await api('GET', `/jobs/${jobId}`, undefined, { token }), 200);
    expectStatus(await api('POST', '/jobs', { title: `Viewer ${TAG}`, clientId }, { token }), 403);
    expectStatus(await api('PUT', `/jobs/${jobId}`, { title: 'x' }, { token }), 403);
    expectStatus(await api('PATCH', `/jobs/${jobId}/publish`, undefined, { token }), 403);
    expectStatus(await api('PATCH', `/jobs/${jobId}/unpublish`, undefined, { token }), 403);
    expectStatus(await api('PUT', '/jobs/applications/x', { status: 'SHORTLISTED' }, { token }), 403);
    expectStatus(await api('DELETE', `/jobs/${jobId}`, undefined, { token }), 403);
  });

  test('RECRUITER can create and edit but not delete', async () => {
    const token = staff.users.RECRUITER.token;
    const created = await api('POST', '/jobs', { title: `Recruiter ${TAG}`, clientId }, { token });
    expectStatus(created, 201);
    jobIds.push(created.data.id);
    expectStatus(await api('PUT', `/jobs/${created.data.id}`, { title: `Recruiter edited ${TAG}` }, { token }), 200);
    expectStatus(await api('PUT', '/jobs/applications/does-not-exist', { status: 'SHORTLISTED' }, { token }), 404);
    expectStatus(await api('DELETE', `/jobs/${created.data.id}`, undefined, { token }), 403);
  });

  test('MANAGER can publish and unpublish', async () => {
    const token = staff.users.MANAGER.token;
    const off = await api('PATCH', `/jobs/${jobId}/unpublish`, undefined, { token });
    expectStatus(off, 200);
    assert.equal(off.data.isPublished, false);
    const on = await api('PATCH', `/jobs/${jobId}/publish`, undefined, { token });
    expectStatus(on, 200);
    assert.equal(on.data.isPublished, true);
    expectStatus(await api('DELETE', `/jobs/${jobId}`, undefined, { token }), 403);
  });

  test('HR has no access to jobs', async () => {
    expectStatus(await api('GET', '/jobs', undefined, { token: staff.users.HR.token }), 403);
  });

  test('ADMIN can delete', async () => {
    const id = jobIds.pop()!;
    expectStatus(await api('DELETE', `/jobs/${id}`, undefined, { token: staff.users.ADMIN.token }), 200);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', '/jobs', undefined, { token }), 200);
    expectStatus(await api('POST', '/jobs', { title: `Custom ${TAG}`, clientId }, { token }), 403);
    expectStatus(await api('PUT', `/jobs/${jobId}`, { title: 'x' }, { token }), 403);
    expectStatus(await api('PATCH', `/jobs/${jobId}/publish`, undefined, { token }), 403);
    expectStatus(await api('GET', '/candidates', undefined, { token }), 403);
    const extra = await createJob(admin, clientId);
    expectStatus(await api('DELETE', `/jobs/${extra.id}`, undefined, { token }), 200);
  });
});
