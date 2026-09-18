import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { createCandidate, createTrackingIndustry, deleteCandidate, sentEmails } from './_recruitment';

describe('document-requests', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let candidate: any;
  let otherCandidateId: string;
  let industry: any;
  let trackingId: string;
  let otherTrackingId: string;
  let requestId: string;

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
    candidate = await createCandidate(token);
    otherCandidateId = (await createCandidate(token)).id;
    industry = await createTrackingIndustry(token);
    const t1 = await api('POST', '/candidate-tracking', { candidateId: candidate.id, industry: industry.key }, { token });
    expectStatus(t1, 201);
    trackingId = t1.data.id;
    const t2 = await api('POST', '/candidate-tracking', { candidateId: otherCandidateId, industry: industry.key }, { token });
    expectStatus(t2, 201);
    otherTrackingId = t2.data.id;
  });

  after(async () => {
    if (requestId) await api('DELETE', `/document-requests/${requestId}`, undefined, { token });
    if (candidate) await deleteCandidate(token, candidate.id); // cascades tracking + requests
    if (otherCandidateId) await deleteCandidate(token, otherCandidateId);
    if (industry) await api('DELETE', `/industries/${industry.id}`, undefined, { token });
    await recruiter?.cleanup();
  });

  test('requires a staff token', async () => {
    expectStatus(await api('GET', '/document-requests?candidateId=x'), 401);
    expectStatus(await api('POST', '/document-requests', {}), 401);
    expectStatus(await api('GET', '/document-requests/x'), 401);
    expectStatus(await api('DELETE', '/document-requests/x'), 401);
    expectStatus(await api('GET', '/document-requests/x/download'), 401);
    expectStatus(await api('POST', '/document-requests/x/verify', {}), 401);
    expectStatus(await api('PATCH', '/document-requests/x/visibility', {}), 401);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/document-requests', { candidateId: candidate.id }, { token }), 400);
    expectStatus(await api('POST', '/document-requests', { title: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/document-requests', { candidateId: 'does-not-exist', title: 'x' }, { token }), 404);
    expectStatus(await api('POST', '/document-requests', { candidateId: candidate.id, title: 'x', trackingId: otherTrackingId }, { token }), 400);
    expectStatus(await api('POST', '/document-requests', { candidateId: candidate.id, title: 'x', description: { html: true } }, { token }), 400);
  });

  test('create requests a document; protected fields ignored; email escapes the description (regression)', async () => {
    const res = await api('POST', '/document-requests', {
      candidateId: candidate.id, trackingId, title: `Passport ${TAG}`,
      description: '<script>alert(1)</script> & "clear" scan',
      status: 'VERIFIED', visibleToCompany: true, filePath: 'uploads/documents/x.pdf', requestedByUserId: 'hijack',
    }, { token });
    expectStatus(res, 201);
    requestId = res.data.id;
    assert.equal(res.data.status, 'REQUESTED');
    assert.equal(res.data.visibleToCompany, false);
    assert.equal(res.data.filePath, null);
    assert.notEqual(res.data.requestedByUserId, 'hijack');
    assert.equal(res.data.trackingId, trackingId);

    const mails = await sentEmails(token, candidate.email);
    const mail = mails.find((m) => (m.html || '').includes(`Passport ${TAG}`));
    assert.ok(mail, 'document request email was sent');
    assert.ok(!mail.html.includes('<script>'), 'raw script tag must not reach the email');
    assert.ok(mail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;clear&quot; scan'));
  });

  test('list requires candidateId and filters by tracking', async () => {
    expectStatus(await api('GET', '/document-requests', undefined, { token }), 400);
    const res = await api('GET', `/document-requests?candidateId=${candidate.id}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].requestedByUser.name.length > 0, true);
    const byTracking = await api('GET', `/document-requests?candidateId=${candidate.id}&trackingId=${otherTrackingId}`, undefined, { token });
    assert.equal(byTracking.data.length, 0);
  });

  test('get and 404', async () => {
    const res = await api('GET', `/document-requests/${requestId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.candidate.id, candidate.id);
    expectStatus(await api('GET', '/document-requests/does-not-exist', undefined, { token }), 404);
  });

  test('download is 404 until a file is uploaded', async () => {
    expectStatus(await api('GET', `/document-requests/${requestId}/download`, undefined, { token }), 404);
    expectStatus(await api('GET', '/document-requests/does-not-exist/download', undefined, { token }), 404);
  });

  test('verify validation: boolean required, only uploaded docs, 404', async () => {
    expectStatus(await api('POST', `/document-requests/${requestId}/verify`, {}, { token }), 400);
    expectStatus(await api('POST', `/document-requests/${requestId}/verify`, { approved: 'yes' }, { token }), 400);
    const notUploaded = await api('POST', `/document-requests/${requestId}/verify`, { approved: true }, { token });
    expectStatus(notUploaded, 400);
    assert.match(notUploaded.data.error, /uploaded/);
    expectStatus(await api('POST', '/document-requests/does-not-exist/verify', { approved: true }, { token }), 404);
  });

  test('visibility toggle', async () => {
    expectStatus(await api('PATCH', `/document-requests/${requestId}/visibility`, {}, { token }), 400);
    const on = await api('PATCH', `/document-requests/${requestId}/visibility`, { visibleToCompany: true }, { token });
    expectStatus(on, 200);
    assert.equal(on.data.visibleToCompany, true);
    const off = await api('PATCH', `/document-requests/${requestId}/visibility`, { visibleToCompany: false, status: 'VERIFIED' }, { token });
    assert.equal(off.data.visibleToCompany, false);
    assert.equal(off.data.status, 'REQUESTED');
    expectStatus(await api('PATCH', '/document-requests/does-not-exist/visibility', { visibleToCompany: true }, { token }), 404);
  });

  test('delete requires an admin; then 404', async () => {
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token: recruiter.token }), 403);
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token }), 404);
    requestId = '';
  });
});

describe('document-requests RBAC', () => {
  let admin: string;
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  let candidateId: string;
  let requestId: string;

  before(async () => {
    admin = await adminAuth();
    staff = await staffUsers('VIEWER', 'RECRUITER', 'HR', 'ACCOUNTANT', 'ADMIN');
    custom = await staffWithCustomRole({ documents: ['view', 'delete'] });
    candidateId = (await createCandidate(admin)).id;
  });

  after(async () => {
    if (requestId) await api('DELETE', `/document-requests/${requestId}`, undefined, { token: admin });
    if (candidateId) await deleteCandidate(admin, candidateId);
    await staff?.cleanup();
    await custom?.cleanup();
  });

  test('RECRUITER can request, toggle visibility but not delete', async () => {
    const token = staff.users.RECRUITER.token;
    const res = await api('POST', '/document-requests', { candidateId, title: `RBAC ${TAG}` }, { token });
    expectStatus(res, 201);
    requestId = res.data.id;
    expectStatus(await api('PATCH', `/document-requests/${requestId}/visibility`, { visibleToCompany: false }, { token }), 200);
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token }), 403);
  });

  test('VIEWER can read (via candidates view) but not create, verify or delete', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', `/document-requests?candidateId=${candidateId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/document-requests/${requestId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/document-requests/${requestId}/download`, undefined, { token }), 404); // passes the check, no file yet
    expectStatus(await api('POST', '/document-requests', { candidateId, title: 'x' }, { token }), 403);
    expectStatus(await api('POST', `/document-requests/${requestId}/verify`, { approved: true }, { token }), 403);
    expectStatus(await api('PATCH', `/document-requests/${requestId}/visibility`, { visibleToCompany: true }, { token }), 403);
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token }), 403);
  });

  test('HR works through the documents permission; ACCOUNTANT has none', async () => {
    expectStatus(await api('GET', `/document-requests/${requestId}`, undefined, { token: staff.users.HR.token }), 200);
    expectStatus(await api('POST', '/document-requests/does-not-exist/verify', { approved: true }, { token: staff.users.HR.token }), 404);
    expectStatus(await api('GET', `/document-requests/${requestId}`, undefined, { token: staff.users.ACCOUNTANT.token }), 403);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', `/document-requests/${requestId}`, undefined, { token }), 200);
    expectStatus(await api('POST', '/document-requests', { candidateId, title: 'x' }, { token }), 403);
    expectStatus(await api('DELETE', '/document-requests/does-not-exist', undefined, { token }), 404); // allowed to delete
  });

  test('ADMIN can delete', async () => {
    expectStatus(await api('DELETE', `/document-requests/${requestId}`, undefined, { token: staff.users.ADMIN.token }), 200);
    requestId = '';
  });
});
