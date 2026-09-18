import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, fetchRaw, samplePdf, samplePng, testEmail } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { createCandidate, createClient, createJob, deleteCandidate } from './_recruitment';

describe('candidates', () => {
  let token: string;
  const candidateIds: string[] = [];
  let clientId: string;
  let jobId: string;
  let mainId: string;
  let mainEmail: string;
  let parsedCvPath: string;
  let profileRequestId: string;

  before(async () => {
    token = await adminAuth();
    const client = await createClient(token);
    clientId = client.id;
    jobId = (await createJob(token, clientId)).id;
  });

  after(async () => {
    for (const id of candidateIds) await deleteCandidate(token, id);
    if (jobId) await api('DELETE', `/jobs/${jobId}`, undefined, { token });
    if (clientId) await api('DELETE', `/clients/${clientId}`, undefined, { token });
  });

  /* ── auth ── */

  test('staff endpoints require a token', async () => {
    expectStatus(await api('GET', '/candidates'), 401);
    expectStatus(await api('POST', '/candidates', {}), 401);
    expectStatus(await api('GET', '/candidates/x'), 401);
    expectStatus(await api('PUT', '/candidates/x', {}), 401);
    expectStatus(await api('DELETE', '/candidates/x'), 401);
    expectStatus(await api('POST', '/candidates/x/apply', {}), 401);
    expectStatus(await api('PATCH', '/candidates/x/visibility', {}), 401);
    expectStatus(await api('POST', '/candidates/parse-cv', new FormData()), 401);
    expectStatus(await api('POST', '/candidates/admin-import', new FormData()), 401);
    expectStatus(await api('GET', '/candidates/profile-requests'), 401);
    expectStatus(await api('PUT', '/candidates/profile-requests/x', {}), 401);
  });

  /* ── create ── */

  test('create validates required fields, email and enums', async () => {
    expectStatus(await api('POST', '/candidates', { firstName: 'A' }, { token }), 400);
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: 'nope', phone: '1' }, { token }), 400);
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: testEmail('bad-status'), phone: '1', status: 'BOGUS' }, { token }), 400);
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: testEmail('bad-sal'), phone: '1', expectedSalary: 'lots' }, { token }), 400);
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: testEmail('bad-cat'), phone: '1', categoryId: 'does-not-exist' }, { token }), 400);
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: testEmail('bad-cv'), phone: '1', cvPath: '../../.env' }, { token }), 400);
  });

  test('create (multipart, like the admin form) with CV + photo; isPublic "false" string works', async () => {
    mainEmail = testEmail('main');
    const fd = new FormData();
    fd.append('firstName', 'Mona');
    fd.append('lastName', `Main ${TAG}`);
    fd.append('email', mainEmail);
    fd.append('phone', '+971500000011');
    fd.append('experience', '5');
    fd.append('currentSalary', '');
    fd.append('expectedSalary', '12000');
    fd.append('skills', 'React, Node.js , SQL');
    fd.append('isPublic', 'false');
    fd.append('status', 'NEW');
    fd.append('categoryId', '');
    // mass-assignment attempts
    fd.append('cvId', 'HIJACKED-CV-ID');
    fd.append('id', 'hijacked-id');
    fd.append('cv', samplePdf('Mona CV'), 'mona.pdf');
    fd.append('photo', samplePng(), 'mona.png');
    const res = await api('POST', '/candidates', fd, { token });
    expectStatus(res, 201);
    mainId = res.data.id;
    candidateIds.push(mainId);
    assert.notEqual(res.data.id, 'hijacked-id');
    assert.notEqual(res.data.cvId, 'HIJACKED-CV-ID');
    assert.match(res.data.cvId, /-CV-/);
    assert.equal(res.data.isPublic, false);
    assert.equal(res.data.experience, 5);
    assert.equal(res.data.currentSalary, null);
    assert.equal(res.data.expectedSalary, 12000);
    assert.deepEqual(res.data.skills, ['React', 'Node.js', 'SQL']);
    assert.match(res.data.cvPath, /^uploads\/documents\/.+\.pdf$/);
    assert.match(res.data.photo, /^uploads\/images\/.+\.png$/);
    const cv = await fetchRaw(res.data.cvPath);
    assert.equal(cv.status, 200);
    const photo = await fetchRaw(res.data.photo);
    assert.equal(photo.status, 200);
  });

  test('duplicate email returns 409', async () => {
    expectStatus(await api('POST', '/candidates', { firstName: 'A', lastName: 'B', email: mainEmail, phone: '1' }, { token }), 409);
  });

  /* ── read ── */

  test('get returns the candidate with relations; unknown id is 404', async () => {
    const res = await api('GET', `/candidates/${mainId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.email, mainEmail);
    assert.ok(Array.isArray(res.data.applications));
    assert.ok(Array.isArray(res.data.editHistory));
    expectStatus(await api('GET', '/candidates/does-not-exist', undefined, { token }), 404);
  });

  test('list paginates, searches and validates filters', async () => {
    const res = await api('GET', `/candidates?search=${encodeURIComponent(`Main ${TAG}`)}&page=1&limit=5`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.page, 1);
    assert.equal(res.data.limit, 5);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.data[0].id, mainId);
    assert.ok('_count' in res.data.data[0]);
    const weird = await api('GET', '/candidates?page=abc&limit=-3', undefined, { token });
    expectStatus(weird, 200);
    assert.equal(weird.data.page, 1);
    assert.equal(weird.data.limit, 1);
    expectStatus(await api('GET', '/candidates?status=BOGUS', undefined, { token }), 400);
    expectStatus(await api('GET', '/candidates?minExperience=abc', undefined, { token }), 400);
  });

  test('skills filter is case-insensitive (regression)', async () => {
    const res = await api('GET', `/candidates?skills=react,unknownskill&search=${encodeURIComponent(`Main ${TAG}`)}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.data[0].id, mainId);
    const none = await api('GET', `/candidates?skills=cobol&search=${encodeURIComponent(`Main ${TAG}`)}`, undefined, { token });
    expectStatus(none, 200);
    assert.equal(none.data.total, 0);
  });

  /* ── update ── */

  test('update is partial, converts types and records edit history', async () => {
    const res = await api('PUT', `/candidates/${mainId}`, { headline: 'Senior Dev', experience: '', isPublic: true, cvId: 'HIJACK' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.headline, 'Senior Dev');
    assert.equal(res.data.experience, null);
    assert.equal(res.data.isPublic, true);
    assert.equal(res.data.firstName, 'Mona');
    assert.deepEqual(res.data.skills, ['React', 'Node.js', 'SQL']);
    assert.notEqual(res.data.cvId, 'HIJACK');
    const detail = await api('GET', `/candidates/${mainId}`, undefined, { token });
    const entry = detail.data.editHistory[0];
    assert.ok(entry.changes.headline);
    assert.equal(entry.editedBy, 'admin');
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/candidates/${mainId}`, { introVideoUrl: 'https://example.com/video' }, { token }), 400);
    expectStatus(await api('PUT', `/candidates/${mainId}`, { firstName: '' }, { token }), 400);
    expectStatus(await api('PUT', `/candidates/${mainId}`, { status: 'NOPE' }, { token }), 400);
    expectStatus(await api('PUT', `/candidates/${mainId}`, { photo: 'C:/Windows/win.ini' }, { token }), 400);
    expectStatus(await api('PUT', '/candidates/does-not-exist', { headline: 'x' }, { token }), 404);
    const ok = await api('PUT', `/candidates/${mainId}`, { introVideoUrl: 'https://youtu.be/dQw4w9WgXcQ' }, { token });
    expectStatus(ok, 200);
  });

  test('update accepts a new photo upload', async () => {
    const fd = new FormData();
    fd.append('photo', samplePng(), 'new.png');
    const res = await api('PUT', `/candidates/${mainId}`, fd, { token });
    expectStatus(res, 200);
    assert.match(res.data.photo, /^uploads\/images\//);
  });

  /* ── visibility + public profile ── */

  test('visibility toggles the public profile', async () => {
    expectStatus(await api('PATCH', `/candidates/${mainId}/visibility`, {}, { token }), 400);
    expectStatus(await api('PATCH', '/candidates/does-not-exist/visibility', { isPublic: true }, { token }), 404);
    const off = await api('PATCH', `/candidates/${mainId}/visibility`, { isPublic: false }, { token });
    expectStatus(off, 200);
    assert.equal(off.data.isPublic, false);
    expectStatus(await api('GET', `/candidates/profile/${mainId}`), 404);
    const on = await api('PATCH', `/candidates/${mainId}/visibility`, { isPublic: true }, { token });
    assert.equal(on.data.isPublic, true);
  });

  test('public profile exposes only public fields', async () => {
    const res = await api('GET', `/candidates/profile/${mainId}`);
    expectStatus(res, 200);
    assert.equal(res.data.id, mainId);
    assert.equal(res.data.headline, 'Senior Dev');
    for (const hidden of ['email', 'phone', 'cvPath', 'notes', 'expectedSalary', 'passportNo']) {
      assert.ok(!(hidden in res.data), `${hidden} must not be public`);
    }
    expectStatus(await api('GET', '/candidates/profile/does-not-exist'), 404);
  });

  test('public profiles listing', async () => {
    const res = await api('GET', `/candidates/public-profiles?search=${encodeURIComponent(`Main ${TAG}`)}`);
    expectStatus(res, 200);
    assert.equal(res.data.total, 1);
    assert.ok(!('email' in res.data.data[0]));
    const bad = await api('GET', '/candidates/public-profiles?limit=abc&page=-1');
    expectStatus(bad, 200);
  });

  /* ── profile requests ── */

  test('public profile request validates input', async () => {
    expectStatus(await api('POST', `/candidates/profile/${mainId}/request`, { requesterName: 'X' }), 400);
    expectStatus(await api('POST', `/candidates/profile/${mainId}/request`, {
      requesterName: 'X', companyName: 'Y', email: 'not-an-email', phone: '1',
    }), 400);
    expectStatus(await api('POST', '/candidates/profile/does-not-exist/request', {
      requesterName: 'X', companyName: 'Y', email: 'x@example.test', phone: '1',
    }), 404);
  });

  test('public profile request is created and can be managed by staff', async () => {
    const res = await api('POST', `/candidates/profile/${mainId}/request`, {
      requesterName: 'Req', companyName: `Req Co ${TAG}`, email: testEmail('req'), phone: '+971500000099',
      position: 'Dev', message: 'Interested', status: 'CLOSED', adminNotes: 'hijack',
    });
    expectStatus(res, 201);
    profileRequestId = res.data.id;
    const list = await api('GET', '/candidates/profile-requests', undefined, { token });
    expectStatus(list, 200);
    const mine = list.data.find((r: any) => r.id === profileRequestId);
    assert.ok(mine);
    assert.equal(mine.status, 'NEW');
    assert.equal(mine.adminNotes, null);
    assert.equal(mine.candidate.id, mainId);
    const filtered = await api('GET', '/candidates/profile-requests?status=NEW', undefined, { token });
    assert.ok(filtered.data.every((r: any) => r.status === 'NEW'));
  });

  test('staff updates a profile request; unknown id is 404', async () => {
    const res = await api('PUT', `/candidates/profile-requests/${profileRequestId}`, { status: 'CONTACTED', adminNotes: 'Called', candidateId: 'hijack' }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'CONTACTED');
    assert.equal(res.data.adminNotes, 'Called');
    assert.equal(res.data.candidateId, mainId);
    const partial = await api('PUT', `/candidates/profile-requests/${profileRequestId}`, { adminNotes: 'Again' }, { token });
    assert.equal(partial.data.status, 'CONTACTED');
    expectStatus(await api('PUT', '/candidates/profile-requests/does-not-exist', { status: 'X' }, { token }), 404);
  });

  /* ── CV parsing + import ── */

  test('parse-cv requires a document file', async () => {
    expectStatus(await api('POST', '/candidates/parse-cv', new FormData(), { token }), 400);
    const fd = new FormData();
    fd.append('cv', samplePng(), 'photo.png');
    expectStatus(await api('POST', '/candidates/parse-cv', fd, { token }), 400);
  });

  test('parse-cv extracts name, email and phone and returns a downloadable cvPath', async () => {
    const fd = new FormData();
    const email = `jane.parsed.${TAG}@example.com`;
    fd.append('cv', samplePdf(`Name: Jane Parsed  ${email}  +971 50 123 4567  Senior Accountant with 6 years experience`), 'jane.pdf');
    const res = await api('POST', '/candidates/parse-cv', fd, { token });
    expectStatus(res, 200);
    assert.equal(res.data.parsed.email, email);
    assert.ok(res.data.parsed.phone && res.data.parsed.phone.replace(/\D/g, '').endsWith('501234567'), `phone: ${res.data.parsed.phone}`);
    assert.equal(res.data.parsed.firstName, 'Jane');
    assert.ok(!('_debug' in res.data.parsed));
    parsedCvPath = res.data.cvPath;
    assert.match(parsedCvPath, /^uploads\/documents\/.+\.pdf$/);
    const file = await fetchRaw(parsedCvPath);
    assert.equal(file.status, 200);
    assert.match(Buffer.from(await file.arrayBuffer()).toString('latin1'), /^%PDF/);
  });

  test('admin-import creates a candidate from the reviewed data', async () => {
    const fd = new FormData();
    fd.append('firstName', 'Jane');
    fd.append('lastName', `Parsed ${TAG}`);
    fd.append('email', testEmail('imported'));
    fd.append('phone', '+971501234567');
    fd.append('skills', 'Excel,IFRS');
    fd.append('languages', 'English');
    fd.append('experience', '6');
    fd.append('isPublic', 'true');
    fd.append('cvPath', parsedCvPath);
    fd.append('cvId', 'HIJACK');
    fd.append('currentSalary', '99999'); // not part of the import form
    fd.append('photo', samplePng(), 'jane.png');
    const res = await api('POST', '/candidates/admin-import', fd, { token });
    expectStatus(res, 201);
    candidateIds.push(res.data.id);
    assert.equal(res.data.source, 'ADMIN_IMPORT');
    assert.equal(res.data.isPublic, true);
    assert.equal(res.data.cvPath, parsedCvPath);
    assert.equal(res.data.experience, 6);
    assert.deepEqual(res.data.skills, ['Excel', 'IFRS']);
    assert.notEqual(res.data.cvId, 'HIJACK');
    assert.equal(res.data.currentSalary, null);
    assert.match(res.data.photo, /^uploads\/images\//);
  });

  test('admin-import validation', async () => {
    const missing = new FormData();
    missing.append('firstName', 'Only');
    expectStatus(await api('POST', '/candidates/admin-import', missing, { token }), 400);
    const badPath = new FormData();
    for (const [k, v] of Object.entries({ firstName: 'A', lastName: 'B', email: testEmail('badpath'), phone: '1', cvPath: '/etc/passwd' })) badPath.append(k, v);
    expectStatus(await api('POST', '/candidates/admin-import', badPath, { token }), 400);
    const dup = new FormData();
    for (const [k, v] of Object.entries({ firstName: 'A', lastName: 'B', email: mainEmail, phone: '1' })) dup.append(k, v);
    expectStatus(await api('POST', '/candidates/admin-import', dup, { token }), 409);
  });

  /* ── apply + delete ── */

  test('apply assigns a candidate to a job', async () => {
    expectStatus(await api('POST', `/candidates/${mainId}/apply`, {}, { token }), 400);
    expectStatus(await api('POST', `/candidates/${mainId}/apply`, { jobId: 'does-not-exist' }, { token }), 404);
    expectStatus(await api('POST', '/candidates/does-not-exist/apply', { jobId }, { token }), 404);
    const res = await api('POST', `/candidates/${mainId}/apply`, { jobId }, { token });
    expectStatus(res, 201);
    assert.equal(res.data.job.id, jobId);
    assert.equal(res.data.status, 'NEW');
    expectStatus(await api('POST', `/candidates/${mainId}/apply`, { jobId }, { token }), 409);
  });

  test('delete removes a candidate together with its applications', async () => {
    const extra = await createCandidate(token);
    candidateIds.push(extra.id);
    expectStatus(await api('POST', `/candidates/${extra.id}/apply`, { jobId }, { token }), 201);
    expectStatus(await api('DELETE', `/candidates/${extra.id}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/candidates/${extra.id}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/candidates/${extra.id}`, undefined, { token }), 404);
  });
});

describe('candidates RBAC', () => {
  let admin: string;
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  const ids: string[] = [];
  let candidateId: string;

  before(async () => {
    admin = await adminAuth();
    staff = await staffUsers('VIEWER', 'RECRUITER', 'HR', 'ADMIN');
    custom = await staffWithCustomRole({ candidates: ['view', 'edit'] });
    candidateId = (await createCandidate(admin)).id;
    ids.push(candidateId);
  });

  after(async () => {
    for (const id of ids) await deleteCandidate(admin, id);
    await staff?.cleanup();
    await custom?.cleanup();
  });

  const newCandidate = () => ({ firstName: 'Rbac', lastName: `Cand ${TAG}`, email: testEmail(`rbac${ids.length}`), phone: '1' });

  test('VIEWER can read but not create, edit, publish or delete', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', '/candidates', undefined, { token }), 200);
    expectStatus(await api('GET', `/candidates/${candidateId}`, undefined, { token }), 200);
    expectStatus(await api('GET', '/candidates/profile-requests', undefined, { token }), 200);
    expectStatus(await api('POST', '/candidates', newCandidate(), { token }), 403);
    expectStatus(await api('POST', '/candidates/admin-import', new FormData(), { token }), 403);
    expectStatus(await api('POST', '/candidates/parse-cv', new FormData(), { token }), 403);
    expectStatus(await api('PUT', `/candidates/${candidateId}`, { headline: 'x' }, { token }), 403);
    expectStatus(await api('PATCH', `/candidates/${candidateId}/visibility`, { isPublic: true }, { token }), 403);
    expectStatus(await api('POST', `/candidates/${candidateId}/apply`, { jobId: 'x' }, { token }), 403);
    expectStatus(await api('PUT', '/candidates/profile-requests/x', { status: 'X' }, { token }), 403);
    expectStatus(await api('DELETE', `/candidates/${candidateId}`, undefined, { token }), 403);
  });

  test('RECRUITER can create and edit but not delete or change visibility', async () => {
    const token = staff.users.RECRUITER.token;
    const created = await api('POST', '/candidates', newCandidate(), { token });
    expectStatus(created, 201);
    ids.push(created.data.id);
    expectStatus(await api('PUT', `/candidates/${created.data.id}`, { headline: 'Recruited' }, { token }), 200);
    expectStatus(await api('POST', '/candidates/parse-cv', new FormData(), { token }), 400); // past the permission check
    expectStatus(await api('PUT', '/candidates/profile-requests/does-not-exist', { status: 'X' }, { token }), 404);
    expectStatus(await api('PATCH', `/candidates/${created.data.id}/visibility`, { isPublic: true }, { token }), 403);
    expectStatus(await api('DELETE', `/candidates/${created.data.id}`, undefined, { token }), 403);
  });

  test('HR has no access to candidates', async () => {
    const token = staff.users.HR.token;
    expectStatus(await api('GET', '/candidates', undefined, { token }), 403);
    expectStatus(await api('GET', `/candidates/${candidateId}`, undefined, { token }), 403);
    expectStatus(await api('GET', '/candidates/profile-requests', undefined, { token }), 403);
  });

  test('ADMIN can change visibility and delete', async () => {
    const token = staff.users.ADMIN.token;
    const id = ids.pop()!;
    expectStatus(await api('PATCH', `/candidates/${id}/visibility`, { isPublic: false }, { token }), 200);
    expectStatus(await api('DELETE', `/candidates/${id}`, undefined, { token }), 200);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', '/candidates', undefined, { token }), 200);
    expectStatus(await api('PUT', `/candidates/${candidateId}`, { headline: 'Custom' }, { token }), 200);
    expectStatus(await api('POST', '/candidates', newCandidate(), { token }), 403);
    expectStatus(await api('PATCH', `/candidates/${candidateId}/visibility`, { isPublic: true }, { token }), 403);
    expectStatus(await api('DELETE', `/candidates/${candidateId}`, undefined, { token }), 403);
    // nothing outside the role, even what the VIEWER preset would give
    expectStatus(await api('GET', '/jobs', undefined, { token }), 403);
  });
});
