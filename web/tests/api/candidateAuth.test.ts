import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, fetchRaw, samplePdf, samplePng, testEmail } from './_client';
import { cleanupTagged, db, otpTicket } from './_authDb';

describe('candidate portal flow (candidate-auth)', () => {
  let admin: string;
  const email = testEmail('cand');
  let password = 'Cand@12345';
  let registrationId: string;
  let candidateId: string;
  let access: string;
  let refresh: string;
  let cvId: string;
  let docRequestId: string;
  const extraUploads: string[] = [];

  before(async () => {
    admin = await adminAuth();
  });

  after(async () => {
    await cleanupTagged(extraUploads);
    await db.$disconnect();
  });

  function registrationForm(ticket: string | null, overrides: Record<string, string> = {}) {
    const fd = new FormData();
    const fields: Record<string, string> = {
      firstName: 'Cand', lastName: 'Tester', email, phone: '+971500000001',
      nationality: 'Indian', currentLocation: 'Dubai', headline: 'QA Engineer', password,
      experience: '3', parsedData: JSON.stringify({ firstName: 'Cand' }),
      // mass-assignment attempts: must be ignored
      status: 'APPROVED', notes: 'hacked', convertedTo: 'x', cvPath: 'uploads/evil.pdf', photo: 'uploads/evil.png',
      ...overrides,
    };
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append('skills', 'Excel');
    fd.append('skills', 'Sales');
    fd.append('languages', 'English');
    fd.append('languages', 'Hindi');
    if (ticket) fd.append('emailVerificationTicket', ticket);
    return fd;
  }

  test('POST /candidate-auth/parse-cv needs a file and parses a PDF', async () => {
    expectStatus(await api('POST', '/candidate-auth/parse-cv', new FormData()), 400);
    const fd = new FormData();
    fd.append('cv', samplePdf('Jane Doe jane.doe@example.com'), 'cv.pdf');
    const res = await api('POST', '/candidate-auth/parse-cv', fd);
    expectStatus(res, 200);
    assert.ok(res.data.parsed);
    assert.match(res.data.cvPath, /^uploads\/documents\//);
    extraUploads.push(res.data.cvPath);
  });

  test('POST /candidate-auth/register requires a verified email and a valid password', async () => {
    const noTicket = await api('POST', '/candidate-auth/register', registrationForm(null));
    expectStatus(noTicket, 400);
    assert.equal(noTicket.data.error, 'Please verify your email first');
    const badTicket = await api('POST', '/candidate-auth/register', registrationForm('garbage'));
    expectStatus(badTicket, 400);
    expectStatus(await api('POST', '/candidate-auth/register', registrationForm('garbage', { password: 'short' })), 400);
    expectStatus(await api('POST', '/candidate-auth/register', registrationForm('garbage', { phone: '' })), 400);
  });

  test('otp → register (multipart: cv + photo + repeated skills) stores an allow-listed registration', async () => {
    const ticket = await otpTicket(api, email, 'CANDIDATE_REGISTRATION');
    const fd = registrationForm(ticket);
    fd.append('cv', samplePdf('Cand Tester CV'), 'cv.pdf');
    fd.append('photo', samplePng(), 'photo.png');
    const res = await api('POST', '/candidate-auth/register', fd);
    expectStatus(res, 201);
    registrationId = res.data.id;

    const reg = await db.candidateRegistration.findUnique({ where: { id: registrationId } });
    assert.ok(reg);
    assert.equal(reg!.skills, 'Excel, Sales');
    assert.equal(reg!.languages, 'English, Hindi');
    assert.equal(reg!.experience, '3');
    assert.equal(reg!.status, 'NEW');
    assert.equal(reg!.notes, null);
    assert.equal(reg!.convertedTo, null);
    assert.match(reg!.cvPath!, /^uploads\/documents\/.+\.pdf$/);
    assert.match(reg!.photo!, /^uploads\/images\/.+\.png$/);
    assert.ok(reg!.password && reg!.password !== password, 'password stored hashed');
    assert.deepEqual(reg!.parsedData, { firstName: 'Cand' });
    const file = await fetchRaw(reg!.cvPath!);
    assert.equal(file.status, 200);

    // the ticket is single-use
    const again = await api('POST', '/candidate-auth/register', registrationForm(ticket));
    expectStatus(again, 400);
  });

  test('cannot log in before approval', async () => {
    const res = await api('POST', '/candidate-auth/login', { email, password });
    expectStatus(res, 401);
  });

  test('staff approves the registration (keeps the candidate\'s own password)', async () => {
    const res = await api('POST', `/registrations/${registrationId}/approve`, { isPublic: false }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.message, 'Candidate approved and portal account created.');
    assert.equal(res.data.temporaryPassword, undefined);
    candidateId = res.data.candidateId;
  });

  test('POST /candidate-auth/login validates and logs in', async () => {
    expectStatus(await api('POST', '/candidate-auth/login', {}), 400);
    expectStatus(await api('POST', '/candidate-auth/login', { email, password: 'Wrong@12345' }), 401);
    const res = await api('POST', '/candidate-auth/login', { email: `  ${email.toUpperCase()} `, password });
    expectStatus(res, 200);
    assert.equal(res.data.candidate.id, candidateId);
    assert.equal(res.data.candidate.isPublic, false);
    access = res.data.accessToken;
    refresh = res.data.refreshToken;
  });

  test('authenticated endpoints reject missing and staff tokens', async () => {
    const paths: Array<[string, string]> = [
      ['GET', '/candidate-auth/me'], ['PUT', '/candidate-auth/me'], ['GET', '/candidate-auth/me/edit-history'],
      ['GET', '/candidate-auth/me/shares'], ['GET', '/candidate-auth/me/tracking'],
      ['GET', '/candidate-auth/me/document-requests'], ['POST', '/candidate-auth/me/document-requests/x/upload'],
      ['GET', '/candidate-auth/me/document-requests/x/download'], ['PUT', '/candidate-auth/change-password'],
      ['POST', '/candidate-auth/logout'],
    ];
    for (const [m, p] of paths) {
      expectStatus(await api(m, p, m === 'GET' ? undefined : {}), 401);
      expectStatus(await api(m, p, m === 'GET' ? undefined : {}, { token: admin }), 401);
    }
  });

  test('GET /candidate-auth/me returns the approved profile', async () => {
    const res = await api('GET', '/candidate-auth/me', undefined, { token: access });
    expectStatus(res, 200);
    assert.equal(res.data.email, email);
    assert.deepEqual(res.data.skills, ['Excel', 'Sales']);
    assert.deepEqual(res.data.languages, ['English', 'Hindi']);
    assert.equal(res.data.experience, 3);
    assert.equal(res.data.isPublic, false);
    assert.equal(res.data.status, 'NEW');
    assert.ok(res.data.cvId);
    assert.ok(Array.isArray(res.data.applications) && Array.isArray(res.data.interviews));
    cvId = res.data.cvId;
  });

  test('PUT /candidate-auth/me updates profile fields and ignores everything else', async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      headline: 'Senior QA', experience: '5', currentSalary: '1000', expectedSalary: '2000', visaStatus: 'Employment',
      portfolio: 'https://example.test', currency: 'USD',
      // not editable by the candidate
      email: testEmail('hijack'), status: 'PLACED', isPublic: 'true', cvId: 'HACKED', notes: 'hacked',
      source: 'x', categoryId: 'x', industryId: 'x',
    })) fd.append(k, v);
    fd.append('skills', 'Excel');
    fd.append('skills', 'Testing');
    fd.append('photo', samplePng(), 'new.png');
    const res = await api('PUT', '/candidate-auth/me', fd, { token: access });
    expectStatus(res, 200);
    assert.equal(res.data.headline, 'Senior QA');
    assert.equal(res.data.experience, 5);
    assert.equal(res.data.currentSalary, 1000);
    assert.equal(res.data.currency, 'USD');
    assert.deepEqual(res.data.skills, ['Excel', 'Testing']);
    assert.match(res.data.photo, /^uploads\/images\//);
    // allow-list regression
    assert.equal(res.data.email, email);
    assert.equal(res.data.status, 'NEW');
    assert.equal(res.data.isPublic, false);
    assert.equal(res.data.cvId, cvId);
    assert.equal(res.data.notes, null);
    assert.equal(res.data.categoryId, null);
  });

  test('PUT /candidate-auth/me validates numbers, names and the video URL', async () => {
    const bad = async (fields: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return api('PUT', '/candidate-auth/me', fd, { token: access });
    };
    expectStatus(await bad({ experience: 'lots' }), 400);
    expectStatus(await bad({ currentSalary: 'abc' }), 400);
    expectStatus(await bad({ firstName: '   ' }), 400);
    expectStatus(await bad({ introVideoUrl: 'https://evil.example/video' }), 400);
    const ok = await bad({ introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expectStatus(ok, 200);
    assert.equal(ok.data.introVideoUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('GET /candidate-auth/me/edit-history records the candidate\'s changes', async () => {
    const res = await api('GET', '/candidate-auth/me/edit-history', undefined, { token: access });
    expectStatus(res, 200);
    assert.ok(res.data.length >= 1);
    const entry = res.data.find((h: any) => h.changes.headline);
    assert.ok(entry);
    assert.equal(entry.editedBy, 'candidate');
    assert.deepEqual(entry.changes.headline, { old: 'QA Engineer', new: 'Senior QA' });
    assert.equal(entry.changes.email, undefined);
    assert.equal(entry.changes.isPublic, undefined);
  });

  test('GET shares / tracking / document-requests return (empty) lists', async () => {
    for (const p of ['/candidate-auth/me/shares', '/candidate-auth/me/tracking', '/candidate-auth/me/document-requests']) {
      const res = await api('GET', p, undefined, { token: access });
      expectStatus(res, 200);
      assert.deepEqual(res.data, []);
    }
  });

  test('document request: upload and download my own document; 404s for others', async () => {
    const created = await api('POST', '/document-requests', { candidateId, title: 'Passport.pdf' }, { token: admin });
    expectStatus(created, 201);
    docRequestId = created.data.id;

    expectStatus(await api('POST', `/candidate-auth/me/document-requests/${docRequestId}/upload`, new FormData(), { token: access }), 400);
    expectStatus(await api('GET', `/candidate-auth/me/document-requests/${docRequestId}/download`, undefined, { token: access }), 404);
    const fd = new FormData();
    fd.append('file', samplePdf('passport'), 'passport.pdf');
    expectStatus(await api('POST', '/candidate-auth/me/document-requests/does-not-exist/upload', fd, { token: access }), 404);

    const fd2 = new FormData();
    fd2.append('file', samplePdf('passport'), 'passport.pdf');
    const up = await api('POST', `/candidate-auth/me/document-requests/${docRequestId}/upload`, fd2, { token: access });
    expectStatus(up, 200);
    assert.equal(up.data.status, 'UPLOADED');

    const fd3 = new FormData();
    fd3.append('file', samplePdf('again'), 'again.pdf');
    expectStatus(await api('POST', `/candidate-auth/me/document-requests/${docRequestId}/upload`, fd3, { token: access }), 400);

    const list = await api('GET', '/candidate-auth/me/document-requests', undefined, { token: access });
    expectStatus(list, 200);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].filePath, undefined, 'file path is not exposed');

    const dl = await api('GET', `/candidate-auth/me/document-requests/${docRequestId}/download`, undefined, { token: access });
    expectStatus(dl, 200);
    assert.equal(dl.headers.get('content-type'), 'application/pdf');
    assert.match(dl.headers.get('content-disposition') || '', /attachment; filename="Passport.pdf"/);
    assert.match(String(dl.data), /^%PDF/);
    expectStatus(await api('GET', '/candidate-auth/me/document-requests/does-not-exist/download', undefined, { token: access }), 404);
  });

  test('POST /candidate-auth/refresh rotates the token and rejects other token types', async () => {
    expectStatus(await api('POST', '/candidate-auth/refresh', {}), 401);
    // an access token is not a refresh token
    expectStatus(await api('POST', '/candidate-auth/refresh', { refreshToken: access }), 401);
    await new Promise((r) => setTimeout(r, 1100));
    const res = await api('POST', '/candidate-auth/refresh', { refreshToken: refresh });
    expectStatus(res, 200);
    assert.notEqual(res.data.refreshToken, refresh);
    expectStatus(await api('POST', '/candidate-auth/refresh', { refreshToken: refresh }), 401);
    refresh = res.data.refreshToken;
    access = res.data.accessToken;
  });

  test('PUT /candidate-auth/change-password', async () => {
    expectStatus(await api('PUT', '/candidate-auth/change-password', { currentPassword: password }, { token: access }), 400);
    expectStatus(await api('PUT', '/candidate-auth/change-password', { currentPassword: password, newPassword: 'short' }, { token: access }), 400);
    expectStatus(await api('PUT', '/candidate-auth/change-password', { currentPassword: 'Wrong@12345', newPassword: 'Newer@12345' }, { token: access }), 400);
    expectStatus(await api('PUT', '/candidate-auth/change-password', { currentPassword: password, newPassword: 'Newer@12345' }, { token: access }), 200);
    expectStatus(await api('POST', '/candidate-auth/login', { email, password }), 401);
    password = 'Newer@12345';
    expectStatus(await api('POST', '/candidate-auth/login', { email, password }), 200);
  });

  test('POST /candidate-auth/logout revokes the refresh token', async () => {
    const login = await api('POST', '/candidate-auth/login', { email, password });
    expectStatus(login, 200);
    expectStatus(await api('POST', '/candidate-auth/logout', {}, { token: login.data.accessToken }), 200);
    expectStatus(await api('POST', '/candidate-auth/refresh', { refreshToken: login.data.refreshToken }), 401);
  });

  test('GET /candidate-auth/public-profiles is public, paginated and hides private profiles', async () => {
    const res = await api('GET', '/candidate-auth/public-profiles?limit=abc&page=-3');
    expectStatus(res, 200);
    assert.equal(res.data.page, 1);
    assert.ok(Array.isArray(res.data.data));
    assert.equal(typeof res.data.total, 'number');
    const mine = await api('GET', '/candidate-auth/public-profiles?search=Cand&limit=100');
    expectStatus(mine, 200);
    assert.ok(!mine.data.data.some((p: any) => p.id === candidateId), 'isPublic=false profile is hidden');
    assert.ok(mine.data.data.every((p: any) => p.email === undefined));
  });
});
