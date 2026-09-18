// Ported from api/src/routes/emailCampaigns.js
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { render, renderSubject } from '../utils/templateRenderer';
import { pagination, pickFields } from '../validate';
import { sendMail } from '../utils/mailer';
import {
  filterMeta as getFilterMeta,
  previewCampaignAudience, resolveCampaignAudience,
} from '../utils/audienceQuery';

// Prisma rejects a literal `null` for a nullable Json column; DbNull stores SQL NULL.
const jsonOrDbNull = (v: any) => (v === null ? Prisma.DbNull : v);

const CAMPAIGN_INCLUDE = {
  template: { select: { id: true, name: true, slug: true } },
  group: { select: { id: true, name: true } },
} as const;
const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'];
const RECIPIENT_TYPES = ['CANDIDATES', 'EMPLOYEES', 'CLIENTS', 'CLIENT_USERS', 'USERS'];
const TARGET_MODES = ['FILTER', 'GROUP', 'CUSTOM'];
/** Body fields a client may set on create/update; status/counts/createdBy are server-managed. */
const WRITABLE_FIELDS = [
  'name', 'templateId', 'subject', 'html', 'design', 'module',
  'targetMode', 'recipientType', 'filters', 'groupId', 'customRecipients',
] as const;

/** Refresh sentCount/failedCount/status from the fanned-out ScheduledEmail rows. */
async function syncCampaignStatus(campaignId: string) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === 'DRAFT' || campaign.status === 'CANCELLED') return campaign;

  const grouped: any[] = await (prisma.scheduledEmail.groupBy as any)({
    by: ['status'],
    where: { campaignId },
    _count: true,
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const sentCount = counts.SENT || 0;
  const failedCount = counts.FAILED || 0;
  const pending = counts.PENDING || 0;

  const patch: any = { sentCount, failedCount };
  if (pending === 0 && campaign.status !== 'SENT') {
    patch.status = 'SENT';
    patch.sentAt = new Date();
  }

  return prisma.emailCampaign.update({ where: { id: campaignId }, data: patch, include: CAMPAIGN_INCLUDE });
}

/* ── Audience preview (live count + sample, no persistence) ── */
export const audiencePreview = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  const { targetMode = 'FILTER', recipientType, filters, groupId, customRecipients, page, limit } = (await body(req)) || {};
  try {
    const result = await previewCampaignAudience(
      { targetMode, recipientType, filters, groupId, customRecipients },
      { page, limit }
    );
    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Filter field schema for a recipient type ── */
export const filterMeta = handler<{ recipientType: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'view');
  try {
    return json(getFilterMeta(params.recipientType));
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── List campaigns (paginated, stats synced) ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  const q = query(req);
  const { status, recipientType } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20 });
  if (status && !CAMPAIGN_STATUSES.includes(status)) {
    return json({ error: `status must be one of ${CAMPAIGN_STATUSES.join(', ')}` }, 400);
  }
  if (recipientType && !RECIPIENT_TYPES.includes(recipientType)) {
    return json({ error: `recipientType must be one of ${RECIPIENT_TYPES.join(', ')}` }, 400);
  }
  const where: any = {};
  if (status) where.status = status;
  if (recipientType) where.recipientType = recipientType;

  const [rows, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: CAMPAIGN_INCLUDE,
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  // syncCampaignStatus re-reads the row with the same includes, so synced
  // entries keep their template/group like the rest of the page.
  const synced = await Promise.all(
    rows.map(async (c) => (c.status === 'SENDING' || c.status === 'SCHEDULED' ? (await syncCampaignStatus(c.id)) || c : c))
  );

  return json({ data: synced, total, page, limit });
});

/* ── Campaign detail + recipient breakdown + paginated ScheduledEmail rows ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'view');
  const { page, limit, skip } = pagination(query(req), { defaultLimit: 20 });
  await syncCampaignStatus(params.id);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: params.id },
    include: CAMPAIGN_INCLUDE,
  });
  if (!campaign) return json({ error: 'Campaign not found' }, 404);

  const [breakdown, emails, emailsTotal] = await Promise.all([
    (prisma.scheduledEmail.groupBy as any)({ by: ['status'], where: { campaignId: campaign.id }, _count: true }) as Promise<any[]>,
    prisma.scheduledEmail.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, to: true, recipientName: true, status: true, error: true, sentAt: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.scheduledEmail.count({ where: { campaignId: campaign.id } }),
  ]);

  return json({
    ...campaign,
    recipientBreakdown: breakdown.map((b) => ({ status: b.status, _count: b._count })),
    scheduledEmails: { data: emails, total: emailsTotal, page, limit },
  });
});

function badRequest(message: string) {
  const err: any = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Validates the targeting fields for a given mode and returns the full
 * targeting bundle to persist, explicitly nulling out the fields that
 * belong to the *other* modes so a campaign never retains stale
 * groupId/customRecipients/recipientType+filters from a previous edit.
 */
async function buildTargetingData(targetMode: any, { recipientType, filters, groupId, customRecipients }: any) {
  if (!TARGET_MODES.includes(targetMode)) throw badRequest(`targetMode must be one of ${TARGET_MODES.join(', ')}`);
  if (targetMode === 'GROUP') {
    if (!groupId) throw badRequest('groupId is required for GROUP targeting');
    const group = await prisma.emailGroup.findUnique({ where: { id: groupId } });
    if (!group) throw badRequest('The selected group does not exist');
    return { targetMode, groupId, recipientType: null, filters: Prisma.DbNull, customRecipients: Prisma.DbNull };
  }
  if (targetMode === 'CUSTOM') {
    if (!Array.isArray(customRecipients) || customRecipients.length === 0) {
      throw badRequest('customRecipients must be a non-empty array for CUSTOM targeting');
    }
    const invalid = customRecipients.some((r: any) => !r || typeof r !== 'object' || typeof r.email !== 'string' || !r.email.trim()
      || (r.name !== undefined && r.name !== null && typeof r.name !== 'string'));
    if (invalid) throw badRequest('Every custom recipient needs an email (and an optional name string)');
    return { targetMode, customRecipients, recipientType: null, filters: Prisma.DbNull, groupId: null };
  }
  // FILTER (default)
  if (!recipientType) throw badRequest('recipientType is required for FILTER targeting');
  if (!RECIPIENT_TYPES.includes(recipientType)) throw badRequest(`recipientType must be one of ${RECIPIENT_TYPES.join(', ')}`);
  if (filters !== undefined && filters !== null && (typeof filters !== 'object' || Array.isArray(filters))) {
    throw badRequest('filters must be an object');
  }
  return { targetMode: 'FILTER', recipientType, filters: filters || {}, groupId: null, customRecipients: Prisma.DbNull };
}

/** Type-checks the non-targeting fields and that a referenced template exists. */
async function checkContentFields(data: Record<string, any>) {
  for (const key of ['name', 'subject', 'html', 'module'] as const) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'string') {
      throw badRequest(`${key} must be a string`);
    }
  }
  if (data.templateId !== undefined && data.templateId !== null && data.templateId !== '') {
    if (typeof data.templateId !== 'string') throw badRequest('templateId must be a string');
    const template = await prisma.emailTemplate.findUnique({ where: { id: data.templateId }, select: { id: true } });
    if (!template) throw badRequest('The selected template does not exist');
  }
}

/* ── Create draft campaign ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'emails', 'create');
  const fields: Record<string, any> = pickFields((await body(req)) || {}, WRITABLE_FIELDS);
  const {
    name, templateId, subject, html, design, module,
    targetMode = 'FILTER', recipientType, filters, groupId, customRecipients,
  } = fields;
  if (!name || !subject || !html) {
    return json({ error: 'name, subject and html are required' }, 400);
  }
  try {
    await checkContentFields(fields);
    const targeting = await buildTargetingData(targetMode, { recipientType, filters, groupId, customRecipients });
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        templateId: templateId || undefined,
        subject,
        html,
        design: design === undefined ? undefined : jsonOrDbNull(design),
        module: module || 'system',
        ...targeting,
        status: 'DRAFT',
        createdBy: user.id,
      } as any,
    });
    return json(campaign, 201);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Update draft campaign ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'edit');
  const existing = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Campaign not found' }, 404);
  if (existing.status !== 'DRAFT') {
    return json({ error: 'Only draft campaigns can be edited' }, 400);
  }

  const fields: Record<string, any> = pickFields((await body(req)) || {}, WRITABLE_FIELDS);
  const {
    name, templateId, subject, html, design, module,
    targetMode, recipientType, filters, groupId, customRecipients,
  } = fields;
  for (const key of ['name', 'subject', 'html'] as const) {
    if (fields[key] !== undefined && (typeof fields[key] !== 'string' || !fields[key].trim())) {
      return json({ error: `${key} cannot be blank` }, 400);
    }
  }
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (templateId !== undefined) data.templateId = templateId || null;
  if (subject !== undefined) data.subject = subject;
  if (html !== undefined) data.html = html;
  if (design !== undefined) data.design = jsonOrDbNull(design);
  if (module !== undefined) data.module = module;

  // Only recompute targeting when the request actually touches it — a plain
  // subject/html edit shouldn't require re-sending the full targeting bundle.
  const targetingTouched = targetMode !== undefined || recipientType !== undefined
    || filters !== undefined || groupId !== undefined || customRecipients !== undefined;

  try {
    await checkContentFields(fields);
    if (targetingTouched) {
      const effectiveMode = targetMode || existing.targetMode;
      const targeting = await buildTargetingData(effectiveMode, {
        recipientType: recipientType !== undefined ? recipientType : existing.recipientType,
        filters: filters !== undefined ? filters : existing.filters,
        groupId: groupId !== undefined ? groupId : existing.groupId,
        customRecipients: customRecipients !== undefined ? customRecipients : existing.customRecipients,
      });
      Object.assign(data, targeting);
    }
    const campaign = await prisma.emailCampaign.update({ where: { id: params.id }, data });
    return json(campaign);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Delete draft campaign ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'delete');
  const existing = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Campaign not found' }, 404);
  if (existing.status !== 'DRAFT') {
    return json({ error: 'Only draft campaigns can be deleted' }, 400);
  }
  await prisma.emailCampaign.delete({ where: { id: params.id } });
  return json({ message: 'Campaign deleted' });
});

/* ── Send a one-off test to a single address (no ScheduledEmail row, no status change) ── */
export const sendTest = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'send');
  const { to } = (await body(req)) || {};
  if (!to || typeof to !== 'string') return json({ error: 'to is required' }, 400);

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return json({ error: 'Campaign not found' }, 404);

  let sampleData: Record<string, any> = { name: 'Test User', email: 'test@example.com' };
  try {
    const preview: any = await previewCampaignAudience(campaign as any, { limit: 1 });
    if (preview.sample?.[0]) sampleData = { name: preview.sample[0].name, email: preview.sample[0].email };
  } catch {
    // fall back to placeholder sampleData above
  }

  try {
    const subject = renderSubject(campaign.subject, sampleData);
    const html = render(campaign.html, sampleData);
    await sendMail({ module: campaign.module, to, subject, html });
    return json({ message: `Test email sent to ${to}` });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/**
 * Resolves the campaign's audience and fans out one ScheduledEmail per
 * recipient. The DRAFT -> SENDING/SCHEDULED transition is claimed atomically
 * inside the same transaction as the fan-out, so two concurrent send/schedule
 * requests can't both enqueue the audience (the loser gets a 400).
 */
async function fanOut(campaignId: string, userId: string, sendAt: Date, mode: 'send' | 'schedule') {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return json({ error: 'Campaign not found' }, 404);
  const notDraft = mode === 'send'
    ? 'Only draft campaigns can be sent — create a new campaign to resend'
    : 'Only draft campaigns can be scheduled';
  if (campaign.status !== 'DRAFT') return json({ error: notDraft }, 400);

  try {
    // Always fan out against the campaign's own stored targeting — GROUP and
    // CUSTOM modes have no meaningful "override filters" concept, and a
    // FILTER campaign's filters are already persisted on the row (edited via
    // PUT /:id before sending), so there's no need for a request-body override.
    const recipients: any[] = await resolveCampaignAudience(campaign as any);
    if (recipients.length === 0) {
      return json({ error: 'No recipients match the current targeting' }, 400);
    }

    const rows = recipients.map((r) => ({
      module: campaign.module,
      to: r.email,
      subject: renderSubject(campaign.subject, { name: r.name, email: r.email }),
      html: render(campaign.html, { name: r.name, email: r.email }),
      sendAt,
      campaignId: campaign.id,
      recipientId: r.id != null ? String(r.id) : null,
      recipientName: r.name ?? null,
      createdBy: userId,
    }));

    const finalData: any = mode === 'send'
      ? { status: 'SENDING', totalRecipients: recipients.length }
      : { status: 'SCHEDULED', scheduledAt: sendAt, totalRecipients: recipients.length };

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailCampaign.updateMany({
        where: { id: campaign.id, status: 'DRAFT' },
        data: finalData,
      });
      if (claimed.count === 0) return null;
      await tx.scheduledEmail.createMany({ data: rows });
      return tx.emailCampaign.findUnique({ where: { id: campaign.id } });
    }, { timeout: 60_000 });
    if (!updated) return json({ error: notDraft }, 400);
    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
}

/* ── Send now: resolve audience, fan out one ScheduledEmail per recipient ── */
export const sendNow = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'emails', 'send');
  return fanOut(params.id, user.id, new Date(), 'send');
});

/* ── Schedule for later: same fan-out with a future sendAt ── */
export const schedule = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'emails', 'send');
  const { sendAt } = (await body(req)) || {};
  if (!sendAt) return json({ error: 'sendAt is required' }, 400);
  const sendAtDate = new Date(sendAt);
  if (Number.isNaN(sendAtDate.getTime()) || sendAtDate <= new Date()) {
    return json({ error: 'sendAt must be a valid future date/time' }, 400);
  }
  return fanOut(params.id, user.id, sendAtDate, 'schedule');
});

/* ── Cancel a scheduled/sending campaign — skips any not-yet-sent rows ── */
export const cancel = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'emails', 'send');
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return json({ error: 'Campaign not found' }, 404);
  if (campaign.status !== 'SCHEDULED' && campaign.status !== 'SENDING') {
    return json({ error: 'Only scheduled or in-progress campaigns can be cancelled' }, 400);
  }

  await prisma.scheduledEmail.updateMany({
    where: { campaignId: campaign.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  const updated = await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'CANCELLED' } });
  return json(updated);
});
