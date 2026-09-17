const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

function slugify(name) {
  return String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function uniqueKey(name) {
  const base = slugify(name) || 'INDUSTRY';
  let key = base;
  let n = 2;
  while (await prisma.industry.findUnique({ where: { key } })) {
    key = `${base}_${n}`;
    n++;
  }
  return key;
}

/* ── List all industries (public — used in dropdowns everywhere, incl. public signup forms) ── */
router.get('/', async (req, res) => {
  const { hasTracking } = req.query;
  const where = {};
  if (hasTracking !== undefined) where.hasTracking = hasTracking === 'true';
  const industries = await prisma.industry.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, key: true, name: true, description: true, color: true, order: true, hasTracking: true },
  });
  res.json(industries);
});

/* ── Get a single industry (incl. its tracking template, for the builder page) ── */
router.get('/:id', authenticate, async (req, res) => {
  const industry = await prisma.industry.findUnique({ where: { id: req.params.id } });
  if (!industry) return res.status(404).json({ error: 'Industry not found' });
  res.json(industry);
});

/* ── Create industry ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, description, color, order, hasTracking, trackingSections } = req.body;
  if (!name) return res.status(400).json({ error: 'Industry name is required' });
  try {
    const key = await uniqueKey(name);
    const industry = await prisma.industry.create({
      data: {
        key, name, description, color: color || '#6366f1', order: order ? parseInt(order) : 0,
        hasTracking: !!hasTracking,
        trackingSections: hasTracking ? (trackingSections || []) : undefined,
      },
    });
    res.status(201).json(industry);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'An industry with this name already exists' });
    res.status(400).json({ error: err.message });
  }
});

/* ── Update industry (name/description/color/order/hasTracking/trackingSections — key is immutable) ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, description, color, order, hasTracking, trackingSections } = req.body;
  try {
    const data = { name, description, color, order: order !== undefined ? parseInt(order) : undefined };
    if (hasTracking !== undefined) data.hasTracking = !!hasTracking;
    if (trackingSections !== undefined) data.trackingSections = trackingSections;
    const industry = await prisma.industry.update({ where: { id: req.params.id }, data });
    res.json(industry);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'An industry with this name already exists' });
    res.status(404).json({ error: 'Industry not found' });
  }
});

/* ── Delete industry (blocked if still in use) ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { id } = req.params;
  const [candidateCount, clientCount, jobCount, trackingCount] = await Promise.all([
    prisma.candidate.count({ where: { industryId: id } }),
    prisma.client.count({ where: { industryId: id } }),
    prisma.job.count({ where: { industryId: id } }),
    prisma.candidateTracking.count({ where: { industryId: id } }),
  ]);
  if (candidateCount > 0 || clientCount > 0 || jobCount > 0 || trackingCount > 0) {
    return res.status(409).json({
      error: `Cannot delete — still used by ${candidateCount} candidate(s), ${clientCount} client(s), ${jobCount} job(s) and ${trackingCount} tracking record(s). Reassign them first.`,
    });
  }
  try {
    await prisma.industry.delete({ where: { id } });
    res.json({ message: 'Industry deleted' });
  } catch {
    res.status(404).json({ error: 'Industry not found' });
  }
});

module.exports = router;
