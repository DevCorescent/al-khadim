const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { search, isActive } = req.query;
  const where = {};
  if (search) where.clientName = { contains: search, mode: 'insensitive' };
  if (isActive !== undefined) where.isActive = isActive === 'true';
  const records = await prisma.outsourcing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, designation: true } } },
  });
  res.json(records);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    data.salary = parseFloat(data.salary);
    if (data.insurance !== undefined) data.insurance = data.insurance === 'true' || data.insurance === true;
    const record = await prisma.outsourcing.create({ data, include: { employee: true } });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.salary) data.salary = parseFloat(data.salary);
    const record = await prisma.outsourcing.update({ where: { id: req.params.id }, data });
    res.json(record);
  } catch {
    res.status(404).json({ error: 'Record not found' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.outsourcing.delete({ where: { id: req.params.id } });
    res.json({ message: 'Record deleted' });
  } catch {
    res.status(404).json({ error: 'Record not found' });
  }
});

module.exports = router;
