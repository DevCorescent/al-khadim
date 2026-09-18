import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, api, expectStatus, samplePng, staffWithRole } from './_client';
import { StaffUser, staffUsers, staffWithCustomRole } from './_rbacRecruitment';
import { createCandidate, createTrackingIndustry, deleteCandidate } from './_recruitment';

function csvForm(csv: string, name = 'tracking.csv', type = 'text/csv') {
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type }), name);
  return fd;
}

describe('candidate-tracking', () => {
  let token: string;
  let recruiter: Awaited<ReturnType<typeof staffWithRole>>;
  let industry: any;
  let candidateId: string;
  let recordId: string;

  before(async () => {
    token = await adminAuth();
    recruiter = await staffWithRole('RECRUITER');
    industry = await createTrackingIndustry(token);
    // quotes/commas in the name exercise the Content-Disposition sanitising
    candidateId = (await createCandidate(token, { firstName: 'Tr"ack', lastName: 'Er, Test' })).id;
  });

  after(async () => {
    if (recordId) await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token });
    if (candidateId) await deleteCandidate(token, candidateId);
    if (industry) await api('DELETE', `/industries/${industry.id}`, undefined, { token });
    await recruiter?.cleanup();
  });

  test('staff endpoints require a token', async () => {
    expectStatus(await api('GET', '/candidate-tracking'), 401);
    expectStatus(await api('POST', '/candidate-tracking', {}), 401);
    expectStatus(await api('GET', '/candidate-tracking/x'), 401);
    expectStatus(await api('PUT', '/candidate-tracking/x', {}), 401);
    expectStatus(await api('DELETE', '/candidate-tracking/x'), 401);
    expectStatus(await api('GET', '/candidate-tracking/sample-csv?industry=X'), 401);
    expectStatus(await api('GET', '/candidate-tracking/x/export-csv'), 401);
    expectStatus(await api('POST', '/candidate-tracking/x/import-csv', new FormData()), 401);
  });

  test('templates are public and include tracking industries', async () => {
    const res = await api('GET', '/candidate-tracking/templates');
    expectStatus(res, 200);
    assert.equal(res.data[industry.key].label, industry.name);
    assert.equal(res.data[industry.key].sections[0].key, 'onboarding');
  });

  test('sample CSV', async () => {
    expectStatus(await api('GET', '/candidate-tracking/sample-csv', undefined, { token }), 400);
    expectStatus(await api('GET', '/candidate-tracking/sample-csv?industry=NOPE_NOT_REAL', undefined, { token }), 400);
    const res = await api('GET', `/candidate-tracking/sample-csv?industry=${industry.key}`, undefined, { token });
    expectStatus(res, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/);
    assert.match(res.headers.get('content-disposition') || '', new RegExp(`${industry.key}_tracking_template\\.csv`));
    const csv = String(res.data);
    assert.match(csv, /^Section,Field,Item,Value/);
    assert.match(csv, /Onboarding,Docs,Passport - Status,/);
    assert.match(csv, /Onboarding,Certs,Row 1 - Name,/);
  });

  test('create validates input', async () => {
    expectStatus(await api('POST', '/candidate-tracking', { candidateId }, { token }), 400);
    expectStatus(await api('POST', '/candidate-tracking', { candidateId, industry: 'NOPE_NOT_REAL' }, { token }), 400);
    expectStatus(await api('POST', '/candidate-tracking', { candidateId: 'does-not-exist', industry: industry.key }, { token }), 404);
    expectStatus(await api('POST', '/candidate-tracking', { candidateId: ['x'], industry: industry.key }, { token }), 400);
  });

  test('create starts tracking (idempotent) and ignores extra fields', async () => {
    const res = await api('POST', '/candidate-tracking', {
      candidateId, industry: industry.key, visibility: 'PUBLIC', visibleToCompany: true, data: { hacked: true },
    }, { token });
    expectStatus(res, 201);
    recordId = res.data.id;
    assert.equal(res.data.visibility, 'PRIVATE');
    assert.equal(res.data.visibleToCompany, false);
    assert.deepEqual(res.data.data, {});
    assert.equal(res.data.industry.key, industry.key);
    const again = await api('POST', '/candidate-tracking', { candidateId, industry: industry.key }, { token });
    expectStatus(again, 201);
    assert.equal(again.data.id, recordId);
  });

  test('list by candidate and globally', async () => {
    const byCandidate = await api('GET', `/candidate-tracking?candidateId=${candidateId}`, undefined, { token });
    expectStatus(byCandidate, 200);
    assert.equal(byCandidate.data.length, 1);
    assert.equal(byCandidate.data[0].id, recordId);
    const global = await api('GET', `/candidate-tracking?industry=${industry.key}&limit=10`, undefined, { token });
    expectStatus(global, 200);
    assert.equal(global.data.total, 1);
    assert.equal(global.data.page, 1);
    assert.equal(global.data.data[0].candidate.id, candidateId);
    expectStatus(await api('GET', '/candidate-tracking?visibility=SECRET', undefined, { token }), 400);
  });

  test('get and 404', async () => {
    const res = await api('GET', `/candidate-tracking/${recordId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.candidate.id, candidateId);
    expectStatus(await api('GET', '/candidate-tracking/does-not-exist', undefined, { token }), 404);
  });

  test('update data and visibility; protected fields ignored', async () => {
    const data = { onboarding: { site: 'Dubai', years: 3, docs: { Passport: { status: 'Done' } }, certs: [{ name: 'OSHA', year: 2024 }] } };
    const res = await api('PUT', `/candidate-tracking/${recordId}`, {
      data, visibility: 'PUBLIC', visibleToCompany: true, candidateId: 'hijack', industryId: 'hijack',
    }, { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.data, data);
    assert.equal(res.data.visibility, 'PUBLIC');
    assert.equal(res.data.visibleToCompany, true);
    assert.equal(res.data.visibleToCandidate, false);
    assert.equal(res.data.candidateId, candidateId);
    assert.ok(res.data.updatedByUserId);
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { visibility: 'SECRET' }, { token }), 400);
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { data: 'text' }, { token }), 400);
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { data: [1, 2] }, { token }), 400);
    expectStatus(await api('PUT', '/candidate-tracking/does-not-exist', { visibility: 'PUBLIC' }, { token }), 404);
  });

  test('export CSV contains the data and a safe filename', async () => {
    const res = await api('GET', `/candidate-tracking/${recordId}/export-csv`, undefined, { token });
    expectStatus(res, 200);
    const disposition = res.headers.get('content-disposition') || '';
    assert.match(disposition, /^attachment; filename="[\w.-]+\.csv"$/);
    const csv = String(res.data);
    assert.match(csv, /Onboarding,Site,,Dubai/);
    assert.match(csv, /Onboarding,Certs,Row 1 - Name,OSHA/);
    expectStatus(await api('GET', '/candidate-tracking/does-not-exist/export-csv', undefined, { token }), 404);
  });

  test('import CSV validation', async () => {
    expectStatus(await api('POST', `/candidate-tracking/${recordId}/import-csv`, new FormData(), { token }), 400);
    const png = new FormData();
    png.append('file', samplePng(), 'x.png');
    expectStatus(await api('POST', `/candidate-tracking/${recordId}/import-csv`, png, { token }), 400);
    expectStatus(await api('POST', `/candidate-tracking/${recordId}/import-csv`, csvForm('a,b\n1,2'), { token }), 400);
    // huge sparse table rows are refused instead of allocating millions of entries
    expectStatus(await api('POST', `/candidate-tracking/${recordId}/import-csv`,
      csvForm('Section,Field,Item,Value\r\nOnboarding,Certs,Row 99999999 - Name,X'), { token }), 400);
    expectStatus(await api('POST', '/candidate-tracking/does-not-exist/import-csv', csvForm('Section,Field,Item,Value'), { token }), 404);
  });

  test('import CSV replaces the data', async () => {
    const csv = [
      'Section,Field,Item,Value',
      'Onboarding,Site,,Abu Dhabi',
      'Onboarding,Years,,7',
      'Onboarding,Docs,Visa - Status,Pending',
      'Onboarding,Certs,Row 2 - Year,2025',
    ].join('\r\n');
    const res = await api('POST', `/candidate-tracking/${recordId}/import-csv`, csvForm(csv), { token });
    expectStatus(res, 200);
    assert.deepEqual(res.data.data, {
      onboarding: { site: 'Abu Dhabi', years: 7, docs: { Visa: { status: 'Pending' } }, certs: [{}, { year: 2025 }] },
    });
  });

  test('delete requires an admin; then 404', async () => {
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token: recruiter.token }), 403);
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token }), 200);
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token }), 404);
    recordId = '';
  });
});

describe('candidate-tracking RBAC and CSV safety', () => {
  let admin: string;
  let staff: { users: Record<string, StaffUser>; cleanup: () => Promise<void> };
  let custom: StaffUser;
  let industry: any;
  let candidateId: string;
  let recordId: string;

  before(async () => {
    admin = await adminAuth();
    staff = await staffUsers('VIEWER', 'RECRUITER', 'HR', 'ADMIN');
    custom = await staffWithCustomRole({ candidates: ['view', 'delete'] });
    industry = await createTrackingIndustry(admin);
    candidateId = (await createCandidate(admin)).id;
  });

  after(async () => {
    if (recordId) await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token: admin });
    if (candidateId) await deleteCandidate(admin, candidateId);
    if (industry) await api('DELETE', `/industries/${industry.id}`, undefined, { token: admin });
    await staff?.cleanup();
    await custom?.cleanup();
  });

  test('RECRUITER can start and edit tracking', async () => {
    const token = staff.users.RECRUITER.token;
    const res = await api('POST', '/candidate-tracking', { candidateId, industry: industry.key }, { token });
    expectStatus(res, 201);
    recordId = res.data.id;
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { visibility: 'PUBLIC' }, { token }), 200);
  });

  test('VIEWER can read and export but not create, edit, import or delete', async () => {
    const token = staff.users.VIEWER.token;
    expectStatus(await api('GET', `/candidate-tracking?candidateId=${candidateId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/candidate-tracking/${recordId}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/candidate-tracking/sample-csv?industry=${industry.key}`, undefined, { token }), 200);
    expectStatus(await api('GET', `/candidate-tracking/${recordId}/export-csv`, undefined, { token }), 200);
    expectStatus(await api('POST', '/candidate-tracking', { candidateId, industry: industry.key }, { token }), 403);
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { visibility: 'PRIVATE' }, { token }), 403);
    expectStatus(await api('POST', `/candidate-tracking/${recordId}/import-csv`, csvForm('Section,Field,Item,Value'), { token }), 403);
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token }), 403);
  });

  test('HR has no access to tracking records', async () => {
    const token = staff.users.HR.token;
    expectStatus(await api('GET', `/candidate-tracking?candidateId=${candidateId}`, undefined, { token }), 403);
    expectStatus(await api('GET', `/candidate-tracking/${recordId}/export-csv`, undefined, { token }), 403);
  });

  test('export neutralises spreadsheet formulas and import round-trips the values', async () => {
    const data = {
      onboarding: {
        site: '=HYPERLINK("http://evil.example","x")',
        years: -3,
        docs: { Passport: { status: '+SUM(A1)', notes: '@cmd' } },
        certs: [{ name: '-2+3', year: 2024 }],
      },
    };
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { data }, { token: admin }), 200);
    const res = await api('GET', `/candidate-tracking/${recordId}/export-csv`, undefined, { token: admin });
    expectStatus(res, 200);
    const csv = String(res.data);
    const values = csv.split('\r\n').slice(1).map((line) => line.slice(line.lastIndexOf(',') + 1));
    for (const cell of csv.split(/[,\r\n]+/)) {
      assert.doesNotMatch(cell.replace(/^"/, ''), /^[=+\-@\t\r]/, `unescaped formula cell: ${cell}`);
    }
    assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil\.example"",""x""\)"/);
    assert.ok(values.includes("'-3"));
    assert.ok(values.includes("'+SUM(A1)"));
    assert.ok(values.includes("'@cmd"));

    const imported = await api('POST', `/candidate-tracking/${recordId}/import-csv`, csvForm(csv), { token: admin });
    expectStatus(imported, 200);
    assert.deepEqual(imported.data.data, data);
  });

  test('a custom role grants exactly its permissions', async () => {
    const { token } = custom;
    expectStatus(await api('GET', `/candidate-tracking/${recordId}`, undefined, { token }), 200);
    expectStatus(await api('PUT', `/candidate-tracking/${recordId}`, { visibility: 'PRIVATE' }, { token }), 403);
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token: staff.users.RECRUITER.token }), 403);
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token }), 200);
    recordId = '';
  });

  test('ADMIN can delete', async () => {
    const res = await api('POST', '/candidate-tracking', { candidateId, industry: industry.key }, { token: admin });
    expectStatus(res, 201);
    recordId = res.data.id;
    expectStatus(await api('DELETE', `/candidate-tracking/${recordId}`, undefined, { token: staff.users.ADMIN.token }), 200);
    recordId = '';
  });
});
