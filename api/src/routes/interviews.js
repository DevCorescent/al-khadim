const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { status, candidateId, jobId, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (candidateId) where.candidateId = candidateId;
  if (jobId) where.jobId = jobId;

  const [interviews, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { scheduledAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { include: { client: { select: { companyName: true } } } },
      },
    }),
    prisma.interview.count({ where }),
  ]);
  res.json({ data: interviews, total, page: Number(page), limit: Number(limit) });
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    data.scheduledAt = new Date(data.scheduledAt);
    if (data.interviewers && typeof data.interviewers === 'string') {
      data.interviewers = data.interviewers.split(',').map(s => s.trim());
    }
    const interview = await prisma.interview.create({
      data,
      include: {
        candidate: true,
        job: { include: { client: true } },
      },
    });
    res.status(201).json(interview);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
    const interview = await prisma.interview.update({
      where: { id: req.params.id },
      data,
      include: { candidate: true, job: true },
    });
    res.json(interview);
  } catch {
    res.status(404).json({ error: 'Interview not found' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.interview.delete({ where: { id: req.params.id } });
    res.json({ message: 'Interview deleted' });
  } catch {
    res.status(404).json({ error: 'Interview not found' });
  }
});

module.exports = router;
