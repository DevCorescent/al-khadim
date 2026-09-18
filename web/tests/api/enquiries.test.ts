import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { cleanupTagged, db } from './_authDb';

describe('enquiries', () => {
  let admin: string;
  let enquiryId: string;
  const email = testEmail('enq');

  before(async () => {
    admin = await adminAuth();
  });

  after(async () => {
    await cleanupTagged();
    await db.$disconnect();
  });

  test('POST /enquiries/public validates required fields', async () => {
    expectStatus(await api('POST', '/enquiries/public', {}), 400);
    expectStatus(await api('POST', '/enquiries/public', { companyName: 'X', contactName: 'Y', email: 'bad', phone: '1' }), 400);
  });

  test('POST /enquiries/public stores only the form fields (allow-list)', async () => {
    const res = await api('POST', '/enquiries/public', {
      companyName: `Enq Co ${TAG}`, contactName: 'Enquirer', designation: 'HR', email, phone: '+97140000001',
      service: 'Recruitment', message: '<script>alert(1)</script>',
      // not allowed from the public form
      status: 'CONVERTED', clientId: 'someone-elses-client', id: 'x', createdAt: '2020-01-01',
    });
    expectStatus(res, 201);
    enquiryId = res.data.id;
    const row = await db.clientEnquiry.findUnique({ where: { id: enquiryId } });
    assert.equal(row!.status, 'NEW');
    assert.equal(row!.clientId, null);
    assert.equal(row!.designation, 'HR');
  });

  test('staff endpoints need a staff token', async () => {
    expectStatus(await api('GET', '/enquiries'), 401);
    expectStatus(await api('PUT', `/enquiries/${enquiryId}`, { status: 'CLOSED' }), 401);
    expectStatus(await api('POST', `/enquiries/${enquiryId}/convert`), 401);
  });

  test('GET /enquiries lists and filters by status', async () => {
    const res = await api('GET', '/enquiries?status=NEW', undefined, { token: admin });
    expectStatus(res, 200);
    assert.ok(res.data.some((e: any) => e.id === enquiryId));
    assert.ok(res.data.every((e: any) => e.status === 'NEW'));
  });

  test('PUT /enquiries/:id applies the allow-list and validates', async () => {
    const res = await api('PUT', `/enquiries/${enquiryId}`, { status: 'IN_PROGRESS', clientId: 'x', createdAt: '2020-01-01' }, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.status, 'IN_PROGRESS');
    assert.equal(res.data.clientId, null);
    expectStatus(await api('PUT', `/enquiries/${enquiryId}`, { status: 'WHATEVER' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/enquiries/${enquiryId}`, { email: 'bad' }, { token: admin }), 400);
    expectStatus(await api('PUT', `/enquiries/${enquiryId}`, { companyName: '' }, { token: admin }), 400);
    expectStatus(await api('PUT', '/enquiries/does-not-exist', { status: 'CLOSED' }, { token: admin }), 404);
  });

  test('POST /enquiries/:id/convert creates a client + LEAD deal once', async () => {
    expectStatus(await api('POST', '/enquiries/does-not-exist/convert', undefined, { token: admin }), 404);
    const res = await api('POST', `/enquiries/${enquiryId}/convert`, undefined, { token: admin });
    expectStatus(res, 200);
    assert.equal(res.data.enquiry.status, 'CONVERTED');
    assert.equal(res.data.client.email, email);
    assert.equal(res.data.deal.stage, 'LEAD');
    assert.equal(res.data.deal.enquiryId, enquiryId);
    expectStatus(await api('POST', `/enquiries/${enquiryId}/convert`, undefined, { token: admin }), 400);
  });

  test('RBAC: list/update need enquiries view/edit; convert also needs clients create', async () => {
    const manager = await staffWithRole('MANAGER');
    const recruiter = await staffWithRole('RECRUITER');
    const noClients = await staffWithRole('VIEWER');
    try {
      const mk = async (name: string) => {
        const r = await api('POST', '/enquiries/public', {
          companyName: `Enq RBAC ${name} ${TAG}`, contactName: 'X', email: testEmail(`enq${name}`), phone: '+97140000002',
        });
        expectStatus(r, 201);
        return r.data.id as string;
      };
      const e1 = await mk('one');
      // RECRUITER preset has no enquiries access
      expectStatus(await api('GET', '/enquiries', undefined, { token: recruiter.token }), 403);
      expectStatus(await api('PUT', `/enquiries/${e1}`, { status: 'CLOSED' }, { token: recruiter.token }), 403);
      expectStatus(await api('POST', `/enquiries/${e1}/convert`, undefined, { token: recruiter.token }), 403);

      // enquiries view/edit without clients create: can update but not convert
      expectStatus(await api('PUT', `/users/${noClients.user.id}`, { permissions: { enquiries: ['view', 'edit'] } }, { token: admin }), 200);
      expectStatus(await api('GET', '/enquiries', undefined, { token: noClients.token }), 200);
      expectStatus(await api('PUT', `/enquiries/${e1}`, { status: 'IN_PROGRESS' }, { token: noClients.token }), 200);
      expectStatus(await api('POST', `/enquiries/${e1}/convert`, undefined, { token: noClients.token }), 403);

      // MANAGER has enquiries edit + clients create
      const conv = await api('POST', `/enquiries/${e1}/convert`, undefined, { token: manager.token });
      expectStatus(conv, 200);
      assert.equal(conv.data.enquiry.status, 'CONVERTED');
    } finally {
      await manager.cleanup();
      await recruiter.cleanup();
      await noClients.cleanup();
    }
  });
});
