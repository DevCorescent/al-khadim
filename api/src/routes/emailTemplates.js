const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

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
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { category, recipientType, search } = req.query;
  const where = {};
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
  res.json(templates);
});

/* ── Full template (incl. html/design/mergeTags) ── */
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

/* ── Create template ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { slug, name, category, recipientType, module, subject, html, design, mergeTags } = req.body;
  if (!slug || !name || !subject || !html) {
    return res.status(400).json({ error: 'slug, name, subject and html are required' });
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (existing) return res.status(400).json({ error: `A template with slug "${slug}" already exists` });

  try {
    const template = await prisma.emailTemplate.create({
      data: {
        slug,
        name,
        category,
        recipientType,
        module,
        subject,
        html,
        design,
        mergeTags,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Update template (partial, bumps version) ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { slug, name, category, recipientType, module, subject, html, design, mergeTags, isActive } = req.body;

  const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  if (slug && slug !== existing.slug) {
    const slugTaken = await prisma.emailTemplate.findUnique({ where: { slug } });
    if (slugTaken) return res.status(400).json({ error: `A template with slug "${slug}" already exists` });
  }

  const data = {};
  if (slug !== undefined) data.slug = slug;
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (recipientType !== undefined) data.recipientType = recipientType;
  if (module !== undefined) data.module = module;
  if (subject !== undefined) data.subject = subject;
  if (html !== undefined) data.html = html;
  if (design !== undefined) data.design = design;
  if (mergeTags !== undefined) data.mergeTags = mergeTags;
  if (isActive !== undefined) data.isActive = isActive;
  data.version = existing.version + 1;
  data.updatedBy = req.user.id;

  try {
    const template = await prisma.emailTemplate.update({ where: { id: req.params.id }, data });
    res.json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Duplicate template ── */
router.post('/:id/duplicate', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const original = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ error: 'Template not found' });

  const { name } = req.body || {};
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
        design: original.design,
        mergeTags: original.mergeTags,
        isActive: original.isActive,
        version: 1,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(copy);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Delete template ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  if (template.category === 'TRANSACTIONAL') {
    return res.status(400).json({
      error: 'System (transactional) templates cannot be deleted — deactivate it instead (set isActive: false).',
    });
  }

  const campaignCount = await prisma.emailCampaign.count({ where: { templateId: template.id } });
  if (campaignCount > 0) {
    return res.status(400).json({
      error: `This template is used by ${campaignCount} campaign(s) and cannot be deleted.`,
    });
  }

  await prisma.emailTemplate.delete({ where: { id: template.id } });
  res.json({ message: 'Template deleted' });
});

module.exports = router;
