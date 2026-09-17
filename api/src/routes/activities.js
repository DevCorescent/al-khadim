const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

/* ── Activity feed for a client and/or a deal (paginated) ── */
router.get('/', authenticate, async (req, res) => {
  const { clientId, dealId, page = 1, limit = 50 } = req.query;
  if (!clientId && !dealId) return res.status(400).json({ error: 'clientId or dealId is required' });

  const where = {};
  if (clientId) where.clientId = clientId;
  if (dealId) where.dealId = dealId;
  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  res.json({ data, total, page: Number(page), limit: Number(limit) });
});

/* ── Log a note/call/meeting/email/task against a client (and optionally a deal) ── */
router.post('/', authenticate, async (req, res) => {
  const { clientId, dealId, type, content } = req.body || {};
  if (!clientId || !content) return res.status(400).json({ error: 'clientId and content are required' });

  try {
    const activity = await prisma.activity.create({
      data: {
        clientId,
        dealId: dealId || null,
        type: type || 'NOTE',
        content,
        createdBy: req.user.id,
      },
      include: { createdByUser: { select: { id: true, name: true } } },
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
