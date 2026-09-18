// Ported from api/src/routes/emailTemplates.js
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { pickFields } from '../validate';

// Prisma rejects a literal `null` for a nullable Json column; DbNull stores SQL NULL.
const jsonOrDbNull = (v: any) => (v === null ? Prisma.DbNull : v);

/** Body fields a client may set; version/createdBy/updatedBy are server-managed. */
const WRITABLE_FIELDS = ['slug', 'name', 'category', 'recipientType', 'module', 'subject', 'html', 'design', 'mergeTags', 'isActive'] as const;
const CATEGORIES = ['TRANSACTIONAL', 'CAMPAIGN'];
const RECIPIENT_TYPES = ['CANDIDATES', 'EMPLOYEES', 'CLIENTS', 'CLIENT_USERS', 'USERS'];

/** Type-checks an allow-listed payload so bad input is a 400, not a Prisma 500. */
function validateTemplateData(data: Record<string, any>) {
  for (const key of ['slug', 'name', 'subject', 'html', 'module'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'string') throw new HttpError(400, `${key} must be a string`);
  }
  for (const key of ['slug', 'name', 'subject', 'html'] as const) {
    if (data[key] !== undefined && !data[key].trim()) throw new HttpError(400, `${key} cannot be blank`);
  }
  if (data.slug !== undefined) data.slug = data.slug.trim();
  if (data.category !== undefined && !CATEGORIES.includes(data.category)) {
    throw new HttpError(400, `category must be one of ${CATEGORIES.join(', ')}`);
  }
  if (data.recipientType !== undefined && data.recipientType !== null && !RECIPIENT_TYPES.includes(data.recipientType)) {
    throw new HttpError(400, `recipientType must be one of ${RECIPIENT_TYPES.join(', ')}`);
  }
  if (data.recipientType === '') data.recipientType = null;
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw new HttpError(400, 'isActive must be a boolean');
  if (data.module === '') delete data.module;
  if (data.design !== undefined) data.design = jsonOrDbNull(data.design);
  if (data.mergeTags !== undefined) data.mergeTags = jsonOrDbNull(data.mergeTags);
  return data;
}

const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  category: true,
  recipientType: true,
  module: true,
  subject: true,
  isActive: true,
  version: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
};

/* ── List templates (light payload — no html/design) ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  const { category, recipientType, search } = query(req);
  const where: any = {};
  if (category && !CATEGORIES.includes(category)) return json({ error: `category must be one of ${CATEGORIES.join(', ')}` }, 400);
  if (recipientType && !RECIPIENT_TYPES.includes(recipientType)) {
    return json({ error: `recipientType must be one of ${RECIPIENT_TYPES.join(', ')}` }, 400);
  }
  if (category) where.category = category;
  if (recipientType) where.recipientType = recipientType;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const templates = await prisma.emailTemplate.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return json(templates);
});

/* ── Full template (incl. html/design/mergeTags) ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'view');
  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) return json({ error: 'Template not found' }, 404);
  return json(template);
});

/* ── Create template ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'emails', 'create');
  const payload: Record<string, any> = pickFields((await body(req)) || {}, WRITABLE_FIELDS);
  if (!payload.slug || !payload.name || !payload.subject || !payload.html) {
    return json({ error: 'slug, name, subject and html are required' }, 400);
  }
  const data = validateTemplateData(payload);

  const existing = await prisma.emailTemplate.findUnique({ where: { slug: data.slug } });
  if (existing) return json({ error: `A template with slug "${data.slug}" already exists` }, 400);

  try {
    const template = await prisma.emailTemplate.create({
      data: { ...(data as any), createdBy: user.id },
    });
    return json(template, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Update template (partial, bumps version) ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'emails', 'edit');
  const data: Record<string, any> = validateTemplateData(pickFields((await body(req)) || {}, WRITABLE_FIELDS));

  const existing = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Template not found' }, 404);

  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await prisma.emailTemplate.findUnique({ where: { slug: data.slug } });
    if (slugTaken) return json({ error: `A template with slug "${data.slug}" already exists` }, 400);
  }

  data.version = existing.version + 1;
  data.updatedBy = user.id;

  try {
    const template = await prisma.emailTemplate.update({ where: { id: params.id }, data });
    return json(template);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Duplicate template ── */
export const duplicate = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'emails', 'create');
  const original = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!original) return json({ error: 'Template not found' }, 404);

  const { name } = (await body(req)) || {};
  if (name !== undefined && name !== null && typeof name !== 'string') return json({ error: 'name must be a string' }, 400);
  try {
    const copy = await prisma.emailTemplate.create({
      data: {
        slug: `${original.slug}-copy-${Date.now().toString(36)}`,
        name: name || `${original.name} (copy)`,
        // Duplicating a system template makes an editable CAMPAIGN variant, not
        // another undeletable TRANSACTIONAL one — the point of duplicating is
        // to freely tweak/delete a copy.
        category: original.category === 'TRANSACTIONAL' ? 'CAMPAIGN' : original.category,
        recipientType: original.recipientType,
        module: original.module,
        subject: original.subject,
        html: original.html,
        design: jsonOrDbNull(original.design),
        mergeTags: jsonOrDbNull(original.mergeTags),
        isActive: original.isActive,
        version: 1,
        createdBy: user.id,
      },
    });
    return json(copy, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Delete template ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'delete');
  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) return json({ error: 'Template not found' }, 404);

  if (template.category === 'TRANSACTIONAL') {
    return json({
      error: 'System (transactional) templates cannot be deleted — deactivate it instead (set isActive: false).',
    }, 400);
  }

  const campaignCount = await prisma.emailCampaign.count({ where: { templateId: template.id } });
  if (campaignCount > 0) {
    return json({
      error: `This template is used by ${campaignCount} campaign(s) and cannot be deleted.`,
    }, 400);
  }

  await prisma.emailTemplate.delete({ where: { id: template.id } });
  return json({ message: 'Template deleted' });
});
