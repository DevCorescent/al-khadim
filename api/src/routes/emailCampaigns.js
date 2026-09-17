const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { render } = require('../utils/templateRenderer');
const { sendMail } = require('../utils/mailer');
const {
  previewAudience, filterMeta,
  previewCampaignAudience, resolveCampaignAudience,
} = require('../utils/audienceQuery');

const prisma = new PrismaClient();

/** Refresh sentCount/failedCount/status from the fanned-out ScheduledEmail rows. */
async function syncCampaignStatus(campaignId) {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === 'DRAFT' || campaign.status === 'CANCELLED') return campaign;

  const grouped = await prisma.scheduledEmail.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const sentCount = counts.SENT || 0;
  const failedCount = counts.FAILED || 0;
  const pending = counts.PENDING || 0;

  const patch = { sentCount, failedCount };
  if (pending === 0 && campaign.status !== 'SENT') patch.status = 'SENT';

  return prisma.emailCampaign.update({ where: { id: campaignId }, data: patch });
}

/* ── Audience preview (live count + sample, no persistence) ── */
router.post('/audience-preview', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { targetMode = 'FILTER', recipientType, filters, groupId, customRecipients, page, limit } = req.body || {};
  try {
    const result = await previewCampaignAudience(
      { targetMode, recipientType, filters, groupId, customRecipients },
      { page, limit }
    );
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Filter field schema for a recipient type ── */
router.get('/filter-meta/:recipientType', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), (req, res) => {
  try {
    res.json(filterMeta(req.params.recipientType));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── List campaigns (paginated, stats synced) ── */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { status, recipientType, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (recipientType) where.recipientType = recipientType;
  const skip = (Number(page) - 1) * Number(limit);

  const [rows, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, slug: true } },
        group: { select: { id: true, name: true } },
      },
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  const synced = await Promise.all(
    rows.map((c) => (c.status === 'SENDING' || c.status === 'SCHEDULED' ? syncCampaignStatus(c.id) : c))
  );

  res.json({ data: synced, total, page: Number(page), limit: Number(limit) });
});

/* ── Campaign detail + recipient breakdown + paginated ScheduledEmail rows ── */
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  await syncCampaignStatus(req.params.id);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: req.params.id },
    include: {
      template: { select: { id: true, name: true, slug: true } },
      group: { select: { id: true, name: true } },
    },
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const skip = (Number(page) - 1) * Number(limit);
  const [breakdown, emails, emailsTotal] = await Promise.all([
    prisma.scheduledEmail.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: true }),
    prisma.scheduledEmail.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, to: true, recipientName: true, status: true, error: true, sentAt: true },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'asc' },
    }),
    prisma.scheduledEmail.count({ where: { campaignId: campaign.id } }),
  ]);

  res.json({
    ...campaign,
    recipientBreakdown: breakdown.map((b) => ({ status: b.status, _count: b._count })),
    scheduledEmails: { data: emails, total: emailsTotal, page: Number(page), limit: Number(limit) },
  });
});

/**
 * Validates the targeting fields for a given mode and returns the full
 * targeting bundle to persist, explicitly nulling out the fields that
 * belong to the *other* modes so a campaign never retains stale
 * groupId/customRecipients/recipientType+filters from a previous edit.
 */
async function buildTargetingData(targetMode, { recipientType, filters, groupId, customRecipients }) {
  if (targetMode === 'GROUP') {
    if (!groupId) {
      const err = new Error('groupId is required for GROUP targeting');
      err.status = 400;
      throw err;
    }
    const group = await prisma.emailGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      const err = new Error('The selected group does not exist');
      err.status = 400;
      throw err;
    }
    return { targetMode, groupId, recipientType: null, filters: null, customRecipients: null };
  }
  if (targetMode === 'CUSTOM') {
    if (!Array.isArray(customRecipients) || customRecipients.length === 0) {
      const err = new Error('customRecipients must be a non-empty array for CUSTOM targeting');
      err.status = 400;
      throw err;
    }
    return { targetMode, customRecipients, recipientType: null, filters: null, groupId: null };
  }
  // FILTER (default)
  if (!recipientType) {
    const err = new Error('recipientType is required for FILTER targeting');
    err.status = 400;
    throw err;
  }
  return { targetMode: 'FILTER', recipientType, filters: filters || {}, groupId: null, customRecipients: null };
}

/* ── Create draft campaign ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const {
    name, templateId, subject, html, design, module,
    targetMode = 'FILTER', recipientType, filters, groupId, customRecipients,
  } = req.body || {};
  if (!name || !subject || !html) {
    return res.status(400).json({ error: 'name, subject and html are required' });
  }
  try {
    const targeting = await buildTargetingData(targetMode, { recipientType, filters, groupId, customRecipients });
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        templateId: templateId || undefined,
        subject,
        html,
        design,
        module: module || 'system',
        ...targeting,
        status: 'DRAFT',
        createdBy: req.user.id,
      },
    });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Update draft campaign ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const existing = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Campaign not found' });
  if (existing.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Only draft campaigns can be edited' });
  }

  const {
    name, templateId, subject, html, design, module,
    targetMode, recipientType, filters, groupId, customRecipients,
  } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (templateId !== undefined) data.templateId = templateId;
  if (subject !== undefined) data.subject = subject;
  if (html !== undefined) data.html = html;
  if (design !== undefined) data.design = design;
  if (module !== undefined) data.module = module;

  // Only recompute targeting when the request actually touches it — a plain
  // subject/html edit shouldn't require re-sending the full targeting bundle.
  const targetingTouched = targetMode !== undefined || recipientType !== undefined
    || filters !== undefined || groupId !== undefined || customRecipients !== undefined;

  try {
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
    const campaign = await prisma.emailCampaign.update({ where: { id: req.params.id }, data });
    res.json(campaign);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Delete draft campaign ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const existing = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Campaign not found' });
  if (existing.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Only draft campaigns can be deleted' });
  }
  await prisma.emailCampaign.delete({ where: { id: req.params.id } });
  res.json({ message: 'Campaign deleted' });
});

/* ── Send a one-off test to a single address (no ScheduledEmail row, no status change) ── */
router.post('/:id/send-test', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to is required' });

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  let sampleData = { name: 'Test User', email: 'test@example.com' };
  try {
    const preview = await previewAudience(campaign.recipientType, campaign.filters, { limit: 1 });
    if (preview.sample?.[0]) sampleData = { name: preview.sample[0].name, email: preview.sample[0].email };
  } catch {
    // fall back to placeholder sampleData above
  }

  try {
    const subject = render(campaign.subject, sampleData);
    const html = render(campaign.html, sampleData);
    await sendMail({ module: campaign.module, to, subject, html });
    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Send now: resolve audience, fan out one ScheduledEmail per recipient ── */
router.post('/:id/send', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Only draft campaigns can be sent — create a new campaign to resend' });
  }

  try {
    // Always fan out against the campaign's own stored targeting — GROUP and
    // CUSTOM modes have no meaningful "override filters" concept, and a
    // FILTER campaign's filters are already persisted on the row (edited via
    // PUT /:id before sending), so there's no need for a request-body override.
    const recipients = await resolveCampaignAudience(campaign);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients match the current targeting' });
    }

    const rows = recipients.map((r) => ({
      module: campaign.module,
      to: r.email,
      subject: render(campaign.subject, { name: r.name, email: r.email }),
      html: render(campaign.html, { name: r.name, email: r.email }),
      sendAt: new Date(),
      campaignId: campaign.id,
      recipientId: r.id,
      recipientName: r.name,
      createdBy: req.user.id,
    }));

    await prisma.scheduledEmail.createMany({ data: rows });
    const updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING', totalRecipients: recipients.length },
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Schedule for later: same fan-out with a future sendAt ── */
router.post('/:id/schedule', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { sendAt } = req.body || {};
  if (!sendAt) return res.status(400).json({ error: 'sendAt is required' });
  const sendAtDate = new Date(sendAt);
  if (Number.isNaN(sendAtDate.getTime()) || sendAtDate <= new Date()) {
    return res.status(400).json({ error: 'sendAt must be a valid future date/time' });
  }

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'DRAFT') {
    return res.status(400).json({ error: 'Only draft campaigns can be scheduled' });
  }

  try {
    // See the note in /:id/send — always uses the campaign's own stored targeting.
    const recipients = await resolveCampaignAudience(campaign);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients match the current targeting' });
    }

    const rows = recipients.map((r) => ({
      module: campaign.module,
      to: r.email,
      subject: render(campaign.subject, { name: r.name, email: r.email }),
      html: render(campaign.html, { name: r.name, email: r.email }),
      sendAt: sendAtDate,
      campaignId: campaign.id,
      recipientId: r.id,
      recipientName: r.name,
      createdBy: req.user.id,
    }));

    await prisma.scheduledEmail.createMany({ data: rows });
    const updated = await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SCHEDULED', scheduledAt: sendAtDate, totalRecipients: recipients.length },
    });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Cancel a scheduled/sending campaign — skips any not-yet-sent rows ── */
router.post('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'SCHEDULED' && campaign.status !== 'SENDING') {
    return res.status(400).json({ error: 'Only scheduled or in-progress campaigns can be cancelled' });
  }

  await prisma.scheduledEmail.updateMany({
    where: { campaignId: campaign.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  const updated = await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'CANCELLED' } });
  res.json(updated);
});

module.exports = router;
