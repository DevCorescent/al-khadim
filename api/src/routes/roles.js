const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

/* ── List all custom roles ── */
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const roles = await prisma.customRole.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(roles);
});

/* ── Create custom role ── */
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  const { name, description, color, permissions } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required' });
  try {
    const role = await prisma.customRole.create({
      data: { name, description, color: color || '#6366f1', permissions: permissions || {} },
    });
    res.status(201).json(role);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Role name already exists' });
    res.status(400).json({ error: err.message });
  }
});

/* ── Update custom role ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  const { name, description, color, permissions } = req.body;
  try {
    const role = await prisma.customRole.update({
      where: { id: req.params.id },
      data: { name, description, color, permissions },
    });
    res.json(role);
  } catch {
    res.status(404).json({ error: 'Role not found' });
  }
});

/* ── Delete custom role ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    await prisma.customRole.delete({ where: { id: req.params.id } });
    res.json({ message: 'Role deleted' });
  } catch {
    res.status(404).json({ error: 'Role not found' });
  }
});

module.exports = router;
