const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/stats', authenticate, async (req, res) => {
  const now       = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart= new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCandidates,
    totalClients,
    totalJobs,
    totalEmployees,
    openJobs,
    activeEmployees,
    pendingFollowUps,
    newCandidatesThisMonth,
    pendingLeaves,
    expiringDocs,
    recentCandidates,
    recentClients,
    candidatesByStatus,
    jobsByStatus,
    // Revenue
    invoicesThisYear,
    draftInvoices,
    overdueInvoices,
  ] = await Promise.all([
    prisma.candidate.count(),
    prisma.client.count(),
    prisma.job.count(),
    prisma.employee.count(),
    prisma.job.count({ where: { status: 'OPEN' } }),
    prisma.employee.count({ where: { status: 'ACTIVE' } }),
    prisma.followUp.count({ where: { isCompleted: false } }),
    prisma.candidate.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.leave.count({ where: { status: 'PENDING' } }),
    prisma.document.count({
      where: { expiryDate: { lte: new Date(Date.now() + 30*24*60*60*1000), gte: now } },
    }),
    prisma.candidate.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true },
    }),
    prisma.client.findMany({
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, companyName: true, contactPerson: true, createdAt: true },
    }),
    prisma.candidate.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.job.groupBy({ by: ['status'], _count: { status: true } }),
    // All invoices this year for revenue calc
    prisma.invoice.findMany({
      where: { docType: 'INVOICE', issueDate: { gte: yearStart } },
      select: { totalAmount: true, status: true, issueDate: true },
    }),
    prisma.invoice.count({ where: { docType: 'INVOICE', status: 'DRAFT' } }),
    prisma.invoice.count({ where: { docType: 'INVOICE', status: 'OVERDUE' } }),
  ]);

  // Revenue aggregates
  const totalRevenue   = invoicesThisYear.reduce((s, i) => s + i.totalAmount, 0);
  const paidRevenue    = invoicesThisYear.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
  const pendingRevenue = invoicesThisYear.filter(i => ['SENT','PENDING'].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);

  // Monthly revenue for chart (Jan–Dec)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlyRevenue = months.map((m, idx) => {
    const docs = invoicesThisYear.filter(i => new Date(i.issueDate).getMonth() === idx);
    return {
      month: m,
      invoiced: docs.reduce((s, i) => s + i.totalAmount, 0),
      paid:     docs.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
    };
  });

  res.json({
    kpis: {
      totalCandidates, totalClients, totalJobs, totalEmployees,
      openJobs, activeEmployees, pendingFollowUps, newCandidatesThisMonth,
      pendingLeaves, expiringDocs,
      totalRevenue, paidRevenue, pendingRevenue, overdueInvoices, draftInvoices,
    },
    recentActivity: { recentCandidates, recentClients },
    charts: { candidatesByStatus, jobsByStatus, monthlyRevenue },
  });
});

module.exports = router;
