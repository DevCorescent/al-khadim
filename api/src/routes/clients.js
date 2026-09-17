const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');
const { sendTemplatedMail } = require('../utils/templateRenderer');

const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  const { search, isActive, industry, industryId, status, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (industry) where.industry = industry;
  if (industryId) where.industryId = industryId;
  if (status) where.status = status;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true, followUps: true, invoices: true, enquiries: true } },
        invoices: { select: { totalAmount: true, status: true } },
        jobs: { select: { status: true } },
        industryRef: { select: { id: true, key: true, name: true, color: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const enriched = clients.map(c => ({
    ...c,
    totalRevenue: c.invoices.reduce((s, i) => s + i.totalAmount, 0),
    paidRevenue:  c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
    openJobs:     c.jobs.filter(j => j.status === 'OPEN').length,
    filledJobs:   c.jobs.filter(j => j.status === 'FILLED').length,
  }));

  res.json({ data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
});

/* Full client detail with all analytics */
router.get('/:id/detail', authenticate, async (req, res) => {
  try {
    const id = req.params.id;

    const [client, jobs, followUps, invoices, enquiries, clientUsers, profileShares] = await Promise.all([
      prisma.client.findUnique({ where: { id }, include: { industryRef: { select: { id: true, key: true, name: true, color: true } } } }),
      prisma.job.findMany({
        where: { clientId: id },
        include: {
          applications: {
            include: { candidate: { select: { firstName: true, lastName: true, nationality: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.followUp.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clientEnquiry.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clientUser.findMany({
        where: { clientId: id },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          lastLogin: true, acceptedAt: true, inviteExpiresAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.profileShare.findMany({
        where: { clientId: id },
        orderBy: { sentAt: 'desc' },
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
          job: { select: { id: true, title: true } },
          sentByUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Revenue analytics
    const totalRevenue   = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paidRevenue    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
    const pendingRevenue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.totalAmount, 0);
    const overdueRevenue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);

    // Revenue by month (last 12 months)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const currentYear = new Date().getFullYear();
    const revenueByMonth = months.map((m, idx) => {
      const mi = invoices.filter(i => {
        const d = new Date(i.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      });
      return {
        month: m,
        total: mi.reduce((s, i) => s + i.totalAmount, 0),
        paid:  mi.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
      };
    });

    // Job analytics
    const totalJobs  = jobs.length;
    const openJobs   = jobs.filter(j => j.status === 'OPEN').length;
    const filledJobs = jobs.filter(j => j.status === 'FILLED').length;
    const closedJobs = jobs.filter(j => j.status === 'CLOSED').length;
    const fillRate   = totalJobs ? ((filledJobs / totalJobs) * 100).toFixed(1) : '0.0';

    // Candidate placements (JOINED applications across client's jobs)
    const placements = jobs.flatMap(j =>
      j.applications.filter(cj => cj.status === 'JOINED').map(cj => ({
        candidateName: `${cj.candidate.firstName} ${cj.candidate.lastName}`,
        nationality: cj.candidate.nationality,
        jobTitle: j.title,
        date: cj.appliedAt,
      }))
    );

    // Follow-up activity
    const totalFollowUps     = followUps.length;
    const completedFollowUps = followUps.filter(f => f.isCompleted).length;
    const pendingFollowUps   = followUps.filter(f => !f.isCompleted).length;

    const followUpByType = followUps.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1; return acc;
    }, {});

    // Activity timeline (last 20 events across all entities)
    const timeline = [
      ...invoices.slice(0, 5).map(i => ({
        type: 'invoice', date: i.createdAt, title: `Invoice ${i.invoiceNo}`,
        subtitle: `AED ${i.totalAmount.toLocaleString()} — ${i.status}`, color: '#6366f1',
      })),
      ...jobs.slice(0, 5).map(j => ({
        type: 'job', date: j.createdAt, title: `Job: ${j.title}`,
        subtitle: j.status, color: '#10b981',
      })),
      ...followUps.slice(0, 5).map(f => ({
        type: 'followup', date: f.createdAt, title: f.subject,
        subtitle: `${f.type} — ${f.isCompleted ? 'Done' : 'Pending'}`, color: '#f59e0b',
      })),
      ...enquiries.slice(0, 3).map(e => ({
        type: 'enquiry', date: e.createdAt, title: `Enquiry: ${e.service || 'General'}`,
        subtitle: e.status, color: '#a855f7',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

    res.json({
      client,
      analytics: {
        revenue: { totalRevenue, paidRevenue, pendingRevenue, overdueRevenue, collectionRate: totalRevenue ? ((paidRevenue / totalRevenue) * 100).toFixed(1) : '0.0' },
        jobs: { totalJobs, openJobs, filledJobs, closedJobs, fillRate },
        placements: placements.length,
        followUps: { totalFollowUps, completedFollowUps, pendingFollowUps, byType: Object.entries(followUpByType).map(([name, value]) => ({ name, value })) },
        enquiries: enquiries.length,
      },
      revenueByMonth,
      jobs: jobs.map(j => ({ ...j, applications: j.applications.slice(0, 5) })),
      invoices,
      followUps,
      enquiries,
      placements,
      timeline,
      clientUsers,
      profileShares,
    });
  } catch (err) {
    console.error('client detail error', err);
    res.status(500).json({ error: err.message });
  }
});

/* Distinct tags across all clients, for a tag-picker autocomplete.
 * Must come before GET /:id so Express doesn't treat "tags" as an :id param. */
router.get('/tags/all', authenticate, async (req, res) => {
  const clients = await prisma.client.findMany({ where: { tags: { isEmpty: false } }, select: { tags: true } });
  const all = new Set();
  clients.forEach(c => c.tags.forEach(t => all.add(t)));
  res.json([...all].sort());
});

router.get('/:id', authenticate, async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      followUps: { orderBy: { dueDate: 'asc' }, take: 10 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
      industryRef: { select: { id: true, key: true, name: true, color: true } },
    },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.industryId === '') data.industryId = null;
    const client = await prisma.client.create({ data });
    res.status(201).json(client);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.industryId === '') data.industryId = null;
    const client = await prisma.client.update({ where: { id: req.params.id }, data });
    res.json(client);
  } catch { res.status(404).json({ error: 'Client not found' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ message: 'Client deleted' });
  } catch { res.status(404).json({ error: 'Client not found' }); }
});

/* ── Approve a pending self-signup company (super admin / admin only) ── */
router.patch('/:id/approve', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: req.user.id, rejectedAt: null, rejectionReason: null },
    });
    sendTemplatedMail({
      templateSlug: 'client-profile-approved',
      to: client.email,
      data: { contactPerson: client.contactPerson, companyName: client.companyName },
    }).catch((e) => console.error('client approve email failed', e));
    res.json(client);
  } catch (err) {
    res.status(404).json({ error: 'Client not found' });
  }
});

/* ── Reject a pending self-signup company (super admin / admin only) ── */
router.patch('/:id/reject', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || null },
    });
    sendTemplatedMail({
      templateSlug: 'client-profile-rejected',
      to: client.email,
      data: {
        contactPerson: client.contactPerson,
        companyName: client.companyName,
        reasonBlock: reason ? ` Reason: ${reason}` : '',
      },
    }).catch((e) => console.error('client reject email failed', e));
    res.json(client);
  } catch (err) {
    res.status(404).json({ error: 'Client not found' });
  }
});

module.exports = router;
