import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG, adminAuth, api, expectStatus, staffWithRole } from './_client';
import { staffUser } from './_rbac';
import { deleteCampaigns, disconnectDb, prisma } from './_emailDb';
import { rawHtml, render, renderSubject } from '@/server/utils/templateRenderer';

/** /emails/templates CRUD + duplicate, and the merge-tag renderer's escaping. */
describe('email templates', () => {
  let token: string;
  let viewer: Awaited<ReturnType<typeof staffWithRole>>;
  const created: string[] = [];
  const campaigns: string[] = [];
  let templateId: string;

  before(async () => {
    token = await adminAuth();
    viewer = await staffWithRole('VIEWER');
  });

  after(async () => {
    await deleteCampaigns(campaigns);
    if (created.length) await prisma.emailTemplate.deleteMany({ where: { id: { in: created } } });
    await viewer?.cleanup();
    await disconnectDb();
  });

  test('requires a token and an admin role', async () => {
    expectStatus(await api('GET', '/emails/templates'), 401);
    expectStatus(await api('POST', '/emails/templates', {}), 401);
    expectStatus(await api('GET', '/emails/templates/x'), 401);
    expectStatus(await api('PUT', '/emails/templates/x', {}), 401);
    expectStatus(await api('DELETE', '/emails/templates/x'), 401);
    expectStatus(await api('POST', '/emails/templates/x/duplicate', {}), 401);
    const t = { token: viewer.token };
    expectStatus(await api('GET', '/emails/templates', undefined, t), 403);
    expectStatus(await api('POST', '/emails/templates', { slug: `v-${TAG}`, name: 'x', subject: 'x', html: 'x' }, t), 403);
    expectStatus(await api('GET', '/emails/templates/x', undefined, t), 403);
    expectStatus(await api('PUT', '/emails/templates/x', {}, t), 403);
    expectStatus(await api('DELETE', '/emails/templates/x', undefined, t), 403);
    expectStatus(await api('POST', '/emails/templates/x/duplicate', {}, t), 403);
  });

  test('create validates required fields and types', async () => {
    expectStatus(await api('POST', '/emails/templates', { slug: `a-${TAG}`, name: 'x', subject: 'x' }, { token }), 400);
    expectStatus(await api('POST', '/emails/templates', {
      slug: `a-${TAG}`, name: 'x', subject: 'x', html: 'x', category: 'BOGUS',
    }, { token }), 400);
    expectStatus(await api('POST', '/emails/templates', {
      slug: `a-${TAG}`, name: 'x', subject: 'x', html: 'x', recipientType: 'ALIENS',
    }, { token }), 400);
    expectStatus(await api('POST', '/emails/templates', {
      slug: `a-${TAG}`, name: 'x', subject: 'x', html: 'x', isActive: 'yes',
    }, { token }), 400);
    expectStatus(await api('POST', '/emails/templates', {
      slug: { evil: true }, name: 'x', subject: 'x', html: 'x',
    }, { token }), 400);
  });

  test('creates a template, ignoring server-managed fields', async () => {
    const res = await api('POST', '/emails/templates', {
      slug: `tpl-${TAG}`, name: `Template ${TAG}`, category: 'TRANSACTIONAL', recipientType: 'CANDIDATES',
      module: 'candidates', subject: 'Hi {{name}}', html: '<p>Hello {{name}}</p>',
      design: { rows: [] }, mergeTags: [{ name: 'Name', value: '{{name}}' }],
      version: 99, createdBy: 'someone-else', id: 'forced-id',
    }, { token });
    expectStatus(res, 201);
    templateId = res.data.id;
    created.push(templateId);
    assert.notEqual(templateId, 'forced-id');
    assert.equal(res.data.version, 1);
    assert.notEqual(res.data.createdBy, 'someone-else');
    assert.equal(res.data.isActive, true);
    assert.deepEqual(res.data.design, { rows: [] });
  });

  test('duplicate slug is rejected', async () => {
    const res = await api('POST', '/emails/templates', { slug: `tpl-${TAG}`, name: 'x', subject: 'x', html: 'x' }, { token });
    expectStatus(res, 400);
    assert.match(res.data.error, /already exists/);
  });

  test('lists (light payload) with filters', async () => {
    const res = await api('GET', `/emails/templates?search=${TAG}&category=TRANSACTIONAL&recipientType=CANDIDATES`, undefined, { token });
    expectStatus(res, 200);
    const row = res.data.find((t: any) => t.id === templateId);
    assert.ok(row);
    assert.equal(row.html, undefined);
    assert.equal(row.design, undefined);
    expectStatus(await api('GET', '/emails/templates?category=BOGUS', undefined, { token }), 400);
    expectStatus(await api('GET', '/emails/templates?recipientType=BOGUS', undefined, { token }), 400);
  });

  test('gets the full template, 404 when unknown', async () => {
    const res = await api('GET', `/emails/templates/${templateId}`, undefined, { token });
    expectStatus(res, 200);
    assert.equal(res.data.html, '<p>Hello {{name}}</p>');
    assert.ok(Array.isArray(res.data.mergeTags));
    expectStatus(await api('GET', '/emails/templates/does-not-exist', undefined, { token }), 404);
  });

  test('update is partial, bumps the version and ignores server-managed fields', async () => {
    const res = await api('PUT', `/emails/templates/${templateId}`, {
      subject: 'Updated {{name}}', design: null, version: 500, createdBy: 'x', updatedBy: 'x',
    }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.subject, 'Updated {{name}}');
    assert.equal(res.data.html, '<p>Hello {{name}}</p>');
    assert.equal(res.data.version, 2);
    assert.equal(res.data.design, null);
    assert.notEqual(res.data.createdBy, 'x');
    assert.notEqual(res.data.updatedBy, 'x');
  });

  test('update validation and 404', async () => {
    expectStatus(await api('PUT', `/emails/templates/${templateId}`, { isActive: 'nope' }, { token }), 400);
    expectStatus(await api('PUT', `/emails/templates/${templateId}`, { subject: '   ' }, { token }), 400);
    expectStatus(await api('PUT', `/emails/templates/${templateId}`, { category: 'NOPE' }, { token }), 400);
    expectStatus(await api('PUT', '/emails/templates/does-not-exist', { name: 'x' }, { token }), 404);
    const seeded = await prisma.emailTemplate.findFirst({ where: { slug: 'otp-verification' } });
    if (seeded) {
      const clash = await api('PUT', `/emails/templates/${templateId}`, { slug: seeded.slug }, { token });
      expectStatus(clash, 400);
    }
  });

  test('toggles isActive', async () => {
    const res = await api('PUT', `/emails/templates/${templateId}`, { isActive: false }, { token });
    expectStatus(res, 200);
    assert.equal(res.data.isActive, false);
  });

  test('transactional templates cannot be deleted', async () => {
    const res = await api('DELETE', `/emails/templates/${templateId}`, undefined, { token });
    expectStatus(res, 400);
    assert.match(res.data.error, /transactional/i);
  });

  test('duplicate makes an editable CAMPAIGN copy; 404 when unknown', async () => {
    const res = await api('POST', `/emails/templates/${templateId}/duplicate`, { name: `Copy ${TAG}` }, { token });
    expectStatus(res, 201);
    created.push(res.data.id);
    assert.equal(res.data.name, `Copy ${TAG}`);
    assert.equal(res.data.category, 'CAMPAIGN');
    assert.equal(res.data.version, 1);
    assert.ok(res.data.slug.startsWith(`tpl-${TAG}-copy-`));
    assert.equal(res.data.html, '<p>Hello {{name}}</p>');

    const noName = await api('POST', `/emails/templates/${templateId}/duplicate`, {}, { token });
    expectStatus(noName, 201);
    created.push(noName.data.id);
    assert.equal(noName.data.name, `Template ${TAG} (copy)`);

    expectStatus(await api('POST', '/emails/templates/does-not-exist/duplicate', {}, { token }), 404);
  });

  test('a template used by a campaign cannot be deleted; otherwise delete works', async () => {
    const copyId = created[1];
    const camp = await api('POST', '/emails/campaigns', {
      name: `Uses template ${TAG}`, templateId: copyId, subject: 's', html: '<p>h</p>',
      targetMode: 'CUSTOM', customRecipients: [{ name: 'X', email: `x.${TAG}@example.test` }],
    }, { token });
    expectStatus(camp, 201);
    campaigns.push(camp.data.id);

    const blocked = await api('DELETE', `/emails/templates/${copyId}`, undefined, { token });
    expectStatus(blocked, 400);
    assert.match(blocked.data.error, /used by 1 campaign/);

    expectStatus(await api('DELETE', `/emails/campaigns/${camp.data.id}`, undefined, { token }), 200);
    const ok = await api('DELETE', `/emails/templates/${copyId}`, undefined, { token });
    expectStatus(ok, 200);
    expectStatus(await api('GET', `/emails/templates/${copyId}`, undefined, { token }), 404);
    expectStatus(await api('DELETE', `/emails/templates/${copyId}`, undefined, { token }), 404);
  });

  describe('render escaping (regression)', () => {
    test('merge values are HTML-escaped in bodies', () => {
      const out = render('<p>Hi {{name}}</p><a href="{{link}}">x</a>', {
        name: '<script>alert(1)</script>', link: 'https://x.test/?a=1&b="2"',
      });
      assert.equal(out, '<p>Hi &lt;script&gt;alert(1)&lt;/script&gt;</p><a href="https://x.test/?a=1&amp;b=&quot;2&quot;">x</a>');
      assert.ok(!out.includes('<script>'));
    });

    test('triple braces, rawHtml() and *Block/*Html keys are trusted', () => {
      const out = render('{{{raw}}}|{{safe}}|{{accountBlock}}|{{messageHtml}}|{{a.b}}|{{missing}}', {
        raw: '<b>r</b>', safe: rawHtml('<i>s</i>'), accountBlock: '<p>acc</p>', messageHtml: '<em>m</em>', a: { b: '<u>' },
      });
      assert.equal(out, '<b>r</b>|<i>s</i>|<p>acc</p>|<em>m</em>|&lt;u&gt;|');
    });

    test('subjects are not escaped but newlines are stripped', () => {
      assert.equal(renderSubject('Hi {{name}}', { name: 'A & B <x>\r\nBcc: evil@example.test' }), 'Hi A & B <x> Bcc: evil@example.test');
    });

    test('every seeded template still renders (no leftover tags, fragments raw, values escaped)', async () => {
      const templates = await prisma.emailTemplate.findMany();
      assert.ok(templates.length > 0);
      for (const t of templates) {
        const keys = new Set([...`${t.subject}${t.html}`.matchAll(/\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}\}/g)].map((m) => m[1]));
        const data: Record<string, string> = {};
        for (const k of keys) data[k] = /(Block|Html)$/.test(k) ? `<b data-k="${k}">frag</b>` : `<${k}>&`;
        const html = render(t.html, data);
        const subject = renderSubject(t.subject, data);
        assert.ok(!/\{\{/.test(html) && !/\{\{/.test(subject), `${t.slug}: unrendered tag`);
        for (const k of keys) {
          if (!new RegExp(`\\{\\{\\s*${k.replace('.', '\\.')}\\s*\\}\\}`).test(t.html)) continue;
          if (/(Block|Html)$/.test(k)) assert.ok(html.includes(`<b data-k="${k}">frag</b>`), `${t.slug}: ${k} should stay raw`);
          else assert.ok(html.includes(`&lt;${k}&gt;&amp;`) && !html.includes(`<${k}>`), `${t.slug}: ${k} should be escaped`);
        }
      }
    });
  });

  test('RBAC: ADMIN manages templates; an emails view/create override cannot edit or delete', async () => {
    const adminRole = await staffWithRole('ADMIN');
    const limited = await staffUser('tplcreate', 'VIEWER');
    try {
      const a = { token: adminRole.token };
      const res = await api('POST', '/emails/templates', {
        slug: `rbac-${TAG}`, name: `RBAC ${TAG}`, subject: 'x', html: '<p>x</p>', category: 'CAMPAIGN',
      }, a);
      expectStatus(res, 201);
      created.push(res.data.id);
      expectStatus(await api('PUT', `/emails/templates/${res.data.id}`, { name: `RBAC 2 ${TAG}` }, a), 200);

      expectStatus(await api('PUT', `/users/${limited.user.id}`, { permissions: { emails: ['view', 'create'] } }, { token }), 200);
      const l = { token: limited.token };
      expectStatus(await api('GET', '/emails/templates', undefined, l), 200);
      expectStatus(await api('GET', `/emails/templates/${res.data.id}`, undefined, l), 200);
      expectStatus(await api('PUT', `/emails/templates/${res.data.id}`, { name: 'x' }, l), 403);
      expectStatus(await api('DELETE', `/emails/templates/${res.data.id}`, undefined, l), 403);
      const dup = await api('POST', `/emails/templates/${res.data.id}/duplicate`, {}, l);
      expectStatus(dup, 201);
      created.push(dup.data.id);

      expectStatus(await api('DELETE', `/emails/templates/${res.data.id}`, undefined, a), 200);
    } finally {
      await adminRole.cleanup();
      await limited.cleanup();
    }
  });
});
