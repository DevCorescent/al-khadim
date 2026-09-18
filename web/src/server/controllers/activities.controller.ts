// Ported from api/src/routes/activities.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { pagination } from '../validate';

/** Types a user can log; STAGE_CHANGE / SYSTEM entries are written by the server only. */
const USER_TYPES = ['NOTE', 'CALL', 'MEETING', 'EMAIL', 'TASK'];

/* ── Activity feed for a client and/or a deal (paginated) ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
  const q = query(req);
  const { clientId, dealId } = q;
  if (!clientId && !dealId) return json({ error: 'clientId or dealId is required' }, 400);

  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (dealId) where.dealId = dealId;
  const { page, limit, skip } = pagination(q, { defaultLimit: 50 });

  const [data, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return json({ data, total, page, limit });
});

/* ── Log a note/call/meeting/email/task against a client (and optionally a deal) ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'clients', 'create');
  const { clientId, dealId, type, content } = await body(req);
  if (!clientId || !content || !String(content).trim()) return json({ error: 'clientId and content are required' }, 400);
  if (type !== undefined && type !== '' && !USER_TYPES.includes(type)) {
    return json({ error: `type must be one of ${USER_TYPES.join(', ')}` }, 400);
  }
  if (dealId) {
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { clientId: true } });
    if (!deal) return json({ error: 'Deal not found' }, 400);
    if (deal.clientId !== clientId) return json({ error: 'Deal does not belong to this client' }, 400);
  }

  try {
    const activity = await prisma.activity.create({
      data: {
        clientId,
        dealId: dealId || null,
        type: type || 'NOTE',
        content: String(content),
        createdBy: user.id,
      },
      include: { createdByUser: { select: { id: true, name: true } } },
    });
    return json(activity, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
