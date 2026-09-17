const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/** Default probability (%) per stage — used whenever a deal moves into a
 * stage without the caller explicitly setting its own probability. */
const STAGE_PROBABILITY = {
  LEAD: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

const CLIENT_SELECT = { id: true, companyName: true };
const JOB_SELECT = { id: true, title: true };
const OWNER_SELECT = { id: true, name: true };

/* ── List deals (filters + pagination) ── */
router.get('/', authenticate, async (req, res) => {
  const { clientId, stage, ownerId, search, tags, page = 1, limit = 50 } = req.query;
  const where = {};
  if (clientId) where.clientId = clientId;
  if (stage) where.stage = stage;
  if (ownerId) where.ownerId = ownerId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (tags) {
    const list = Array.isArray(tags) ? tags : String(tags).split(',').filter(Boolean);
    if (list.length) where.client = { ...(where.client || {}), tags: { hasSome: list } };
  }
  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
      include: { client: { select: CLIENT_SELECT }, job: { select: JOB_SELECT }, owner: { select: OWNER_SELECT } },
    }),
    prisma.deal.count({ where }),
  ]);

  res.json({ data, total, page: Number(page), limit: Number(limit) });
});

/* ── Pipeline analytics ── */
router.get('/stats', authenticate, async (req, res) => {
  const deals = await prisma.deal.findMany({ select: { stage: true, value: true, probability: true, createdAt: true, actualCloseDate: true, source: true } });

  const open = deals.filter((d) => d.stage !== 'WON' && d.stage !== 'LOST');
  const won = deals.filter((d) => d.stage === 'WON');
  const lost = deals.filter((d) => d.stage === 'LOST');

  const byStage = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, count: inStage.length, value: inStage.reduce((s, d) => s + d.value, 0) };
  });

  const totalOpenValue = open.reduce((s, d) => s + d.value, 0);
  const weightedForecast = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const winRate = won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0;
  const avgDealSize = deals.length ? deals.reduce((s, d) => s + d.value, 0) / deals.length : 0;

  const cycleDays = won
    .filter((d) => d.actualCloseDate)
    .map((d) => (new Date(d.actualCloseDate).getTime() - new Date(d.createdAt).getTime()) / 86400000);
  const avgSalesCycleDays = cycleDays.length ? cycleDays.reduce((s, n) => s + n, 0) / cycleDays.length : 0;

  // Won revenue by month (current year)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const monthlyWonRevenue = months.map((m, idx) => ({
    month: m,
    value: won
      .filter((d) => d.actualCloseDate && new Date(d.actualCloseDate).getFullYear() === currentYear && new Date(d.actualCloseDate).getMonth() === idx)
      .reduce((s, d) => s + d.value, 0),
  }));

  res.json({
    totalOpenValue,
    weightedForecast,
    winRate: Number(winRate.toFixed(1)),
    avgDealSize,
    avgSalesCycleDays: Number(avgSalesCycleDays.toFixed(1)),
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    byStage,
    monthlyWonRevenue,
  });
});

/* ── Deal detail + activities ── */
router.get('/:id', authenticate, async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, companyName: true, contactPerson: true, email: true, phone: true } },
      job: { select: JOB_SELECT },
      owner: { select: OWNER_SELECT },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { createdByUser: { select: OWNER_SELECT } },
      },
    },
  });
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.json(deal);
});

/* ── Create deal ── */
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, clientId, jobId, value, currency, stage, expectedCloseDate, source, ownerId } = req.body || {};
    if (!title || !clientId) return res.status(400).json({ error: 'title and clientId are required' });

    const resolvedStage = stage || 'LEAD';
    const deal = await prisma.deal.create({
      data: {
        title,
        clientId,
        jobId: jobId || null,
        value: value != null ? Number(value) : 0,
        currency: currency || 'AED',
        stage: resolvedStage,
        probability: STAGE_PROBABILITY[resolvedStage] ?? 10,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        source: source || null,
        ownerId: ownerId || req.user.id,
        createdBy: req.user.id,
      },
    });

    await prisma.activity.create({
      data: { clientId, dealId: deal.id, type: 'SYSTEM', content: `Deal "${title}" created`, createdBy: req.user.id },
    });

    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** Shared stage-transition logic used by both PUT /:id and PATCH /:id/stage. */
async function applyStageChange(existing, nextStage, lossReason, userId) {
  if (nextStage === 'LOST' && !lossReason && !existing.lossReason) {
    const err = new Error('lossReason is required when marking a deal as Lost');
    err.status = 400;
    throw err;
  }
  const data = { stage: nextStage, probability: STAGE_PROBABILITY[nextStage] ?? existing.probability };
  if (nextStage === 'LOST') {
    data.lossReason = lossReason || existing.lossReason;
    data.actualCloseDate = new Date();
  } else if (nextStage === 'WON') {
    data.actualCloseDate = new Date();
    data.lossReason = null;
  } else {
    data.actualCloseDate = null;
    data.lossReason = null;
  }
  const updated = await prisma.deal.update({ where: { id: existing.id }, data });
  await prisma.activity.create({
    data: {
      clientId: existing.clientId,
      dealId: existing.id,
      type: 'STAGE_CHANGE',
      content: `Stage changed from ${existing.stage} to ${nextStage}`,
      metadata: { from: existing.stage, to: nextStage, ...(nextStage === 'LOST' ? { lossReason: data.lossReason } : {}) },
      createdBy: userId,
    },
  });
  return updated;
}

/* ── Update deal (full edit; stage changes auto-log + auto-adjust probability) ── */
router.put('/:id', authenticate, async (req, res) => {
  const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { title, clientId, jobId, value, currency, stage, probability, expectedCloseDate, source, ownerId, lossReason } = req.body || {};

  try {
    let deal = existing;
    if (stage !== undefined && stage !== existing.stage) {
      deal = await applyStageChange(existing, stage, lossReason, req.user.id);
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (clientId !== undefined) data.clientId = clientId;
    if (jobId !== undefined) data.jobId = jobId || null;
    if (value !== undefined) data.value = Number(value);
    if (currency !== undefined) data.currency = currency;
    if (probability !== undefined) data.probability = Number(probability);
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    if (source !== undefined) data.source = source;
    if (ownerId !== undefined) data.ownerId = ownerId || null;
    if (stage === undefined && lossReason !== undefined) data.lossReason = lossReason;

    if (Object.keys(data).length > 0) {
      deal = await prisma.deal.update({ where: { id: req.params.id }, data });
    }

    res.json(deal);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Dedicated lightweight stage move (kanban drag-and-drop) ── */
router.patch('/:id/stage', authenticate, async (req, res) => {
  const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { stage, lossReason } = req.body || {};
  if (!stage) return res.status(400).json({ error: 'stage is required' });
  if (stage === existing.stage) return res.json(existing);

  try {
    const updated = await applyStageChange(existing, stage, lossReason, req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ── Delete deal ── */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deal deleted' });
  } catch {
    res.status(404).json({ error: 'Deal not found' });
  }
});

module.exports = router;
