const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { isCompleted, assignedTo, clientId, candidateId } = req.query;
  const where = {};
  if (isCompleted !== undefined) where.isCompleted = isCompleted === 'true';
  if (assignedTo) where.assignedTo = assignedTo;
  if (clientId) where.clientId = clientId;
  if (candidateId) where.candidateId = candidateId;

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    include: {
      client: { select: { id: true, companyName: true } },
      candidate: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { id: true, name: true } },
    },
  });
  res.json(followUps);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    data.dueDate = new Date(data.dueDate);
    if (!data.assignedTo) data.assignedTo = req.user.id;
    const followUp = await prisma.followUp.create({ data });
    res.status(201).json(followUp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.isCompleted === true || data.isCompleted === 'true') {
      data.isCompleted = true;
      data.completedAt = new Date();
    }
    const followUp = await prisma.followUp.update({ where: { id: req.params.id }, data });
    res.json(followUp);
  } catch {
    res.status(404).json({ error: 'Follow-up not found' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.followUp.delete({ where: { id: req.params.id } });
    res.json({ message: 'Follow-up deleted' });
  } catch {
    res.status(404).json({ error: 'Follow-up not found' });
  }
});

module.exports = router;
