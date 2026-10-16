/**
 * Page builder API: pages (draft/published), revisions, saved blocks, image
 * uploads and the public form endpoint.
 */
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json } from '../http';
import { parseUpload } from '../upload';
import { deleteUpload } from '../storage';
import { rateLimit } from '../rateLimit';
import { sanitizePageDoc } from '../utils/pageSanitize';
import { emptyDoc, findNode } from '@/lib/pageBuilder/doc';
import { PAGE_TEMPLATES } from '@/lib/pageBuilder/templates';
import { slugError, slugify, type PageDoc } from '@/lib/pageBuilder/types';

const MAX_REVISIONS = 60;

const summary = {
  id: true, title: true, slug: true, status: true, publishedAt: true, createdAt: true, updatedAt: true,
} as const;

function cleanTitle(v: unknown) {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!t) throw new HttpError(400, 'Give the page a title');
  return t;
}

function cleanSlug(v: unknown) {
  const s = slugify(String(v ?? ''));
  const err = slugError(s);
  if (err) throw new HttpError(400, err);
  return s;
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const hit = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
  if (hit && hit.id !== exceptId) throw new HttpError(409, `Another page already uses /${slug}`);
}

async function uniqueSlug(base: string) {
  let slug = base, i = 2;
  while (await prisma.page.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${i++}`.slice(0, 80);
  return slug;
}

async function pruneRevisions(pageId: string) {
  const old = await prisma.pageRevision.findMany({ where: { pageId }, orderBy: { createdAt: 'desc' }, skip: MAX_REVISIONS, select: { id: true } });
  if (old.length) await prisma.pageRevision.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/* ─── Pages ─────────────────────────────────────────────────────────────── */

export const list = handler(async (req) => {
  await requirePermission(req, 'pages', 'view');
  const pages = await prisma.page.findMany({ orderBy: { updatedAt: 'desc' }, select: { ...summary, draft: true, published: true } });
  return json(pages.map(({ draft, published, ...p }) => ({
    ...p,
    sections: Array.isArray((draft as any)?.sections) ? (draft as any).sections.length : 0,
    hasUnpublishedChanges: p.status === 'published' && !same(draft, published),
  })));
});

export const create = handler(async (req) => {
  const user = await requirePermission(req, 'pages', 'create');
  const b = await body(req);
  const title = cleanTitle(b.title);
  const slug = cleanSlug(b.slug || title);
  await assertSlugFree(slug);
  let doc: PageDoc = emptyDoc();
  if (b.doc) doc = sanitizePageDoc(b.doc);
  else if (b.template) {
    const t = PAGE_TEMPLATES.find(x => x.id === b.template);
    if (t) doc = sanitizePageDoc({ ...emptyDoc(), sections: t.build() });
  }
  doc.seo.title ||= title;
  const page = await prisma.page.create({
    data: { title, slug, draft: doc as any, createdById: user.id, updatedById: user.id },
    select: summary,
  });
  return json(page, 201);
});

export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'pages', 'view');
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) return json({ error: 'Page not found' }, 404);
  return json({ ...page, draft: sanitizePageDoc(page.draft), hasUnpublishedChanges: page.status === 'published' && !same(page.draft, page.published) });
});

/**
 * Saves title/slug and/or the draft. `baseUpdatedAt` guards against two
 * editors overwriting each other: a stale save gets 409 unless `force` is set.
 * `revision` (a label) also snapshots the saved draft into the history.
 */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'pages', 'edit');
  const b = await body(req);
  const page = await prisma.page.findUnique({ where: { id: params.id }, select: { id: true, updatedAt: true, updatedById: true, title: true } });
  if (!page) return json({ error: 'Page not found' }, 404);
  if (b.draft && b.baseUpdatedAt && !b.force && new Date(b.baseUpdatedAt).getTime() < page.updatedAt.getTime()) {
    const by = page.updatedById && page.updatedById !== user.id
      ? await prisma.user.findUnique({ where: { id: page.updatedById }, select: { name: true, email: true } }).catch(() => null)
      : null;
    throw new HttpError(409, 'This page was changed in another tab or by someone else since you opened it.', {
      conflict: true, updatedAt: page.updatedAt, by: by ? by.name || by.email : null,
    });
  }
  const data: Record<string, any> = { updatedById: user.id };
  if (b.title !== undefined) data.title = cleanTitle(b.title);
  if (b.slug !== undefined) { data.slug = cleanSlug(b.slug); await assertSlugFree(data.slug, page.id); }
  if (b.draft !== undefined) data.draft = sanitizePageDoc(b.draft) as any;
  const saved = await prisma.page.update({ where: { id: page.id }, data, select: { ...summary, draft: true, published: true } });
  if (b.revision && data.draft) {
    await prisma.pageRevision.create({ data: { pageId: page.id, title: saved.title, label: String(b.revision).slice(0, 80), content: data.draft, createdById: user.id } });
    await pruneRevisions(page.id);
  }
  const { draft, published, ...rest } = saved;
  return json({ ...rest, draft, hasUnpublishedChanges: saved.status === 'published' && !same(draft, published) });
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'pages', 'delete');
  const page = await prisma.page.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!page) return json({ error: 'Page not found' }, 404);
  await prisma.page.delete({ where: { id: page.id } });
  return json({ ok: true });
});

export const publish = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'pages', 'publish');
  const b = await body(req);
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) return json({ error: 'Page not found' }, 404);
  // Publishing straight from the editor sends the latest draft along, which needs edit rights too.
  if (b.draft) await requirePermission(req, 'pages', 'edit');
  const doc = sanitizePageDoc(b.draft ?? page.draft);
  const saved = await prisma.page.update({
    where: { id: page.id },
    data: { draft: doc as any, published: doc as any, status: 'published', publishedAt: new Date(), updatedById: user.id },
    select: summary,
  });
  await prisma.pageRevision.create({ data: { pageId: page.id, title: saved.title, label: 'Published', content: doc as any, createdById: user.id } });
  await pruneRevisions(page.id);
  return json({ ...saved, hasUnpublishedChanges: false });
});

export const unpublish = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'pages', 'publish');
  const page = await prisma.page.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!page) return json({ error: 'Page not found' }, 404);
  const saved = await prisma.page.update({ where: { id: page.id }, data: { status: 'draft', updatedById: user.id }, select: summary });
  return json({ ...saved, hasUnpublishedChanges: false });
});

export const duplicate = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'pages', 'create');
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) return json({ error: 'Page not found' }, 404);
  const slug = await uniqueSlug(`${page.slug}-copy`.slice(0, 74));
  const copy = await prisma.page.create({
    data: { title: `${page.title} (copy)`.slice(0, 140), slug, draft: page.draft as any, createdById: user.id, updatedById: user.id },
    select: summary,
  });
  return json(copy, 201);
});

/* ─── Revisions ─────────────────────────────────────────────────────────── */

export const revisions = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'pages', 'view');
  const revs = await prisma.pageRevision.findMany({
    where: { pageId: params.id }, orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, label: true, createdAt: true, createdById: true },
  });
  const ids = [...new Set(revs.map(r => r.createdById).filter(Boolean))] as string[];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const name = (id?: string | null) => { const u = users.find(x => x.id === id); return u ? u.name || u.email : null; };
  return json(revs.map(r => ({ ...r, by: name(r.createdById) })));
});

export const revision = handler<{ id: string; revId: string }>(async (req, { params }) => {
  await requirePermission(req, 'pages', 'view');
  const rev = await prisma.pageRevision.findFirst({ where: { id: params.revId, pageId: params.id } });
  if (!rev) return json({ error: 'Revision not found' }, 404);
  return json({ ...rev, content: sanitizePageDoc(rev.content) });
});

export const restore = handler<{ id: string; revId: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'pages', 'edit');
  const [page, rev] = await Promise.all([
    prisma.page.findUnique({ where: { id: params.id } }),
    prisma.pageRevision.findFirst({ where: { id: params.revId, pageId: params.id } }),
  ]);
  if (!page || !rev) return json({ error: 'Revision not found' }, 404);
  // Keep the current draft so the restore itself can be undone.
  await prisma.pageRevision.create({ data: { pageId: page.id, title: page.title, label: 'Before restore', content: page.draft as any, createdById: user.id } });
  const doc = sanitizePageDoc(rev.content);
  const saved = await prisma.page.update({ where: { id: page.id }, data: { draft: doc as any, updatedById: user.id }, select: { ...summary, draft: true, published: true } });
  await pruneRevisions(page.id);
  const { published, ...rest } = saved;
  return json({ ...rest, hasUnpublishedChanges: saved.status === 'published' && !same(saved.draft, published) });
});

/* ─── Saved blocks ──────────────────────────────────────────────────────── */

export const listBlocks = handler(async (req) => {
  await requirePermission(req, 'pages', 'view');
  const blocks = await prisma.pageBlock.findMany({ orderBy: { createdAt: 'desc' } });
  return json(blocks);
});

export const createBlock = handler(async (req) => {
  const user = await requirePermission(req, 'pages', 'edit');
  const b = await body(req);
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) throw new HttpError(400, 'Name the block');
  const doc = sanitizePageDoc({ sections: [b.section] });
  if (!doc.sections.length) throw new HttpError(400, 'Only sections can be saved as blocks');
  const block = await prisma.pageBlock.create({
    data: { name, category: String(b.category || 'Saved').trim().slice(0, 40) || 'Saved', content: doc.sections[0] as any, createdById: user.id },
  });
  return json(block, 201);
});

export const removeBlock = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'pages', 'edit');
  await prisma.pageBlock.deleteMany({ where: { id: params.id } });
  return json({ ok: true });
});

/* ─── Uploads ───────────────────────────────────────────────────────────── */

export const uploadImage = handler(async (req) => {
  await requirePermission(req, 'pages', 'edit');
  const { file } = await parseUpload(req, ['image']);
  if (!file) return json({ error: 'No file uploaded' }, 400);
  if (!file.mimetype.startsWith('image/')) {
    await deleteUpload(file.path);
    return json({ error: 'Only image files can be uploaded here' }, 400);
  }
  return json({ url: `/${file.path}`, path: file.path });
});

/* ─── Public form submissions ───────────────────────────────────────────── */

const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, message: 'Too many submissions — please try again in a few minutes.' });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A form element on a published page posts here. The form definition is read
 * from the published page (never trusted from the client), values are
 * validated against it, and the result is stored as a CRM enquiry.
 */
export const submitForm = handler(async (req) => {
  formLimiter(req);
  const b = await body(req);
  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (b.website) return json({ ok: true });
  const slug = String(b.slug || '');
  const page = slug ? await prisma.page.findUnique({ where: { slug }, select: { title: true, slug: true, status: true, published: true } }) : null;
  if (!page || page.status !== 'published' || !page.published) throw new HttpError(404, 'This form is no longer available');
  const doc = sanitizePageDoc(page.published);
  const hit = findNode(doc.sections, String(b.elementId || ''));
  if (!hit || hit.node.type !== 'form') throw new HttpError(404, 'This form is no longer available');
  const fields: any[] = Array.isArray(hit.node.props.fields) ? hit.node.props.fields : [];
  const values: unknown[] = Array.isArray(b.values) ? b.values : [];

  const mapped: Record<string, string> = {};
  const extra: string[] = [];
  const errors: string[] = [];
  fields.forEach((f, i) => {
    const v = String(values[i] ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, f.type === 'textarea' ? 4000 : 300);
    const empty = !v || (f.type === 'checkbox' && v === 'No');
    if (f.required && empty) errors.push(`${f.label || 'A field'} is required`);
    if (!empty && f.type === 'email' && !EMAIL_RE.test(v)) errors.push(`${f.label || 'Email'} is not a valid email address`);
    if (!empty && ['select', 'radio'].includes(f.type)) {
      const opts = String(f.options || '').split('\n').map((s: string) => s.trim()).filter(Boolean);
      if (opts.length && !opts.includes(v)) errors.push(`Choose a valid option for ${f.label || 'a field'}`);
    }
    if (empty) return;
    const key = ['contactName', 'email', 'phone', 'companyName', 'designation', 'service', 'message'].includes(f.map) ? f.map : 'custom';
    if (key !== 'custom' && !mapped[key]) mapped[key] = v;
    else extra.push(`${String(f.label || 'Field').slice(0, 80)}: ${v}`);
  });
  if (errors.length) throw new HttpError(400, errors[0], { errors });

  const email = mapped.email && EMAIL_RE.test(mapped.email) ? mapped.email : '';
  if (!email && !mapped.phone) throw new HttpError(400, 'Please leave an email address or phone number so we can reply');
  const message = [
    mapped.message,
    extra.length ? extra.join('\n') : '',
    `— Sent from the "${page.title}" page (/${page.slug})`,
  ].filter(Boolean).join('\n\n');
  const enquiry = await prisma.clientEnquiry.create({
    data: {
      companyName: mapped.companyName || mapped.contactName || 'Website visitor',
      contactName: mapped.contactName || mapped.companyName || 'Website visitor',
      designation: mapped.designation || null,
      email: email || '—',
      phone: mapped.phone || '—',
      service: mapped.service || null,
      message,
    },
    select: { id: true },
  });
  return json({ ok: true, id: enquiry.id }, 201);
});
