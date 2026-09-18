// Ported from api/src/routes/deals.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pagination, toDate, toNumber } from '../validate';

/** Default probability (%) per stage — used whenever a deal moves into a
 * stage without the caller explicitly setting its own probability. */
const STAGE_PROBABILITY: Record<string, number> = {
  LEAD: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

const STAGES = Object.keys(STAGE_PROBABILITY);

function checkStage(stage: any) {
  if (!STAGES.includes(stage)) throw new HttpError(400, `stage must be one of ${STAGES.join(', ')}`);
}

/** Probability is an Int percentage (0-100). */
function toProbability(value: any) {
  const n = toNumber(value, 'probability');
  if (n === undefined) return undefined;
  if (n < 0 || n > 100) throw new HttpError(400, 'probability must be between 0 and 100');
  return Math.round(n);
}

const CLIENT_SELECT = { id: true, companyName: true };
const JOB_SELECT = { id: true, title: true };
const OWNER_SELECT = { id: true, name: true };

/* ── List deals (filters + pagination) ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
  const q = query(req);
  const { clientId, stage, ownerId, search, tags } = q;
  const where: any = {};
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
  const { page, limit, skip } = pagination(q, { defaultLimit: 50 });

  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: { client: { select: CLIENT_SELECT }, job: { select: JOB_SELECT }, owner: { select: OWNER_SELECT } },
    }),
    prisma.deal.count({ where }),
  ]);

  return json({ data, total, page, limit });
});

/* ── Pipeline analytics ── */
export const stats = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
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

  return json({
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
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'view');
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
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
  if (!deal) return json({ error: 'Deal not found' }, 404);
  return json(deal);
});

/* ── Create deal ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'clients', 'create');
  try {
    const { title, clientId, jobId, value, currency, stage, expectedCloseDate, source, ownerId } = await body(req);
    if (!title || !clientId) return json({ error: 'title and clientId are required' }, 400);

    const resolvedStage = stage || 'LEAD';
    checkStage(resolvedStage);
    const amount = toNumber(value, 'value') ?? 0;
    const closeDate = toDate(expectedCloseDate, 'expectedCloseDate') ?? null;
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return json({ error: 'Client not found' }, 400);

    // The "created" activity is written in the same statement, so both land or neither does.
    const deal = await prisma.deal.create({
      data: {
        title,
        clientId,
        jobId: jobId || null,
        value: amount,
        currency: currency || 'AED',
        stage: resolvedStage,
        probability: STAGE_PROBABILITY[resolvedStage] ?? 10,
        expectedCloseDate: closeDate,
        ...(resolvedStage === 'WON' && { actualCloseDate: new Date() }),
        source: source || null,
        ownerId: ownerId || user.id,
        createdBy: user.id,
        activities: {
          create: { clientId, type: 'SYSTEM', content: `Deal "${title}" created`, createdBy: user.id },
        },
      },
    });

    return json(deal, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/** Shared stage-transition logic used by both PUT /:id and PATCH /:id/stage. */
async function applyStageChange(existing: any, nextStage: any, lossReason: any, userId: string) {
  checkStage(nextStage);
  if (nextStage === 'LOST' && !lossReason && !existing.lossReason) {
    throw new HttpError(400, 'lossReason is required when marking a deal as Lost');
  }
  const data: any = { stage: nextStage, probability: STAGE_PROBABILITY[nextStage] ?? existing.probability };
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
  const [updated] = await prisma.$transaction([prisma.deal.update({ where: { id: existing.id }, data }), prisma.activity.create({
    data: {
      clientId: existing.clientId,
      dealId: existing.id,
      type: 'STAGE_CHANGE',
      content: `Stage changed from ${existing.stage} to ${nextStage}`,
      metadata: { from: existing.stage, to: nextStage, ...(nextStage === 'LOST' ? { lossReason: data.lossReason } : {}) },
      createdBy: userId,
    },
  })]);
  return updated;
}

/* ── Update deal (full edit; stage changes auto-log + auto-adjust probability) ── */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'clients', 'edit');
  const existing = await prisma.deal.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Deal not found' }, 404);

  const { title, clientId, jobId, value, currency, stage, probability, expectedCloseDate, source, ownerId, lossReason } = await body(req);

  // Validate everything before any write so a bad field can't leave a half-applied stage change.
  const data: any = {};
  if (title !== undefined) {
    if (!title) return json({ error: 'title cannot be empty' }, 400);
    data.title = title;
  }
  if (clientId !== undefined) {
    if (!clientId) return json({ error: 'clientId cannot be empty' }, 400);
    data.clientId = clientId;
  }
  if (jobId !== undefined) data.jobId = jobId || null;
  if (value !== undefined) data.value = toNumber(value, 'value') ?? 0;
  if (currency !== undefined) data.currency = currency || 'AED';
  if (probability !== undefined) data.probability = toProbability(probability);
  if (expectedCloseDate !== undefined) data.expectedCloseDate = toDate(expectedCloseDate, 'expectedCloseDate');
  if (stage !== undefined) checkStage(stage);

  try {
    let deal = existing;
    if (stage !== undefined && stage !== existing.stage) {
      deal = await applyStageChange(existing, stage, lossReason, user.id);
    }

    if (source !== undefined) data.source = source || null;
    if (ownerId !== undefined) data.ownerId = ownerId || null;
    if (stage === undefined && lossReason !== undefined) data.lossReason = lossReason;

    if (data.probability === undefined) delete data.probability;
    if (Object.keys(data).length > 0) {
      deal = await prisma.deal.update({ where: { id: params.id }, data });
    }

    return json(deal);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Dedicated lightweight stage move (kanban drag-and-drop) ── */
export const moveStage = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'clients', 'edit');
  const existing = await prisma.deal.findUnique({ where: { id: params.id } });
  if (!existing) return json({ error: 'Deal not found' }, 404);

  const { stage, lossReason } = await body(req);
  if (!stage) return json({ error: 'stage is required' }, 400);
  if (stage === existing.stage) return json(existing);

  try {
    const updated = await applyStageChange(existing, stage, lossReason, user.id);
    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Delete deal ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'delete');
  try {
    await prisma.deal.delete({ where: { id: params.id } });
    return json({ message: 'Deal deleted' });
  } catch {
    return json({ error: 'Deal not found' }, 404);
  }
});
