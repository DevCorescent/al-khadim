const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { authenticateApprovedClient } = require('../middleware/clientAuth');
const { sendTemplatedMail } = require('../utils/templateRenderer');

const prisma = new PrismaClient();

const CATEGORY_INDUSTRY_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  industry: { select: { id: true, key: true, name: true, color: true } },
};

function sanitizeFkFields(data) {
  if (data.categoryId === '') data.categoryId = null;
  if (data.industryId === '') data.industryId = null;
  return data;
}

router.get('/', authenticate, async (req, res) => {
  const { search, status, clientId, categoryId, industryId, page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (search) where.title = { contains: search, mode: 'insensitive' };
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (categoryId) where.categoryId = categoryId;
  if (industryId) where.industryId = industryId;

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where, skip: Number(skip), take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { applications: true, interviews: true } },
        ...CATEGORY_INDUSTRY_INCLUDE,
      },
    }),
    prisma.job.count({ where }),
  ]);
  res.json({ data: jobs, total, page: Number(page), limit: Number(limit) });
});

router.get('/public', async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN', isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { companyName: true, country: true } } },
    take: 50,
  });
  res.json(jobs);
});

/* ── Company portal: this company's own submitted job requests ── */
router.get('/mine', authenticateApprovedClient, async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { clientId: req.client.id },
    orderBy: { createdAt: 'desc' },
    include: CATEGORY_INDUSTRY_INCLUDE,
  });
  res.json(jobs);
});

/* ── Company portal: submit a new job request (internal-only until staff publishes it) ── */
router.post('/mine', authenticateApprovedClient, async (req, res) => {
  try {
    const {
      title, description, location, country, jobType, experience,
      positionsCount, salaryMin, salaryMax, currency, deadline, categoryId, industryId,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Job title is required' });

    const job = await prisma.job.create({
      data: {
        title, description: description || null, location: location || null,
        country: country || 'UAE', jobType: jobType || null, experience: experience || null,
        positionsCount: positionsCount ? parseInt(positionsCount) : 1,
        salaryMin: salaryMin ? parseFloat(salaryMin) : null,
        salaryMax: salaryMax ? parseFloat(salaryMax) : null,
        currency: currency || 'AED',
        deadline: deadline ? new Date(deadline) : null,
        categoryId: categoryId || null,
        industryId: industryId || null,
        clientId: req.client.id,
        source: 'COMPANY_REQUEST',
        requestedByClientUserId: req.clientUser.id,
        isPublished: false,
        status: 'OPEN',
      },
      include: CATEGORY_INDUSTRY_INCLUDE,
    });

    prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { email: true } })
      .then((admins) => Promise.all(admins.map((a) => sendTemplatedMail({
        templateSlug: 'admin-new-job-request',
        to: a.email,
        data: { companyName: req.client.companyName, jobTitle: title },
      }).catch((e) => console.error('job request admin notify failed', e)))))
      .catch((e) => console.error('admin lookup failed', e));

    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      applications: { include: { candidate: true } },
      interviews: { include: { candidate: true } },
      requestedByClientUser: { select: { name: true, email: true } },
      ...CATEGORY_INDUSTRY_INCLUDE,
    },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = sanitizeFkFields({ ...req.body });
    if (data.salaryMin) data.salaryMin = parseFloat(data.salaryMin);
    if (data.salaryMax) data.salaryMax = parseFloat(data.salaryMax);
    if (data.positionsCount) data.positionsCount = parseInt(data.positionsCount);
    if (data.deadline) data.deadline = new Date(data.deadline);
    const job = await prisma.job.create({ data, include: { client: true, ...CATEGORY_INDUSTRY_INCLUDE } });
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = sanitizeFkFields({ ...req.body });
    if (data.salaryMin) data.salaryMin = parseFloat(data.salaryMin);
    if (data.salaryMax) data.salaryMax = parseFloat(data.salaryMax);
    const job = await prisma.job.update({
      where: { id: req.params.id }, data,
      include: { client: true, ...CATEGORY_INDUSTRY_INCLUDE },
    });
    res.json(job);
  } catch {
    res.status(404).json({ error: 'Job not found' });
  }
});

router.patch('/:id/publish', authenticate, async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { isPublished: true, publishedAt: new Date(), publishedByUserId: req.user.id },
    });
    res.json(job);
  } catch {
    res.status(404).json({ error: 'Job not found' });
  }
});

router.patch('/:id/unpublish', authenticate, async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { isPublished: false },
    });
    res.json(job);
  } catch {
    res.status(404).json({ error: 'Job not found' });
  }
});

router.put('/applications/:appId', authenticate, async (req, res) => {
  try {
    const app = await prisma.candidateJob.update({
      where: { id: req.params.appId },
      data: { status: req.body.status },
    });
    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.job.delete({ where: { id: req.params.id } });
    res.json({ message: 'Job deleted' });
  } catch {
    res.status(404).json({ error: 'Job not found' });
  }
});

module.exports = router;
