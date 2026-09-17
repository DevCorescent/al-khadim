const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { buildTrackingCsv, parseCsv, applyTrackingCsv } = require('../utils/trackingCsv');
const uploadCsv = require('../middleware/uploadCsv');

const prisma = new PrismaClient();

const INDUSTRY_BADGE = { select: { key: true, name: true, color: true } };

function toTemplate(industry) {
  return { label: industry.name, sections: industry.trackingSections || [] };
}

/* ── Templates (public — no PII here, just field definitions; consumed by staff,
 * candidate portal, company portal, and the public tokenized share view alike) ── */
router.get('/templates', async (req, res) => {
  const industries = await prisma.industry.findMany({ where: { hasTracking: true }, orderBy: { order: 'asc' } });
  const templates = {};
  for (const ind of industries) templates[ind.key] = toTemplate(ind);
  res.json(templates);
});

/* ── Blank sample CSV for an industry — same shape export/import use, so it
 * doubles as a fillable template. Registered before "/:id" so it's never
 * swallowed by that wildcard. ── */
router.get('/sample-csv', authenticate, async (req, res) => {
  const { industry: industryKey } = req.query;
  const industry = await prisma.industry.findUnique({ where: { key: industryKey } });
  if (!industry || !industry.hasTracking) return res.status(400).json({ error: 'Invalid industry' });

  const csv = buildTrackingCsv(toTemplate(industry), {});
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${industryKey}_tracking_template.csv"`);
  res.send(csv);
});

/* ── List tracking records for a candidate ── */
router.get('/', authenticate, async (req, res) => {
  const { candidateId, industry, visibility, page = 1, limit = 20 } = req.query;

  if (candidateId) {
    const records = await prisma.candidateTracking.findMany({
      where: { candidateId },
      include: { updatedByUser: { select: { id: true, name: true } }, industry: INDUSTRY_BADGE },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(records);
  }

  // No candidateId: global admin listing across all candidates.
  const where = {};
  if (industry) where.industry = { key: industry };
  if (visibility) where.visibility = visibility;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.candidateTracking.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
        updatedByUser: { select: { id: true, name: true } },
        industry: INDUSTRY_BADGE,
      },
    }),
    prisma.candidateTracking.count({ where }),
  ]);
  res.json({ data, total, page: Number(page) });
});

/* ── Get one record ── */
router.get('/:id', authenticate, async (req, res) => {
  const record = await prisma.candidateTracking.findUnique({
    where: { id: req.params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
      updatedByUser: { select: { id: true, name: true } },
      industry: INDUSTRY_BADGE,
    },
  });
  if (!record) return res.status(404).json({ error: 'Tracking record not found' });
  res.json(record);
});

/* ── Start tracking a candidate for an industry ── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { candidateId, industry: industryKey } = req.body;
    if (!candidateId || !industryKey) return res.status(400).json({ error: 'candidateId and industry are required' });

    const industry = await prisma.industry.findUnique({ where: { key: industryKey } });
    if (!industry || !industry.hasTracking) return res.status(400).json({ error: 'Invalid industry' });

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const record = await prisma.candidateTracking.upsert({
      where: { candidateId_industryId: { candidateId, industryId: industry.id } },
      update: {},
      create: { candidateId, industryId: industry.id, data: {}, updatedByUserId: req.user.id },
      include: { industry: INDUSTRY_BADGE },
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Update data / visibility ── */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { data, visibility, visibleToCandidate, visibleToCompany } = req.body;
    const existing = await prisma.candidateTracking.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Tracking record not found' });

    const updateData = { updatedByUserId: req.user.id };
    if (data !== undefined) updateData.data = data;
    if (visibility !== undefined) {
      if (!['PRIVATE', 'PUBLIC'].includes(visibility)) return res.status(400).json({ error: 'Invalid visibility' });
      updateData.visibility = visibility;
    }
    if (visibleToCandidate !== undefined) updateData.visibleToCandidate = !!visibleToCandidate;
    if (visibleToCompany !== undefined) updateData.visibleToCompany = !!visibleToCompany;

    const updated = await prisma.candidateTracking.update({
      where: { id: req.params.id },
      data: updateData,
      include: { industry: INDUSTRY_BADGE },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Export current data as CSV ── */
router.get('/:id/export-csv', authenticate, async (req, res) => {
  const record = await prisma.candidateTracking.findUnique({
    where: { id: req.params.id },
    include: { candidate: { select: { firstName: true, lastName: true } }, industry: true },
  });
  if (!record) return res.status(404).json({ error: 'Tracking record not found' });

  const csv = buildTrackingCsv(toTemplate(record.industry), record.data || {});
  const name = `${record.candidate.firstName}_${record.candidate.lastName}_${record.industry.key}_tracking`.replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(csv);
});

/* ── Import a filled CSV, replacing this record's data wholesale ── */
router.post('/:id/import-csv', authenticate, uploadCsv.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });
    const record = await prisma.candidateTracking.findUnique({ where: { id: req.params.id }, include: { industry: true } });
    if (!record) return res.status(404).json({ error: 'Tracking record not found' });

    const rows = parseCsv(req.file.buffer.toString('utf-8'));
    const data = applyTrackingCsv(toTemplate(record.industry), rows);

    const updated = await prisma.candidateTracking.update({
      where: { id: record.id },
      data: { data, updatedByUserId: req.user.id },
      include: { industry: INDUSTRY_BADGE },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to import CSV' });
  }
});

/* ── Remove a tracking record ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await prisma.candidateTracking.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tracking record removed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
