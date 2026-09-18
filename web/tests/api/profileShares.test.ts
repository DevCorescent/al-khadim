import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, samplePdf, testEmail } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import {
  companyUser, createCandidate, createClient, createJob, createTrackingIndustry, deleteCandidate, sentEmails,
} from './_recruitment';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@alkhadim.ae';

async function uploadCv(token: string, candidateId: string) {
  const fd = new FormData();
  fd.append('cv', samplePdf('Shared CV'), 'shared.pdf');
  expectStatus(await api('PUT', `/candidates/${candidateId}`, fd, { token }), 200);
}

describe('profile-shares', () => {
  let token: string;
  let client: any;
  let otherClient: any;
  let portal: Awaited<ReturnType<typeof companyUser>>;
  let otherPortal: Awaited<ReturnType<typeof companyUser>>;
  let job: any;
  let candidate: any;
  const extraCandidateIds: string[] = [];
  let industry: any;
  let shareId: string;
  let accessToken: string;
  let noJobShareId: string;
  let recipient: string;
  let candidateToken: string;
  let docRequestId: string;

  before(async () => {
    token = await adminAuth();
    client = await createClient(token);
    otherClient = await createClient(token);
    portal = await companyUser(token, client.id);
    otherPortal = await companyUser(token, otherClient.id);
    job = await createJob(token, client.id, { title: `Role <i>${TAG}</i>` });
    candidate = await createCandidate(token, { passportNo: 'P1234567', notes: 'internal only' });
    await uploadCv(token, candidate.id);
    industry = await createTrackingIndustry(token);
  });

  after(async () => {
    for (const id of [candidate?.id, ...extraCandidateIds]) if (id) await deleteCandidate(token, id);
    if (job) await api('DELETE', `/jobs/${job.id}`, undefined, { token });
    await portal?.cleanup();
    await otherPortal?.cleanup();
    for (const c of [client, otherClient]) if (c) await api('DELETE', `/clients/${c.id}`, undefined, { token });
    if (industry) await api('DELETE', `/industries/${industry.id}`, undefined, { token });
  });

  /* ── auth ── */

  test('staff and company endpoints require the right token', async () => {
    expectStatus(await api('GET', '/profile-shares'), 401);
    expectStatus(await api('POST', '/profile-shares', {}), 401);
    expectStatus(await api('POST', '/profile-shares/bulk', {}), 401);
    expectStatus(await api('GET', '/profile-shares/x'), 401);
    expectStatus(await api('POST', '/profile-shares/x/schedule-interview', {}), 401);
    expectStatus(await api('POST', '/profile-shares/x/resend', {}), 401);
    expectStatus(await api('PATCH', '/profile-shares/x/withdraw'), 401);
    expectStatus(await api('GET', '/profile-shares/mine'), 401);
    expectStatus(await api('GET', '/profile-shares/mine', undefined, { token }), 401); // staff token is not a company token
    expectStatus(await api('GET', '/profile-shares/mine/x'), 401);
    expectStatus(await api('POST', '/profile-shares/mine/x/respond', {}), 401);
    expectStatus(await api('GET', '/profile-shares/mine/x/tracking'), 401);
    expectStatus(await api('GET', '/profile-shares/mine/x/document-requests'), 401);
    expectStatus(await api('GET', '/profile-shares/mine/x/documents/cv/download'), 401);
    expectStatus(await api('GET', '/profile-shares/mine/x/document-requests/y/download'), 401);
  });

  /* ── create ── */

  test('create validates input', async () => {
    const base = { candidateId: candidate.id, clientId: client.id, sharedFields: ['firstName'] };
    expectStatus(await api('POST', '/profile-shares', { clientId: client.id, sharedFields: ['firstName'] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, sharedFields: [] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, sharedFields: ['notes', 'cvId'] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, sharedFields: 'firstName' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, method: 'FAX' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, toEmail: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, jobId: job.id, clientId: otherClient.id }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares', { ...base, candidateId: 'does-not-exist' }, { token }), 404);
    expectStatus(await api('POST', '/profile-shares', { ...base, clientId: 'does-not-exist' }, { token }), 404);
  });

  test('create shares a snapshot, ignores protected fields and escapes the email (regression)', async () => {
    recipient = testEmail('share-recipient');
    const res = await api('POST', '/profile-shares', {
      candidateId: candidate.id, clientId: client.id, jobId: job.id,
      sharedFields: ['firstName', 'lastName', 'email', 'passportNo', 'notes', 'cvId'],
      sharedDocumentIds: ['cv'], method: 'BOTH', toEmail: recipient,
      message: 'Hello <b>team</b> & "friends"', notes: 'staff note',
      // protected
      status: 'SHORTLISTED', accessToken: 'hijack', sentByUserId: 'hijack', tokenExpiresAt: '2000-01-01',
    }, { token });
    expectStatus(res, 201);
    shareId = res.data.id;
    assert.equal(res.data.status, 'SENT');
    assert.notEqual(res.data.accessToken, 'hijack');
    assert.notEqual(res.data.sentByUserId, 'hijack');
    assert.ok(new Date(res.data.tokenExpiresAt) > new Date());
    assert.deepEqual(res.data.sharedFields, ['firstName', 'lastName', 'email', 'passportNo']);
    assert.deepEqual(res.data.sharedDocumentIds, ['cv']);
    assert.equal(res.data.snapshotData.fields.passportNo, 'P1234567');
    assert.ok(!('notes' in res.data.snapshotData.fields));
    assert.equal(res.data.candidate.firstName, candidate.firstName);
    assert.equal(res.data.job.title, job.title);
    accessToken = res.data.accessToken;

    const mails = await sentEmails(token, recipient);
    assert.equal(mails.length, 1);
    const html: string = mails[0].html;
    assert.ok(!html.includes('<b>team</b>') && !html.includes('<i>'), 'user text must not reach the email as HTML');
    assert.ok(html.includes('Hello &lt;b&gt;team&lt;/b&gt; &amp; &quot;friends&quot;'));
    assert.ok(html.includes(`&lt;i&gt;${TAG}&lt;/i&gt;`));
    assert.ok(html.includes(`/company/view/${accessToken}`));
  });

  test('a share without a job (for the no-job checks)', async () => {
    const res = await api('POST', '/profile-shares', {
      candidateId: candidate.id, clientId: client.id, sharedFields: ['firstName'],
    }, { token });
    expectStatus(res, 201);
    noJobShareId = res.data.id;
    assert.equal(res.data.method, 'PORTAL');
    assert.equal(res.data.jobId, null);
  });

  test('list filters and paginates', async () => {
    const res = await api('GET', `/profile-shares?candidateId=${candidate.id}&limit=50`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 2);
    assert.equal(res.data.page, 1);
    assert.ok(res.data.data.every((s: any) => s.candidate.id === candidate.id));
    assert.ok(res.data.data[0]._count.events >= 1);
    const byJob = await api('GET', `/profile-shares?jobId=${job.id}&status=SENT`, undefined, { token });
    assert.equal(byJob.data.total, 1);
    expectStatus(await api('GET', '/profile-shares?status=NOPE', undefined, { token }), 400);
  });

  test('get returns the share with its events; unknown id is 404', async () => {
    const res = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    expectStatus(res, 200);
    const types = res.data.events.map((e: any) => e.eventType);
    assert.deepEqual(types.slice(0, 2), ['CREATED', 'EMAIL_SENT']);
    assert.equal(res.data.client.id, client.id);
    expectStatus(await api('GET', '/profile-shares/does-not-exist', undefined, { token }), 404);
  });

  /* ── bulk ── */

  test('bulk validates input', async () => {
    expectStatus(await api('POST', '/profile-shares/bulk', { clientId: client.id, candidateIds: [] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/bulk', { clientId: client.id, candidateIds: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/bulk', { candidateIds: [candidate.id] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/bulk', { clientId: client.id, candidateIds: [{ id: 1 }] }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/bulk', { clientId: client.id, candidateIds: Array(201).fill('x') }, { token }), 400);
    const allFail = await api('POST', '/profile-shares/bulk', { clientId: client.id, candidateIds: ['does-not-exist'], sharedFields: ['firstName'] }, { token });
    expectStatus(allFail, 400);
    assert.equal(allFail.data.created, 0);
    assert.equal(allFail.data.failed.length, 1);
  });

  test('bulk shares many candidates and reports per-candidate failures', async () => {
    const a = await createCandidate(token);
    const b = await createCandidate(token);
    extraCandidateIds.push(a.id, b.id);
    await uploadCv(token, a.id);
    const res = await api('POST', '/profile-shares/bulk', {
      candidateIds: [a.id, b.id, 'does-not-exist'], clientId: client.id, jobId: job.id,
      sharedFields: ['firstName', 'headline'], includeCv: true, method: 'PORTAL',
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.created, 2);
    assert.deepEqual(res.data.failed.map((f: any) => f.candidateId), ['does-not-exist']);
    assert.equal(res.data.shareIds.length, 2);
    const shareA = await api('GET', `/profile-shares/${res.data.shareIds[0]}`, undefined, { token });
    assert.deepEqual(shareA.data.sharedDocumentIds, ['cv']); // a has a CV
    const shareB = await api('GET', `/profile-shares/${res.data.shareIds[1]}`, undefined, { token });
    assert.deepEqual(shareB.data.sharedDocumentIds, []); // b has none
  });

  /* ── public tokenized link ── */

  test('public link: invalid token 404', async () => {
    expectStatus(await api('GET', '/profile-shares/public/not-a-real-token'), 404);
    expectStatus(await api('GET', '/profile-shares/public/not-a-real-token/tracking'), 404);
    expectStatus(await api('GET', '/profile-shares/public/not-a-real-token/document-requests'), 404);
    expectStatus(await api('GET', '/profile-shares/public/not-a-real-token/documents/cv/download'), 404);
    expectStatus(await api('GET', '/profile-shares/public/not-a-real-token/document-requests/x/download'), 404);
  });

  test('public link shows the snapshot (no internal file paths) and marks it viewed', async () => {
    const res = await api('GET', `/profile-shares/public/${accessToken}`);
    expectStatus(res, 200);
    assert.equal(res.data.id, shareId);
    assert.equal(res.data.status, 'VIEWED');
    assert.equal(res.data.job.id, job.id);
    assert.equal(res.data.client.companyName, client.companyName);
    assert.equal(res.data.snapshotData.fields.email, candidate.email);
    assert.equal(res.data.snapshotData.documents.length, 1);
    assert.equal(res.data.snapshotData.documents[0].id, 'cv');
    assert.ok(!('filePath' in res.data.snapshotData.documents[0]), 'stored file path is not exposed');
    for (const hidden of ['notes', 'accessToken', 'sentByUserId', 'candidateId']) assert.ok(!(hidden in res.data));
  });

  test('public link downloads a shared document', async () => {
    const res = await api('GET', `/profile-shares/public/${accessToken}/documents/cv/download`);
    expectStatus(res, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition') || '', /^attachment; filename=/);
    expectStatus(await api('GET', `/profile-shares/public/${accessToken}/documents/not-shared/download`), 404);
  });

  test('public link: tracking and document requests only show what was made visible', async () => {
    const empty = await api('GET', `/profile-shares/public/${accessToken}/tracking`);
    expectStatus(empty, 200);
    assert.deepEqual(empty.data, []);
    const tr = await api('POST', '/candidate-tracking', { candidateId: candidate.id, industry: industry.key }, { token });
    expectStatus(tr, 201);
    expectStatus(await api('PUT', `/candidate-tracking/${tr.data.id}`, { data: { onboarding: { site: 'Dubai' } }, visibility: 'PUBLIC' }, { token }), 200);
    assert.deepEqual((await api('GET', `/profile-shares/public/${accessToken}/tracking`)).data, [], 'not yet visible to company');
    expectStatus(await api('PUT', `/candidate-tracking/${tr.data.id}`, { visibleToCompany: true }, { token }), 200);
    const visible = await api('GET', `/profile-shares/public/${accessToken}/tracking`);
    assert.equal(visible.data.length, 1);
    assert.deepEqual(visible.data[0].data, { onboarding: { site: 'Dubai' } });
    assert.equal(visible.data[0].industry.key, industry.key);

    const docs = await api('GET', `/profile-shares/public/${accessToken}/document-requests`);
    expectStatus(docs, 200);
    assert.deepEqual(docs.data, []);
  });

  /* ── company portal ── */

  test('mine lists only the company\'s own shares', async () => {
    const res = await api('GET', '/profile-shares/mine', undefined, { token: portal.token });
    expectStatus(res, 200);
    const ids = res.data.map((s: any) => s.id);
    assert.ok(ids.includes(shareId) && ids.includes(noJobShareId));
    const mine = res.data.find((s: any) => s.id === shareId);
    assert.ok(!('notes' in mine) && !('accessToken' in mine));
    const other = await api('GET', '/profile-shares/mine', undefined, { token: otherPortal.token });
    assert.ok(!other.data.some((s: any) => s.id === shareId));
    const filtered = await api('GET', '/profile-shares/mine?status=VIEWED', undefined, { token: portal.token });
    assert.ok(filtered.data.every((s: any) => s.status === 'VIEWED'));
    expectStatus(await api('GET', '/profile-shares/mine?status=NOPE', undefined, { token: portal.token }), 400);
  });

  test('mine/:id and its sub-resources are scoped to the company', async () => {
    const res = await api('GET', `/profile-shares/mine/${shareId}`, undefined, { token: portal.token });
    expectStatus(res, 200);
    assert.equal(res.data.id, shareId);
    assert.ok(!('filePath' in res.data.snapshotData.documents[0]));
    for (const path of ['', '/tracking', '/document-requests', '/documents/cv/download', '/document-requests/x/download']) {
      expectStatus(await api('GET', `/profile-shares/mine/${shareId}${path}`, undefined, { token: otherPortal.token }), 404);
    }
    expectStatus(await api('GET', '/profile-shares/mine/does-not-exist', undefined, { token: portal.token }), 404);
    const tracking = await api('GET', `/profile-shares/mine/${shareId}/tracking`, undefined, { token: portal.token });
    expectStatus(tracking, 200);
    assert.equal(tracking.data.length, 1);
    const reqs = await api('GET', `/profile-shares/mine/${shareId}/document-requests`, undefined, { token: portal.token });
    expectStatus(reqs, 200);
    assert.deepEqual(reqs.data, []);
    expectStatus(await api('GET', `/profile-shares/mine/${shareId}/document-requests/does-not-exist/download`, undefined, { token: portal.token }), 404);
  });

  test('mine document download marks the share downloaded', async () => {
    const res = await api('GET', `/profile-shares/mine/${shareId}/documents/cv/download`, undefined, { token: portal.token });
    expectStatus(res, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    expectStatus(await api('GET', `/profile-shares/mine/${shareId}/documents/nope/download`, undefined, { token: portal.token }), 404);
    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    assert.equal(share.data.status, 'DOWNLOADED');
  });

  test('respond validates input', async () => {
    const url = `/profile-shares/mine/${shareId}/respond`;
    expectStatus(await api('POST', url, { action: 'HIRE' }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'REQUEST_INTERVIEW' }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'REQUEST_INTERVIEW', preferredAt: 'nope', interviewerEmails: 'a@example.test' }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'REQUEST_INTERVIEW', preferredAt: '2026-12-01T10:00', interviewerEmails: 'bad-email' }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'REQUEST_INTERVIEW', preferredAt: '2026-12-01T10:00', interviewerEmails: '' }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'SHORTLIST', reason: { a: 1 } }, { token: portal.token }), 400);
    expectStatus(await api('POST', url, { action: 'SHORTLIST' }, { token: otherPortal.token }), 404);
    expectStatus(await api('POST', `/profile-shares/mine/${noJobShareId}/respond`, { action: 'SHORTLIST' }, { token: portal.token }), 400);
  });

  test('respond shortlists, updates the application and escapes the staff email (regression)', async () => {
    const reason = `Strong fit <b>${TAG}</b>`;
    const res = await api('POST', `/profile-shares/mine/${shareId}/respond`, { action: 'SHORTLIST', reason }, { token: portal.token });
    expectStatus(res, 200);
    assert.deepEqual(res.data, { status: 'SHORTLISTED' });
    const cand = await api('GET', `/candidates/${candidate.id}`, undefined, { token });
    const application = cand.data.applications.find((a: any) => a.jobId === job.id);
    assert.equal(application.status, 'SHORTLISTED');

    const mails = await sentEmails(token, ADMIN_EMAIL);
    const mail = mails.find((m) => (m.html || '').includes(TAG) && /shortlisted/.test(m.subject));
    assert.ok(mail, 'staff notification was sent');
    assert.ok(!mail.html.includes(`<b>${TAG}</b>`));
    assert.ok(mail.html.includes(`&lt;b&gt;${TAG}&lt;/b&gt;`));
  });

  test('respond: request interview', async () => {
    const res = await api('POST', `/profile-shares/mine/${shareId}/respond`, {
      action: 'REQUEST_INTERVIEW', preferredAt: '2026-12-01T10:00:00Z', interviewerEmails: 'Boss@Example.test, hr@example.test', reason: 'Asap',
    }, { token: portal.token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'INTERVIEW_REQUESTED');
    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    const ev = share.data.events.find((e: any) => e.eventType === 'INTERVIEW_REQUESTED');
    assert.deepEqual(ev.metadata.interviewerEmails, ['boss@example.test', 'hr@example.test']);
    assert.equal(share.data.respondedByClientUser.id, portal.id);
  });

  /* ── schedule interview ── */

  test('schedule-interview validates input', async () => {
    const url = `/profile-shares/${shareId}/schedule-interview`;
    const ok = { scheduledAt: '2026-12-05T09:00:00Z', mode: 'ONLINE', meetLink: 'https://meet.example.test/abc' };
    expectStatus(await api('POST', url, { ...ok, scheduledAt: undefined }, { token }), 400);
    expectStatus(await api('POST', url, { ...ok, scheduledAt: 'nope' }, { token }), 400);
    expectStatus(await api('POST', url, { ...ok, mode: 'HYBRID' }, { token }), 400);
    expectStatus(await api('POST', url, { ...ok, meetLink: undefined }, { token }), 400);
    expectStatus(await api('POST', url, { ...ok, meetLink: 'javascript:alert(1)' }, { token }), 400);
    expectStatus(await api('POST', url, { scheduledAt: ok.scheduledAt, mode: 'OFFLINE' }, { token }), 400);
    expectStatus(await api('POST', url, { ...ok, interviewers: 'not-an-email' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/does-not-exist/schedule-interview', ok, { token }), 404);
    expectStatus(await api('POST', `/profile-shares/${noJobShareId}/schedule-interview`, ok, { token }), 400);
  });

  test('schedule-interview creates the interview + candidate account and escapes emails (regression)', async () => {
    const interviewer = testEmail('interviewer');
    const res = await api('POST', `/profile-shares/${shareId}/schedule-interview`, {
      scheduledAt: '2026-12-05T09:00:00Z', mode: 'ONLINE',
      meetLink: `https://meet.example.test/room?a=1&b="x"`,
      interviewers: interviewer,
      notes: `Bring <script>alert("${TAG}")</script> ID`,
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.accountCreated, true);
    assert.equal(res.data.interviewersNotified, 1);
    assert.deepEqual(res.data.interviewerFailures, []);
    // the email went out, so the password is NOT echoed back
    assert.ok(!('temporaryPassword' in res.data));
    assert.ok(!('candidateEmailSent' in res.data));
    assert.equal(res.data.interview.profileShareId, shareId);
    assert.equal(res.data.interview.mode, 'ONLINE');

    const candidateMail = (await sentEmails(token, candidate.email)).find((m) => /Interview Scheduled/.test(m.subject));
    assert.ok(candidateMail, 'candidate email sent');
    assert.ok(!candidateMail.html.includes('<script>'));
    assert.ok(candidateMail.html.includes('&lt;script&gt;'));
    assert.ok(candidateMail.html.includes('href="https://meet.example.test/room?a=1&amp;b=&quot;x&quot;"'));
    const password = /Temporary password:\s*<strong>([^<]+)<\/strong>/.exec(candidateMail.html)?.[1];
    assert.ok(password, 'temporary password is in the candidate email');

    const interviewerMail = (await sentEmails(token, interviewer))[0];
    assert.ok(interviewerMail);
    assert.ok(!interviewerMail.html.includes('<script>'));
    assert.ok(!/Temporary password/i.test(interviewerMail.html), 'credentials never go to interviewers');

    const login = await api('POST', '/candidate-auth/login', { email: candidate.email, password });
    expectStatus(login, 200);
    candidateToken = login.data.accessToken;

    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    assert.equal(share.data.status, 'INTERVIEW_SCHEDULED');
    assert.equal(share.data.interviews.length, 1);
    const company = await api('GET', `/profile-shares/mine/${shareId}`, undefined, { token: portal.token });
    assert.equal(company.data.interview.id, res.data.interview.id);
    assert.ok(!('password' in company.data.interview));
  });

  test('re-scheduling does not create another account', async () => {
    const res = await api('POST', `/profile-shares/${shareId}/schedule-interview`, {
      scheduledAt: '2026-12-06T09:00:00Z', mode: 'OFFLINE', location: 'Office <b>1</b>',
    }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.accountCreated, false);
    assert.equal(res.data.interview.meetLink, null);
    assert.equal(res.data.interview.location, 'Office <b>1</b>');
  });

  /* ── verified documents visible to the company ── */

  test('a verified, company-visible document request is listed and downloadable', async () => {
    const created = await api('POST', '/document-requests', { candidateId: candidate.id, title: `Visa ${TAG}` }, { token });
    expectStatus(created, 201);
    docRequestId = created.data.id;
    const fd = new FormData();
    fd.append('file', samplePdf('Visa copy'), 'visa.pdf');
    expectStatus(await api('POST', `/candidate-auth/me/document-requests/${docRequestId}/upload`, fd, { token: candidateToken }), 200);

    // staff side of the document-request lifecycle
    const dl = await api('GET', `/document-requests/${docRequestId}/download`, undefined, { token });
    expectStatus(dl, 200);
    assert.equal(dl.headers.get('content-type'), 'application/pdf');
    const verified = await api('POST', `/document-requests/${docRequestId}/verify`, { approved: true }, { token });
    expectStatus(verified, 200);
    assert.equal(verified.data.status, 'VERIFIED');
    assert.ok(verified.data.verifiedByUserId);

    // verified but not yet visible
    expectStatus(await api('GET', `/profile-shares/public/${accessToken}/document-requests/${docRequestId}/download`), 404);
    expectStatus(await api('PATCH', `/document-requests/${docRequestId}/visibility`, { visibleToCompany: true }, { token }), 200);

    const pub = await api('GET', `/profile-shares/public/${accessToken}/document-requests`);
    assert.deepEqual(pub.data.map((d: any) => d.id), [docRequestId]);
    assert.ok(!('filePath' in pub.data[0]));
    const pubDl = await api('GET', `/profile-shares/public/${accessToken}/document-requests/${docRequestId}/download`);
    expectStatus(pubDl, 200);
    const mine = await api('GET', `/profile-shares/mine/${shareId}/document-requests`, undefined, { token: portal.token });
    assert.deepEqual(mine.data.map((d: any) => d.id), [docRequestId]);
    expectStatus(await api('GET', `/profile-shares/mine/${shareId}/document-requests/${docRequestId}/download`, undefined, { token: portal.token }), 200);
  });

  test('verify rejects an already verified document', async () => {
    expectStatus(await api('POST', `/document-requests/${docRequestId}/verify`, { approved: false }, { token }), 400);
  });

  /* ── resend / withdraw ── */

  test('resend validates, sends and logs an event', async () => {
    expectStatus(await api('POST', `/profile-shares/${shareId}/resend`, { toEmail: 'nope' }, { token }), 400);
    expectStatus(await api('POST', '/profile-shares/does-not-exist/resend', {}, { token }), 404);
    const to = testEmail('resend');
    const res = await api('POST', `/profile-shares/${shareId}/resend`, { toEmail: to }, { token });
    expectStatus(res, 200);
    const mail = (await sentEmails(token, to))[0];
    assert.ok(mail);
    assert.ok(!mail.html.includes('<i>'), 'job title is escaped in the reminder');
    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    expectStatus(share, 200);
    assert.ok(share.data.events.some((e: any) => e.eventType === 'RESENT'));
  });

  test('event log records the whole flow', async () => {
    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    const types = new Set(share.data.events.map((e: any) => e.eventType));
    for (const t of ['CREATED', 'EMAIL_SENT', 'VIEWED', 'DOWNLOADED', 'SHORTLISTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED', 'RESENT']) {
      assert.ok(types.has(t), `missing ${t} event`);
    }
    const anonymousView = share.data.events.find((e: any) => e.eventType === 'VIEWED' && e.actorType === 'ANONYMOUS_TOKEN');
    assert.ok(anonymousView.metadata.ip);
  });

  test('withdraw hides the share everywhere', async () => {
    expectStatus(await api('PATCH', '/profile-shares/does-not-exist/withdraw', undefined, { token }), 404);
    const res = await api('PATCH', `/profile-shares/${shareId}/withdraw`, undefined, { token });
    expectStatus(res, 200);
    expectStatus(await api('PATCH', `/profile-shares/${shareId}/withdraw`, undefined, { token }), 400);
    expectStatus(await api('GET', `/profile-shares/public/${accessToken}`), 410);
    expectStatus(await api('GET', `/profile-shares/public/${accessToken}/tracking`), 410);
    expectStatus(await api('GET', `/profile-shares/public/${accessToken}/documents/cv/download`), 410);
    expectStatus(await api('GET', `/profile-shares/mine/${shareId}`, undefined, { token: portal.token }), 410);
    expectStatus(await api('GET', `/profile-shares/mine/${shareId}/document-requests`, undefined, { token: portal.token }), 410);
    expectStatus(await api('POST', `/profile-shares/mine/${shareId}/respond`, { action: 'REJECT' }, { token: portal.token }), 410);
    expectStatus(await api('POST', `/profile-shares/${shareId}/resend`, {}, { token }), 410);
    expectStatus(await api('POST', `/profile-shares/${shareId}/schedule-interview`, {
      scheduledAt: '2026-12-05T09:00:00Z', mode: 'ONLINE', meetLink: 'https://meet.example.test/x',
    }, { token }), 410);
    const share = await api('GET', `/profile-shares/${shareId}`, undefined, { token });
    assert.equal(share.data.status, 'WITHDRAWN');
    assert.ok(share.data.withdrawnAt);
  });
});

describe('profile-shares RBAC', () => {
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let editor: StaffUser;
  let scheduler: StaffUser;

  before(async () => {
    staff = await staffUsers('VIEWER', 'RECRUITER', 'HR');
    editor = await staffWithCustomRole({ candidates: ['view', 'edit'] });
    scheduler = await staffWithCustomRole({ interviews: ['create'] });
  });

  after(async () => {
    await staff?.cleanup();
    await editor?.cleanup();
    await scheduler?.cleanup();
  });

  /** The permission check passed when the request fails for another reason (validation / not found). */
  const allowed = (res: { status: number; data: any }) =>
    assert.ok(res.status !== 401 && res.status !== 403, `expected to pass the permission check, got ${res.status}: ${JSON.stringify(res.data)}`);

  test('VIEWER can read shares but not share, resend, withdraw or schedule', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', '/profile-shares', undefined, { token }), 200);
    expectStatus(await api('GET', '/profile-shares/does-not-exist', undefined, { token }), 404);
    expectStatus(await api('POST', '/profile-shares', {}, { token }), 403);
    expectStatus(await api('POST', '/profile-shares/bulk', {}, { token }), 403);
    expectStatus(await api('POST', '/profile-shares/x/resend', {}, { token }), 403);
    expectStatus(await api('PATCH', '/profile-shares/x/withdraw', undefined, { token }), 403);
    expectStatus(await api('POST', '/profile-shares/x/schedule-interview', {}, { token }), 403);
  });

  test('HR has no access to shares', async () => {
    expectStatus(await api('GET', '/profile-shares', undefined, { token: staff.users.HR.token }), 403);
  });

  test('RECRUITER passes every staff check', async () => {
    const token = staff.users.RECRUITER.token;
    allowed(await api('POST', '/profile-shares', {}, { token }));
    allowed(await api('POST', '/profile-shares/bulk', {}, { token }));
    allowed(await api('POST', '/profile-shares/does-not-exist/resend', {}, { token }));
    allowed(await api('PATCH', '/profile-shares/does-not-exist/withdraw', undefined, { token }));
    allowed(await api('POST', '/profile-shares/does-not-exist/schedule-interview', {}, { token }));
  });

  test('custom roles grant exactly their permissions', async () => {
    allowed(await api('POST', '/profile-shares', {}, { token: editor.token }));
    expectStatus(await api('POST', '/profile-shares/x/schedule-interview', {}, { token: editor.token }), 403);
    allowed(await api('POST', '/profile-shares/does-not-exist/schedule-interview', {}, { token: scheduler.token }));
    expectStatus(await api('GET', '/profile-shares', undefined, { token: scheduler.token }), 403);
    expectStatus(await api('POST', '/profile-shares', {}, { token: scheduler.token }), 403);
  });
});
