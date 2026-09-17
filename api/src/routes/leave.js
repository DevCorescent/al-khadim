const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { employeeId, status } = req.query;
  const where = {};
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;
  const leaves = await prisma.leave.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
  });
  res.json(leaves);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    data.startDate = new Date(data.startDate);
    data.endDate = new Date(data.endDate);
    data.days = parseInt(data.days);
    const leave = await prisma.leave.create({ data, include: { employee: true } });
    res.status(201).json(leave);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.status === 'APPROVED') {
      data.approvedBy = req.user.name;
      data.approvedAt = new Date();
    }
    const leave = await prisma.leave.update({ where: { id: req.params.id }, data });
    res.json(leave);
  } catch {
    res.status(404).json({ error: 'Leave not found' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.leave.delete({ where: { id: req.params.id } });
    res.json({ message: 'Leave deleted' });
  } catch {
    res.status(404).json({ error: 'Leave not found' });
  }
});

module.exports = router;
