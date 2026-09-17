const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const prisma = new PrismaClient();

/* ── List all categories (public — used in dropdowns everywhere, incl. company portal) ── */
router.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  res.json(categories);
});

/* ── Create category ── */
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, description, color, order } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    const category = await prisma.category.create({
      data: { name, description, color: color || '#6366f1', order: order ? parseInt(order) : 0 },
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(400).json({ error: err.message });
  }
});

/* ── Update category ── */
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, description, color, order } = req.body;
  try {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, description, color, order: order !== undefined ? parseInt(order) : undefined },
    });
    res.json(category);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A category with this name already exists' });
    res.status(404).json({ error: 'Category not found' });
  }
});

/* ── Delete category (blocked if still in use) ── */
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { id } = req.params;
  const [candidateCount, jobCount] = await Promise.all([
    prisma.candidate.count({ where: { categoryId: id } }),
    prisma.job.count({ where: { categoryId: id } }),
  ]);
  if (candidateCount > 0 || jobCount > 0) {
    return res.status(409).json({
      error: `Cannot delete — still used by ${candidateCount} candidate(s) and ${jobCount} job(s). Reassign them first.`,
    });
  }
  try {
    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted' });
  } catch {
    res.status(404).json({ error: 'Category not found' });
  }
});

module.exports = router;
