const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { employeeId, month, year } = req.query;
  const where = {};
  if (employeeId) where.employeeId = employeeId;
  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }
  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
  });
  res.json(records);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    data.date = new Date(data.date);
    if (data.checkIn) data.checkIn = new Date(data.checkIn);
    if (data.checkOut) data.checkOut = new Date(data.checkOut);
    if (data.hoursWorked) data.hoursWorked = parseFloat(data.hoursWorked);
    if (data.overtime) data.overtime = parseFloat(data.overtime);

    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
      update: data,
      create: data,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.checkIn) data.checkIn = new Date(data.checkIn);
    if (data.checkOut) data.checkOut = new Date(data.checkOut);
    const record = await prisma.attendance.update({ where: { id: req.params.id }, data });
    res.json(record);
  } catch {
    res.status(404).json({ error: 'Record not found' });
  }
});

// Bulk import
router.post('/bulk', authenticate, async (req, res) => {
  const { records } = req.body;
  try {
    const result = await prisma.$transaction(
      records.map(r => prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: new Date(r.date) } },
        update: { ...r, date: new Date(r.date) },
        create: { ...r, date: new Date(r.date) },
      }))
    );
    res.json({ imported: result.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
