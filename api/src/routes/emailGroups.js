const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { resolveAudienceForSend } = require('../utils/audienceQuery');

const prisma = new PrismaClient();

/* ── List groups + member counts ── */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const groups = await prisma.emailGroup.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g._count.members,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }))
  );
});

/* ── Group detail + paginated members (?page=&limit=&search=) ── */
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const group = await prisma.emailGroup.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { page = 1, limit = 20, search } = req.query;
  const where = { groupId: group.id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);

  const [total, members] = await Promise.all([
    prisma.emailGroupMember.count({ where }),
    prisma.emailGroupMember.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { addedAt: 'desc' },
    }),
  ]);

  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    members: {
      data: members.map((m) => ({
        id: m.id,
        recipientType: m.recipientType,
        recipientId: m.recipientId,
        name: m.name,
        email: m.email,
        addedAt: m.addedAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    },
  });
});

/* ── Create group ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const existing = await prisma.emailGroup.findUnique({ where: { name: name.trim() } });
  if (existing) return res.status(400).json({ error: `A group named "${name.trim()}" already exists` });

  try {
    const group = await prisma.emailGroup.create({
      data: {
        name: name.trim(),
        description: description || null,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(group);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: `A group named "${name.trim()}" already exists` });
    }
    res.status(400).json({ error: err.message });
  }
});

/* ── Update group (rename/description) ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const existing = await prisma.emailGroup.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  const { name, description } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name cannot be blank' });
  }
  if (name !== undefined && name.trim() !== existing.name) {
    const nameTaken = await prisma.emailGroup.findUnique({ where: { name: name.trim() } });
    if (nameTaken) return res.status(400).json({ error: `A group named "${name.trim()}" already exists` });
  }

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description || null;

  try {
    const group = await prisma.emailGroup.update({ where: { id: req.params.id }, data });
    res.json(group);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: `A group named "${name?.trim()}" already exists` });
    }
    res.status(400).json({ error: err.message });
  }
});

/* ── Delete group (members cascade) ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const existing = await prisma.emailGroup.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Group not found' });
  await prisma.emailGroup.delete({ where: { id: req.params.id } });
  res.json({ message: 'Group deleted' });
});

/* ── Add members — direct snapshot rows, or bulk-add everyone matching a filter ── */
router.post('/:id/members', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const existing = await prisma.emailGroup.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  const { members, recipientType, filters } = req.body || {};

  let rows = [];
  try {
    if (Array.isArray(members)) {
      rows = members
        .filter((m) => m && m.recipientType && m.recipientId && m.name && m.email)
        .map((m) => ({
          recipientType: m.recipientType,
          recipientId: m.recipientId,
          name: m.name,
          email: m.email,
        }));
    } else if (recipientType) {
      const audience = await resolveAudienceForSend(recipientType, filters || {});
      rows = audience.map((r) => ({
        recipientType,
        recipientId: r.id,
        name: r.name,
        email: r.email,
      }));
    } else {
      return res.status(400).json({ error: 'Provide either members[] or {recipientType, filters}' });
    }
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  if (rows.length === 0) {
    return res.json({ added: 0 });
  }

  const result = await prisma.emailGroupMember.createMany({
    data: rows.map((r) => ({
      groupId: req.params.id,
      recipientType: r.recipientType,
      recipientId: r.recipientId,
      name: r.name,
      email: r.email,
    })),
    skipDuplicates: true,
  });
  res.json({ added: result.count });
});

/* ── Remove one member (scoped to this group) ── */
router.delete('/:id/members/:memberId', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const member = await prisma.emailGroupMember.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.groupId !== req.params.id) {
    return res.status(404).json({ error: 'Member not found in this group' });
  }
  await prisma.emailGroupMember.delete({ where: { id: req.params.memberId } });
  res.json({ message: 'Member removed' });
});

module.exports = router;
