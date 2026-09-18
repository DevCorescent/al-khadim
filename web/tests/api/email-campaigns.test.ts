import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole, testEmail } from './_client';
import { deleteCampaigns, deleteHistoryFor, disconnectDb, prisma } from './_emailDb';

/**
 * /emails/campaigns — audience preview, filter meta, CRUD, test send,
 * schedule/cancel and a real "send now" fan-out to a CUSTOM audience made
 * only of @example.test addresses (SMTP is unset, so delivery is logged).
 */
describe('email campaigns', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  const campaignIds: string[] = [];
  let groupId: string;
  let templateId: string;
  let filterId: string;
  let groupCampaignId: string;
  let customId: string;

  const custom = [
    { name: '<script>alert("x")</script>', email: testEmail('c1') },
    { name: 'Plain Person', email: testEmail('c2') },
  ];

  async function createCampaign(body: Record<string, any>) {
    const res = await api('POST', '/emails/campaigns', body, { token });
    expectStatus(res, 201);
    campaignIds.push(res.data.id);
    return res.data;
  }

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('VIEWER');
    const g = await api('POST', '/emails/groups', { name: `Campaign group ${TAG}` }, { token });
    expectStatus(g, 201);
    groupId = g.data.id;
    const m = await api('POST', `/emails/groups/${groupId}/members`, {
      members: [
        { recipientType: 'USERS', recipientId: `u1-${TAG}`, name: 'Group One', email: testEmail('g1') },
        { recipientType: 'USERS', recipientId: `u2-${TAG}`, name: 'Group Two', email: testEmail('g2') },
      ],
    }, { token });
    expectStatus(m, 200);
    const t = await api('POST', '/emails/templates', {
      slug: `camp-tpl-${TAG}`, name: `Campaign tpl ${TAG}`, category: 'CAMPAIGN', subject: 'S', html: '<p>T</p>',
    }, { token });
    expectStatus(t, 201);
    templateId = t.data.id;
  });

  after(async () => {
    await deleteCampaigns(campaignIds);
    await deleteHistoryFor(TAG);
    if (groupId) await prisma.emailGroup.deleteMany({ where: { id: groupId } });
    if (templateId) await prisma.emailTemplate.deleteMany({ where: { id: templateId } });
    await viewer?.cleanup();
    await disconnectDb();
  });

  test('every endpoint requires a token and an admin role', async () => {
    const calls: [string, string][] = [
      ['POST', '/emails/campaigns/audience-preview'], ['GET', '/emails/campaigns/filter-meta/USERS'],
      ['GET', '/emails/campaigns'], ['POST', '/emails/campaigns'], ['GET', '/emails/campaigns/x'],
      ['PUT', '/emails/campaigns/x'], ['DELETE', '/emails/campaigns/x'], ['POST', '/emails/campaigns/x/send-test'],
      ['POST', '/emails/campaigns/x/send'], ['POST', '/emails/campaigns/x/schedule'], ['POST', '/emails/campaigns/x/cancel'],
    ];
    for (const [method, path] of calls) {
      const b = method === 'POST' || method === 'PUT' ? {} : undefined;
      assert.equal((await api(method, path, b)).status, 401, `${method} ${path}`);
      assert.equal((await api(method, path, b, { token: viewer.token })).status, 403, `${method} ${path} as VIEWER`);
    }
  });

  describe('filter-meta', () => {
    for (const type of ['CANDIDATES', 'EMPLOYEES', 'CLIENTS', 'CLIENT_USERS', 'USERS']) {
      test(`returns the field schema for ${type}`, async () => {
        const res = await api('GET', `/emails/campaigns/filter-meta/${type}`, undefined, { token });
        expectStatus(res, 200);
        assert.equal(res.data.recipientType, type);
        assert.ok(res.data.fields.length > 0);
        assert.ok(res.data.fields.some((f: any) => f.key === 'search'));
      });
    }
    test('unknown recipient type is 400', async () => {
      expectStatus(await api('GET', '/emails/campaigns/filter-meta/ALIENS', undefined, { token }), 400);
    });
  });

  describe('audience-preview', () => {
    test('FILTER: counts + sample for a recipient type', async () => {
      const res = await api('POST', '/emails/campaigns/audience-preview', {
        targetMode: 'FILTER', recipientType: 'USERS', filters: { search: TAG },
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.total, 1); // the VIEWER test user
      assert.equal(res.data.sample[0].email, viewer.user.email);
    });

    test('FILTER defaults and edge cases', async () => {
      const none = await api('POST', '/emails/campaigns/audience-preview', { targetMode: 'FILTER' }, { token });
      expectStatus(none, 200);
      assert.deepEqual(none.data, { total: 0, sample: [] });
      expectStatus(await api('POST', '/emails/campaigns/audience-preview', { recipientType: 'ALIENS' }, { token }), 400);
      const paged = await api('POST', '/emails/campaigns/audience-preview', {
        recipientType: 'CANDIDATES', page: 'x', limit: 'y',
      }, { token });
      expectStatus(paged, 200);
      assert.ok(paged.data.sample.length <= 10);
    });

    test('GROUP: member count + sample', async () => {
      const res = await api('POST', '/emails/campaigns/audience-preview', { targetMode: 'GROUP', groupId, limit: 1 }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.total, 2);
      assert.equal(res.data.sample.length, 1);
      const noGroup = await api('POST', '/emails/campaigns/audience-preview', { targetMode: 'GROUP' }, { token });
      assert.deepEqual(noGroup.data, { total: 0, sample: [] });
    });

    test('CUSTOM: paginates the given list', async () => {
      const res = await api('POST', '/emails/campaigns/audience-preview', {
        targetMode: 'CUSTOM', customRecipients: custom, page: 2, limit: 1,
      }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.total, 2);
      assert.deepEqual(res.data.sample, [custom[1]]);
    });
  });

  describe('create', () => {
    test('validates content and targeting', async () => {
      const base = { name: `Bad ${TAG}`, subject: 's', html: '<p>h</p>' };
      expectStatus(await api('POST', '/emails/campaigns', { subject: 's', html: 'h', recipientType: 'USERS' }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base }, { token }), 400); // FILTER without recipientType
      expectStatus(await api('POST', '/emails/campaigns', { ...base, recipientType: 'ALIENS' }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base, targetMode: 'EVERYONE' }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base, targetMode: 'GROUP' }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base, targetMode: 'GROUP', groupId: 'nope' }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base, targetMode: 'CUSTOM', customRecipients: [] }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns', { ...base, targetMode: 'CUSTOM', customRecipients: [{ name: 'no email' }] }, { token }), 400);
      const badTpl = await api('POST', '/emails/campaigns', { ...base, recipientType: 'USERS', templateId: 'nope' }, { token });
      expectStatus(badTpl, 400);
      assert.match(badTpl.data.error, /template/i);
      assert.equal(await prisma.emailCampaign.count({ where: { name: `Bad ${TAG}` } }), 0);
    });

    test('FILTER campaign (server-managed fields ignored)', async () => {
      const c = await createCampaign({
        name: `Filter ${TAG}`, subject: 'Hi {{name}}', html: '<p>Hi {{name}}</p>', templateId,
        recipientType: 'USERS', filters: { search: TAG },
        status: 'SENT', totalRecipients: 999, createdBy: 'someone-else',
      });
      filterId = c.id;
      assert.equal(c.status, 'DRAFT');
      assert.equal(c.totalRecipients, 0);
      assert.equal(c.targetMode, 'FILTER');
      assert.equal(c.module, 'system');
      assert.notEqual(c.createdBy, 'someone-else');
      assert.deepEqual(c.filters, { search: TAG });
    });

    test('GROUP campaign', async () => {
      const c = await createCampaign({
        name: `Group ${TAG}`, subject: 'Hi {{name}}', html: '<p>Hi {{name}}</p>', module: 'candidates',
        targetMode: 'GROUP', groupId, templateId,
      });
      groupCampaignId = c.id;
      assert.equal(c.groupId, groupId);
      assert.equal(c.recipientType, null);
      assert.equal(c.filters, null);
    });

    test('CUSTOM campaign', async () => {
      const c = await createCampaign({
        name: `Custom ${TAG}`, subject: 'Hello {{name}}\nBcc: x@example.test', html: '<p>Hello {{name}} ({{email}})</p>',
        targetMode: 'CUSTOM', customRecipients: custom,
      });
      customId = c.id;
      assert.equal(c.targetMode, 'CUSTOM');
      assert.equal(c.customRecipients.length, 2);
    });
  });

  describe('update', () => {
    test('partial edit keeps targeting', async () => {
      const res = await api('PUT', `/emails/campaigns/${filterId}`, { name: `Filter renamed ${TAG}`, status: 'SENT' }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.name, `Filter renamed ${TAG}`);
      assert.equal(res.data.status, 'DRAFT');
      assert.equal(res.data.recipientType, 'USERS');
    });

    test('unknown templateId is 400 (regression), null clears it', async () => {
      const bad = await api('PUT', `/emails/campaigns/${filterId}`, { templateId: 'does-not-exist' }, { token });
      expectStatus(bad, 400);
      assert.match(bad.data.error, /template/i);
      const cleared = await api('PUT', `/emails/campaigns/${filterId}`, { templateId: null }, { token });
      expectStatus(cleared, 200);
      assert.equal(cleared.data.templateId, null);
    });

    test('switching targeting nulls the other modes', async () => {
      const res = await api('PUT', `/emails/campaigns/${filterId}`, { targetMode: 'CUSTOM', customRecipients: custom.slice(1) }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.targetMode, 'CUSTOM');
      assert.equal(res.data.recipientType, null);
      assert.equal(res.data.filters, null);
      const back = await api('PUT', `/emails/campaigns/${filterId}`, { targetMode: 'FILTER', recipientType: 'USERS', filters: { search: TAG } }, { token });
      expectStatus(back, 200);
      assert.equal(back.data.customRecipients, null);
    });

    test('validation and 404', async () => {
      expectStatus(await api('PUT', `/emails/campaigns/${filterId}`, { subject: '' }, { token }), 400);
      expectStatus(await api('PUT', `/emails/campaigns/${filterId}`, { targetMode: 'GROUP', groupId: 'nope' }, { token }), 400);
      expectStatus(await api('PUT', '/emails/campaigns/does-not-exist', { name: 'x' }, { token }), 404);
    });
  });

  describe('list and detail', () => {
    test('lists with filters and safe pagination', async () => {
      const res = await api('GET', '/emails/campaigns?status=DRAFT&page=1&limit=100', undefined, { token });
      expectStatus(res, 200);
      const row = res.data.data.find((c: any) => c.id === groupCampaignId);
      assert.ok(row);
      assert.equal(row.group.id, groupId);
      assert.equal(row.template.id, templateId);
      const junk = await api('GET', '/emails/campaigns?page=-1&limit=abc', undefined, { token });
      expectStatus(junk, 200);
      assert.equal(junk.data.page, 1);
      assert.equal(junk.data.limit, 20);
      expectStatus(await api('GET', '/emails/campaigns?status=BOGUS', undefined, { token }), 400);
      expectStatus(await api('GET', '/emails/campaigns?recipientType=BOGUS', undefined, { token }), 400);
    });

    test('detail includes breakdown and paginated rows; 404 when unknown', async () => {
      const res = await api('GET', `/emails/campaigns/${groupCampaignId}`, undefined, { token });
      expectStatus(res, 200);
      assert.equal(res.data.group.name, `Campaign group ${TAG}`);
      assert.deepEqual(res.data.recipientBreakdown, []);
      assert.equal(res.data.scheduledEmails.total, 0);
      expectStatus(await api('GET', '/emails/campaigns/does-not-exist', undefined, { token }), 404);
    });
  });

  describe('send-test', () => {
    test('requires to; 404 when unknown', async () => {
      expectStatus(await api('POST', `/emails/campaigns/${customId}/send-test`, {}, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns/does-not-exist/send-test', { to: testEmail('t') }, { token }), 404);
    });

    test('sends one rendered, escaped test email without changing the campaign', async () => {
      const to = testEmail('sendtest');
      const res = await api('POST', `/emails/campaigns/${customId}/send-test`, { to }, { token });
      expectStatus(res, 200);
      const rows = await prisma.scheduledEmail.findMany({ where: { to } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'SENT');
      assert.equal(rows[0].campaignId, null);
      // Sample = first custom recipient, whose name is a <script> payload.
      assert.ok(rows[0].html!.includes('&lt;script&gt;'));
      assert.ok(!rows[0].html!.includes('<script>'));
      assert.ok(!/[\r\n]/.test(rows[0].subject));
      const c = await api('GET', `/emails/campaigns/${customId}`, undefined, { token });
      assert.equal(c.data.status, 'DRAFT');
    });
  });

  describe('schedule and cancel', () => {
    test('schedule validates sendAt; 404 when unknown', async () => {
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/schedule`, {}, { token }), 400);
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/schedule`, { sendAt: 'nope' }, { token }), 400);
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/schedule`, { sendAt: new Date(Date.now() - 1000).toISOString() }, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns/does-not-exist/schedule', { sendAt: new Date(Date.now() + 86400_000).toISOString() }, { token }), 404);
    });

    test('schedules the GROUP campaign: one PENDING row per member', async () => {
      const sendAt = new Date(Date.now() + 3 * 86400_000).toISOString();
      const res = await api('POST', `/emails/campaigns/${groupCampaignId}/schedule`, { sendAt }, { token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'SCHEDULED');
      assert.equal(res.data.totalRecipients, 2);
      assert.equal(new Date(res.data.scheduledAt).toISOString(), sendAt);
      const rows = await prisma.scheduledEmail.findMany({ where: { campaignId: groupCampaignId } });
      assert.equal(rows.length, 2);
      assert.ok(rows.every((r) => r.status === 'PENDING' && r.module === 'candidates'));
      assert.ok(rows.some((r) => r.html === '<p>Hi Group One</p>'));
    });

    test('a SCHEDULED campaign keeps template/group in the list (regression)', async () => {
      const res = await api('GET', '/emails/campaigns?status=SCHEDULED&limit=500', undefined, { token });
      expectStatus(res, 200);
      const row = res.data.data.find((c: any) => c.id === groupCampaignId);
      assert.ok(row, 'scheduled campaign listed');
      assert.equal(row.group?.id, groupId);
      assert.equal(row.template?.id, templateId);
    });

    test('non-draft campaigns cannot be edited, rescheduled, sent or deleted', async () => {
      expectStatus(await api('PUT', `/emails/campaigns/${groupCampaignId}`, { name: 'x' }, { token }), 400);
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/schedule`, { sendAt: new Date(Date.now() + 86400_000).toISOString() }, { token }), 400);
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/send`, {}, { token }), 400);
      expectStatus(await api('DELETE', `/emails/campaigns/${groupCampaignId}`, undefined, { token }), 400);
    });

    test('cancel marks the campaign and its pending rows CANCELLED', async () => {
      const res = await api('POST', `/emails/campaigns/${groupCampaignId}/cancel`, {}, { token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'CANCELLED');
      const rows = await prisma.scheduledEmail.findMany({ where: { campaignId: groupCampaignId } });
      assert.ok(rows.every((r) => r.status === 'CANCELLED'));
      expectStatus(await api('POST', `/emails/campaigns/${groupCampaignId}/cancel`, {}, { token }), 400);
    });

    test('cancel rejects drafts and unknown ids', async () => {
      expectStatus(await api('POST', `/emails/campaigns/${customId}/cancel`, {}, { token }), 400);
      expectStatus(await api('POST', '/emails/campaigns/does-not-exist/cancel', {}, { token }), 404);
    });
  });

  describe('send now', () => {
    test('404 when unknown; 400 when the audience is empty', async () => {
      expectStatus(await api('POST', '/emails/campaigns/does-not-exist/send', {}, { token }), 404);
      const empty = await createCampaign({
        name: `Empty ${TAG}`, subject: 's', html: 'h', recipientType: 'USERS', filters: { search: `nobody-${TAG}-x` },
      });
      const res = await api('POST', `/emails/campaigns/${empty.id}/send`, {}, { token });
      expectStatus(res, 400);
      assert.match(res.data.error, /No recipients/);
    });

    test('fans out the CUSTOM audience with escaped merge values, then completes', async () => {
      const res = await api('POST', `/emails/campaigns/${customId}/send`, {}, { token });
      expectStatus(res, 200);
      assert.equal(res.data.status, 'SENDING');
      assert.equal(res.data.totalRecipients, 2);

      const rows = await prisma.scheduledEmail.findMany({ where: { campaignId: customId }, orderBy: { to: 'asc' } });
      assert.equal(rows.length, 2);
      const evil = rows.find((r) => r.to === custom[0].email)!;
      assert.equal(evil.html, `<p>Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; (${custom[0].email})</p>`);
      assert.equal(evil.subject, 'Hello <script>alert("x")</script> Bcc: x@example.test');
      assert.equal(evil.recipientName, custom[0].name);

      expectStatus(await api('POST', '/emails/run-scheduler', {}, { token }), 200);
      const after = await prisma.scheduledEmail.findMany({ where: { campaignId: customId } });
      assert.ok(after.every((r) => r.status === 'SENT'), JSON.stringify(after.map((r) => r.status)));

      const detail = await api('GET', `/emails/campaigns/${customId}`, undefined, { token });
      expectStatus(detail, 200);
      assert.equal(detail.data.status, 'SENT');
      assert.equal(detail.data.sentCount, 2);
      assert.ok(detail.data.sentAt, 'sentAt is recorded when the campaign completes');
      assert.deepEqual(detail.data.recipientBreakdown, [{ status: 'SENT', _count: 2 }]);
      assert.equal(detail.data.scheduledEmails.total, 2);

      const hist = await api('GET', `/emails/scheduled?campaignId=${customId}&source=campaign`, undefined, { token });
      expectStatus(hist, 200);
      assert.equal(hist.data.total, 2);
      assert.equal(hist.data.data[0].campaign.id, customId);
    });

    test('concurrent sends of one draft fan out only once', async () => {
      const c = await createCampaign({
        name: `Race ${TAG}`, subject: 's', html: '<p>{{name}}</p>', targetMode: 'CUSTOM',
        customRecipients: [{ name: 'Racer', email: testEmail('race') }],
      });
      const results = await Promise.all([1, 2, 3].map(() => api('POST', `/emails/campaigns/${c.id}/send`, {}, { token })));
      assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results.map((r) => r.status)));
      assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 400));
      assert.equal(await prisma.scheduledEmail.count({ where: { campaignId: c.id } }), 1);
    });
  });

  describe('delete', () => {
    test('deletes a draft; 404 afterwards', async () => {
      expectStatus(await api('DELETE', `/emails/campaigns/${filterId}`, undefined, { token }), 200);
      expectStatus(await api('GET', `/emails/campaigns/${filterId}`, undefined, { token }), 404);
      expectStatus(await api('DELETE', `/emails/campaigns/${filterId}`, undefined, { token }), 404);
    });

    test('sent campaigns cannot be deleted', async () => {
      expectStatus(await api('DELETE', `/emails/campaigns/${customId}`, undefined, { token }), 400);
    });
  });
});
