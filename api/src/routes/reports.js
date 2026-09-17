const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { computeVsActual } = require('./budgets');

const prisma = new PrismaClient();
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function yearRange(year) {
  const y = year ? parseInt(year) : new Date().getFullYear();
  return { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) };
}

function monthRange(year, month) {
  const y = parseInt(year) || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;
  return { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
}

/* ── OVERVIEW ── */
router.get('/overview', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const y = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const [
      totalCandidates, newCandidates, placed,
      totalClients, activeClients,
      openJobs, filledJobs,
      totalEmployees, activeEmployees,
      invoices, pendingLeaves, registrations, profileRequests,
    ] = await Promise.all([
      prisma.candidate.count(),
      prisma.candidate.count({ where: { createdAt: range } }),
      prisma.candidateJob.count({ where: { status: 'JOINED' } }),
      prisma.client.count(),
      prisma.client.count({ where: { isActive: true } }),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.job.count({ where: { status: 'FILLED' } }),
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.invoice.findMany({ where: { createdAt: range }, select: { totalAmount: true, status: true, createdAt: true } }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.candidateRegistration.count({ where: { createdAt: range } }),
      prisma.profileRequest.count({ where: { status: 'NEW' } }),
    ]);

    const totalRevenue   = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paidRevenue    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
    const pendingRevenue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.totalAmount, 0);

    const revenueByMonth = MONTHS.map((m, idx) => {
      const mi = invoices.filter(i => new Date(i.createdAt).getMonth() === idx);
      return {
        month: m,
        total: mi.reduce((s, i) => s + i.totalAmount, 0),
        paid:  mi.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
      };
    });

    res.json({
      kpis: {
        totalCandidates, newCandidates, placed,
        totalClients, activeClients,
        openJobs, filledJobs,
        totalEmployees, activeEmployees,
        totalRevenue, paidRevenue, pendingRevenue,
        pendingLeaves, registrations, profileRequests,
      },
      revenueByMonth,
    });
  } catch (err) {
    console.error('overview error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── RECRUITMENT ── */
router.get('/recruitment', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const y = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const [candidates, applications, interviews, jobs, registrations] = await Promise.all([
      prisma.candidate.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, nationality: true, experience: true, skills: true, createdAt: true, source: true },
      }),
      prisma.candidateJob.findMany({
        where: { appliedAt: range },
        select: { status: true, appliedAt: true },
      }),
      prisma.interview.findMany({
        where: { scheduledAt: range },
        select: { id: true, status: true, scheduledAt: true },
      }),
      prisma.job.findMany({
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.candidateRegistration.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    // by status
    const byStatus = groupCount(candidates, c => c.status);

    // by nationality (top 8)
    const natMap = {};
    candidates.forEach(c => { if (c.nationality) natMap[c.nationality] = (natMap[c.nationality] || 0) + 1; });
    const byNationality = Object.entries(natMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    // by experience bucket
    const expBuckets = { '0-2 yrs': 0, '3-5 yrs': 0, '6-9 yrs': 0, '10+ yrs': 0 };
    candidates.forEach(c => {
      const e = c.experience || 0;
      if (e <= 2) expBuckets['0-2 yrs']++;
      else if (e <= 5) expBuckets['3-5 yrs']++;
      else if (e <= 9) expBuckets['6-9 yrs']++;
      else expBuckets['10+ yrs']++;
    });
    const byExperience = Object.entries(expBuckets).map(([name, value]) => ({ name, value }));

    // by source
    const bySource = groupCount(candidates, c => c.source || 'Unknown');

    // monthly pipeline
    const monthlyPipeline = MONTHS.map((m, idx) => ({
      month: m,
      candidates:   candidates.filter(c => new Date(c.createdAt).getMonth() === idx).length,
      applications: applications.filter(a => new Date(a.appliedAt).getMonth() === idx).length,
      interviews:   interviews.filter(i => new Date(i.scheduledAt).getMonth() === idx).length,
    }));

    // top skills
    const skillMap = {};
    candidates.forEach(c => (c.skills || []).forEach(s => { skillMap[s] = (skillMap[s] || 0) + 1; }));
    const topSkills = Object.entries(skillMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

    const appByStatus  = groupCount(applications, a => a.status);
    const intByStatus  = groupCount(interviews,   i => i.status);
    const jobsByStatus = groupCount(jobs,          j => j.status);

    res.json({
      summary: {
        totalCandidates:  candidates.length,
        totalApplications: applications.length,
        placed:           applications.filter(a => a.status === 'JOINED').length,
        totalInterviews:  interviews.length,
        openJobs:         jobs.filter(j => j.status === 'OPEN').length,
        filledJobs:       jobs.filter(j => j.status === 'FILLED').length,
        conversionRate:   applications.length
          ? ((applications.filter(a => a.status === 'JOINED').length / applications.length) * 100).toFixed(1)
          : '0.0',
        registrations: registrations.length,
      },
      byStatus, byNationality, byExperience, bySource,
      monthlyPipeline, topSkills, jobsByStatus, appByStatus, intByStatus,
    });
  } catch (err) {
    console.error('recruitment error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── REVENUE ── */
router.get('/revenue', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);

    const invoices = await prisma.invoice.findMany({
      where: { createdAt: range },
      include: { client: { select: { companyName: true, industry: true, industryRef: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    const monthly = MONTHS.map((m, idx) => {
      const mi = invoices.filter(i => new Date(i.createdAt).getMonth() === idx);
      return {
        month:   m,
        total:   mi.reduce((s, i) => s + i.totalAmount, 0),
        paid:    mi.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
        pending: mi.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.totalAmount, 0),
        overdue: mi.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0),
        count:   mi.length,
      };
    });

    const clientMap = {};
    invoices.forEach(i => {
      const n = i.client?.companyName || 'Unknown';
      clientMap[n] = (clientMap[n] || 0) + i.totalAmount;
    });
    const byClient = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    const industryMap = {};
    invoices.forEach(i => {
      const ind = i.client?.industryRef?.name || i.client?.industry || 'Other';
      industryMap[ind] = (industryMap[ind] || 0) + i.totalAmount;
    });
    const byIndustry = Object.entries(industryMap).sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const statusAmountMap = {};
    invoices.forEach(i => { statusAmountMap[i.status] = (statusAmountMap[i.status] || 0) + i.totalAmount; });
    const byStatus = Object.entries(statusAmountMap).map(([name, value]) => ({ name, value }));

    const total   = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
    const pending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.totalAmount, 0);
    const overdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);

    res.json({
      summary: {
        total, paid, pending, overdue,
        invoiceCount:   invoices.length,
        collectionRate: total ? ((paid / total) * 100).toFixed(1) : '0.0',
      },
      monthly, byClient, byStatus, byIndustry,
    });
  } catch (err) {
    console.error('revenue error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── HR ── */
router.get('/hr', authenticate, async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const attRange = monthRange(year, month);

    const [employees, attendance, leaves, payrolls] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true, firstName: true, lastName: true,
          department: true, designation: true,
          status: true, joiningDate: true, nationality: true,
        },
      }),
      prisma.attendance.findMany({
        where: { date: attRange },
        select: { employeeId: true, status: true, hoursWorked: true },
      }),
      prisma.leave.findMany({
        where: { createdAt: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) } },
        select: { status: true, leaveType: true, employeeId: true },
      }),
      prisma.payroll.findMany({
        where: { year: y },
        select: { month: true, grossSalary: true, netSalary: true, deductions: true, status: true },
      }),
    ]);

    const deptMap = {};
    employees.forEach(e => { const d = e.department || 'Unknown'; deptMap[d] = (deptMap[d] || 0) + 1; });
    const byDepartment = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    const natMap = {};
    employees.forEach(e => { if (e.nationality) natMap[e.nationality] = (natMap[e.nationality] || 0) + 1; });
    const byNationality = Object.entries(natMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    const byStatus = groupCount(employees, e => e.status);

    const totalPresent = attendance.filter(a => a.status === 'PRESENT').length;
    const totalAbsent  = attendance.filter(a => a.status === 'ABSENT').length;
    const attendanceRate = attendance.length ? ((totalPresent / attendance.length) * 100).toFixed(1) : '0.0';

    const leaveByType   = groupCount(leaves, l => l.leaveType);
    const leaveByStatus = groupCount(leaves, l => l.status);

    const payrollTrend = MONTHS.map((m, idx) => {
      const mp = payrolls.filter(p => p.month === idx + 1);
      return {
        month:      m,
        gross:      mp.reduce((s, p) => s + p.grossSalary, 0),
        net:        mp.reduce((s, p) => s + p.netSalary, 0),
        deductions: mp.reduce((s, p) => s + p.deductions, 0),
      };
    });

    res.json({
      summary: {
        total:          employees.length,
        active:         employees.filter(e => e.status === 'ACTIVE').length,
        onLeave:        employees.filter(e => e.status === 'ON_LEAVE').length,
        departments:    Object.keys(deptMap).length,
        attendanceRate, totalPresent, totalAbsent,
        pendingLeaves:  leaves.filter(l => l.status === 'PENDING').length,
      },
      byDepartment, byNationality, byStatus,
      leaveByType, leaveByStatus, payrollTrend,
    });
  } catch (err) {
    console.error('hr error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── CRM ── */
router.get('/crm', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const y = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const [clients, jobs, enquiries, followUps, deals, stageChangeActivities] = await Promise.all([
      prisma.client.findMany({
        select: { id: true, industry: true, industryRef: { select: { name: true } }, country: true, city: true, isActive: true, createdAt: true, source: true },
      }),
      prisma.job.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.clientEnquiry.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, service: true, createdAt: true },
      }),
      prisma.followUp.findMany({
        where: { createdAt: range },
        select: { id: true, type: true, isCompleted: true, createdAt: true },
      }),
      // Deal pipeline — not year-scoped (a deal's lifecycle can span years; stats are point-in-time).
      prisma.deal.findMany({
        select: { id: true, stage: true, value: true, probability: true, createdAt: true, actualCloseDate: true, source: true },
      }),
      prisma.activity.findMany({
        where: { type: 'STAGE_CHANGE' },
        select: { dealId: true, metadata: true },
      }),
    ]);

    const indMap = {};
    clients.forEach(c => { const i = c.industryRef?.name || c.industry || 'Other'; indMap[i] = (indMap[i] || 0) + 1; });
    const byIndustry = Object.entries(indMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    const countryMap = {};
    clients.forEach(c => { countryMap[c.country] = (countryMap[c.country] || 0) + 1; });
    const byCountry = Object.entries(countryMap).map(([name, value]) => ({ name, value }));

    const monthlyClients = MONTHS.map((m, idx) => ({
      month:     m,
      new:       clients.filter(c => { const d = new Date(c.createdAt); return d.getFullYear() === y && d.getMonth() === idx; }).length,
      jobs:      jobs.filter(j => new Date(j.createdAt).getMonth() === idx).length,
      enquiries: enquiries.filter(e => new Date(e.createdAt).getMonth() === idx).length,
    }));

    const svcMap = {};
    enquiries.forEach(e => { const s = e.service || 'General'; svcMap[s] = (svcMap[s] || 0) + 1; });
    const enquiryByService = Object.entries(svcMap).map(([name, value]) => ({ name, value }));

    const fuTypeMap = {};
    followUps.forEach(f => { fuTypeMap[f.type] = (fuTypeMap[f.type] || 0) + 1; });
    const followUpByType = Object.entries(fuTypeMap).map(([name, value]) => ({ name, value }));

    const jobStatus = groupCount(jobs, j => j.status);

    /* ── Deal pipeline analytics (mirrors deals.js's GET /stats definitions) ── */
    const openDeals = deals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST');
    const wonDeals   = deals.filter(d => d.stage === 'WON');
    const lostDeals  = deals.filter(d => d.stage === 'LOST');

    const byStage = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(stage => {
      const inStage = deals.filter(d => d.stage === stage);
      return { stage, count: inStage.length, value: inStage.reduce((s, d) => s + d.value, 0) };
    });

    const weightedForecast = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
    const winRate = wonDeals.length + lostDeals.length ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : 0;
    const avgDealSize = deals.length ? deals.reduce((s, d) => s + d.value, 0) / deals.length : 0;
    const cycleDays = wonDeals
      .filter(d => d.actualCloseDate)
      .map(d => (new Date(d.actualCloseDate).getTime() - new Date(d.createdAt).getTime()) / 86400000);
    const avgSalesCycleDays = cycleDays.length ? cycleDays.reduce((s, n) => s + n, 0) / cycleDays.length : 0;

    /* Stage-to-stage conversion rates.
     * The schema doesn't keep a full stage-history, only current stage + the
     * activity log — so we approximate "stages a deal ever reached" as the
     * union of {its current stage (deals default to LEAD on creation)} and
     * every STAGE_CHANGE activity's metadata.to for that deal (each stage
     * transition is logged, so a deal that passed LEAD→QUALIFIED→PROPOSAL
     * has a `to` entry for QUALIFIED and PROPOSAL). This is a coarse but
     * directionally-correct approximation, not an exact historical funnel. */
    const STAGE_ORDER = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];
    const reachedByDeal = {};
    // Every deal starts at LEAD by definition (the model's default stage), so
    // it always counts toward "reached LEAD" — nothing ever logs a
    // STAGE_CHANGE *into* LEAD (it's the first stage), so without this seed
    // reachedCount['LEAD'] would incorrectly stay near zero for the very
    // deals that make up the top of the funnel.
    deals.forEach(d => { reachedByDeal[d.id] = new Set(['LEAD', d.stage]); });
    stageChangeActivities.forEach(a => {
      if (!a.dealId || !reachedByDeal[a.dealId]) return;
      const to = a.metadata?.to;
      if (to) reachedByDeal[a.dealId].add(to);
    });
    const reachedCount = {};
    STAGE_ORDER.forEach(stage => {
      reachedCount[stage] = Object.values(reachedByDeal).filter(set => set.has(stage)).length;
    });
    const conversionRates = STAGE_ORDER.slice(0, -1).map((stage, idx) => {
      const nextStage = STAGE_ORDER[idx + 1];
      const from = reachedCount[stage];
      const to = reachedCount[nextStage];
      return { from: stage, to: nextStage, fromCount: from, toCount: to, rate: from ? Number(((to / from) * 100).toFixed(1)) : 0 };
    });

    /* Lead-source performance. Grouped primarily by Deal.source since that's
     * what's actually tied to revenue outcomes (won deals/value); Client.source
     * is reported alongside as the raw lead count per source for context. */
    const sourceSet = new Set();
    clients.forEach(c => { if (c.source) sourceSet.add(c.source); });
    deals.forEach(d => { if (d.source) sourceSet.add(d.source); });
    const leadSourcePerformance = [...sourceSet].sort().map(source => {
      const sourceDeals = deals.filter(d => d.source === source);
      const sourceWon = sourceDeals.filter(d => d.stage === 'WON');
      return {
        source,
        leadCount: clients.filter(c => c.source === source).length,
        dealsCount: sourceDeals.length,
        wonDealsCount: sourceWon.length,
        wonValue: sourceWon.reduce((s, d) => s + d.value, 0),
      };
    });

    const pipeline = {
      byStage,
      conversionRates,
      weightedForecast,
      winRate: Number(winRate.toFixed(1)),
      avgDealSize,
      avgSalesCycleDays: Number(avgSalesCycleDays.toFixed(1)),
      openCount: openDeals.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      totalOpenValue: openDeals.reduce((s, d) => s + d.value, 0),
      leadSourcePerformance,
    };

    res.json({
      summary: {
        totalClients:   clients.length,
        activeClients:  clients.filter(c => c.isActive).length,
        totalJobs:      jobs.length,
        openJobs:       jobs.filter(j => j.status === 'OPEN').length,
        totalEnquiries: enquiries.length,
        totalFollowUps: followUps.length,
        completedFollowUps: followUps.filter(f => f.isCompleted).length,
      },
      byIndustry, byCountry, monthlyClients, enquiryByService, followUpByType, jobStatus,
      pipeline,
    });
  } catch (err) {
    console.error('crm error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── FINANCE ── */
router.get('/finance', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to) : new Date(now.getFullYear() + 1, 0, 1);

    // Buckets for every calendar month touched by [from, to).
    const monthBuckets = [];
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor < to) {
      monthBuckets.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    const clip = (bucketStart, bucketEnd) => ({
      gte: bucketStart < from ? from : bucketStart,
      lt: bucketEnd > to ? to : bucketEnd,
    });

    const [invoices, expenses, payrolls, bankAccounts, allTransactions, priorTransactions] = await Promise.all([
      prisma.invoice.findMany({
        where: { docType: 'INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] }, issueDate: { gte: from, lt: to } },
        select: { totalAmount: true },
      }),
      prisma.expense.findMany({
        where: { status: { notIn: ['DRAFT', 'REJECTED'] }, date: { gte: from, lt: to } },
        select: { category: true, totalAmount: true, date: true },
      }),
      prisma.payroll.findMany({ select: { year: true, month: true, grossSalary: true } }),
      prisma.bankAccount.findMany({ select: { id: true, name: true, type: true, openingBalance: true } }),
      prisma.accountTransaction.findMany({ where: { date: { gte: from, lt: to } }, select: { accountId: true, amount: true, date: true } }),
      prisma.accountTransaction.aggregate({ where: { date: { lt: from } }, _sum: { amount: true } }),
    ]);

    /* ── P&L ── */
    const revenue = invoices.reduce((s, i) => s + i.totalAmount, 0);

    const catMap = {};
    expenses.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + e.totalAmount; });
    const expensesByCategory = Object.entries(catMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => a.category.localeCompare(b.category));
    const totalExpenses = expenses.reduce((s, e) => s + e.totalAmount, 0);

    const payrollExpense = payrolls
      .filter((p) => {
        const d = new Date(p.year, p.month - 1, 1);
        return d >= from && d < to;
      })
      .reduce((s, p) => s + p.grossSalary, 0);

    const netProfit = revenue - totalExpenses - payrollExpense;
    const netMarginPct = revenue ? (netProfit / revenue) * 100 : 0;

    /* ── Cash flow ── */
    const openingBalanceAccounts = bankAccounts.reduce((s, a) => s + a.openingBalance, 0);
    const openingBalance = openingBalanceAccounts + (priorTransactions._sum.amount || 0);

    const cashIn = allTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const cashOut = allTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const netCashFlow = cashIn - cashOut;
    const closingBalance = openingBalance + netCashFlow;

    const monthly = monthBuckets.map(({ year, month }) => {
      const bucketStart = new Date(year, month - 1, 1);
      const bucketEnd = new Date(year, month, 1);
      const range = clip(bucketStart, bucketEnd);
      const inRange = allTransactions.filter((t) => t.date >= range.gte && t.date < range.lt);
      const inflow = inRange.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const outflow = inRange.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month: `${MONTHS[month - 1]} ${year}`, in: inflow, out: outflow, net: inflow - outflow };
    });

    /* ── Expenses monthly (for charting) ── */
    const expensesMonthly = monthBuckets.map(({ year, month }) => {
      const bucketStart = new Date(year, month - 1, 1);
      const bucketEnd = new Date(year, month, 1);
      const amount = expenses
        .filter((e) => e.date >= bucketStart && e.date < bucketEnd)
        .reduce((s, e) => s + e.totalAmount, 0);
      return { month: `${MONTHS[month - 1]} ${year}`, amount };
    });

    /* ── Budget vs actual (current year + current month) ── */
    const budgetVsActual = await computeVsActual({
      year: now.getFullYear(),
      period: 'MONTHLY',
      month: now.getMonth() + 1,
    });

    /* ── Accounts summary (current true balances, not range-scoped) ── */
    const accountsSummary = await Promise.all(
      bankAccounts.map(async (a) => {
        const agg = await prisma.accountTransaction.aggregate({ where: { accountId: a.id }, _sum: { amount: true } });
        return { id: a.id, name: a.name, type: a.type, currentBalance: a.openingBalance + (agg._sum.amount || 0) };
      })
    );

    res.json({
      pnl: { revenue, expensesByCategory, totalExpenses, payrollExpense, netProfit, netMarginPct },
      cashflow: { openingBalance, cashIn, cashOut, netCashFlow, closingBalance, monthly },
      expensesByCategory,
      expensesMonthly,
      budgetVsActual,
      accountsSummary,
    });
  } catch (err) {
    console.error('finance error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── LEGACY ── */
router.get('/placements', authenticate, async (req, res) => {
  try {
    const placements = await prisma.candidateJob.findMany({
      where: { status: 'JOINED' },
      include: {
        candidate: { select: { firstName: true, lastName: true, nationality: true } },
        job: { include: { client: { select: { companyName: true } } } },
      },
      orderBy: { appliedAt: 'desc' },
      take: 100,
    });
    res.json(placements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payroll-summary', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const payrolls = await prisma.payroll.findMany({
      where: {
        month: month ? parseInt(month) : new Date().getMonth() + 1,
        year:  year  ? parseInt(year)  : new Date().getFullYear(),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });
    res.json({
      totalEmployees: payrolls.length,
      totalGross:     payrolls.reduce((s, p) => s + p.grossSalary, 0),
      totalNet:       payrolls.reduce((s, p) => s + p.netSalary, 0),
      totalDeductions: payrolls.reduce((s, p) => s + p.deductions, 0),
      payrolls,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attendance-summary', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year  ? parseInt(year)  : new Date().getFullYear();
    const records = await prisma.attendance.findMany({
      where: { date: { gte: new Date(y, m-1, 1), lte: new Date(y, m, 0) } },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });
    const byEmployee = {};
    records.forEach(r => {
      if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = { employee: r.employee, present: 0, absent: 0, leave: 0, totalHours: 0 };
      if (r.status === 'PRESENT') byEmployee[r.employeeId].present++;
      else if (r.status === 'ABSENT') byEmployee[r.employeeId].absent++;
      else if (r.status === 'LEAVE') byEmployee[r.employeeId].leave++;
      byEmployee[r.employeeId].totalHours += r.hoursWorked || 0;
    });
    res.json(Object.values(byEmployee));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── PLACEMENTS DETAIL ── */
router.get('/placements-detail', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const y = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const [applications, jobs, clients] = await Promise.all([
      prisma.candidateJob.findMany({
        where: { appliedAt: range },
        include: {
          candidate: { select: { firstName: true, lastName: true, nationality: true, experience: true } },
          job: { include: { client: { select: { companyName: true, industry: true, industryRef: { select: { name: true } } } } } },
        },
      }),
      prisma.job.findMany({
        select: { id: true, title: true, status: true, createdAt: true, client: { select: { companyName: true, industry: true, industryRef: { select: { name: true } } } } },
      }),
      prisma.client.findMany({
        select: { id: true, companyName: true, industry: true, industryRef: { select: { name: true } } },
      }),
    ]);

    // Funnel: count per stage (ordered by pipeline progression)
    const stageOrder = ['NEW','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','JOINED','REJECTED','ON_HOLD'];
    const stageMap = {};
    applications.forEach(a => { stageMap[a.status] = (stageMap[a.status] || 0) + 1; });
    const funnel = stageOrder
      .filter(s => stageMap[s])
      .map(name => ({ name, value: stageMap[name] }));

    // Placement by client
    const clientPlacement = {};
    applications.filter(a => a.status === 'JOINED').forEach(a => {
      const c = a.job?.client?.companyName || 'Unknown';
      clientPlacement[c] = (clientPlacement[c] || 0) + 1;
    });
    const byClient = Object.entries(clientPlacement).sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([name, value]) => ({ name, value }));

    // Placement by industry
    const industryPlacement = {};
    applications.filter(a => a.status === 'JOINED').forEach(a => {
      const ind = a.job?.client?.industryRef?.name || a.job?.client?.industry || 'Other';
      industryPlacement[ind] = (industryPlacement[ind] || 0) + 1;
    });
    const byIndustry = Object.entries(industryPlacement).map(([name, value]) => ({ name, value }));

    // Placement by nationality
    const natPlacement = {};
    applications.filter(a => a.status === 'JOINED').forEach(a => {
      const n = a.candidate?.nationality || 'Unknown';
      natPlacement[n] = (natPlacement[n] || 0) + 1;
    });
    const byNationality = Object.entries(natPlacement).sort((a,b) => b[1]-a[1]).slice(0,8)
      .map(([name, value]) => ({ name, value }));

    // Monthly placements
    const monthlyPlacements = MONTHS.map((m, idx) => ({
      month: m,
      placed:  applications.filter(a => a.status === 'JOINED' && new Date(a.appliedAt).getMonth() === idx).length,
      offered: applications.filter(a => a.status === 'OFFERED' && new Date(a.appliedAt).getMonth() === idx).length,
      rejected: applications.filter(a => a.status === 'REJECTED' && new Date(a.appliedAt).getMonth() === idx).length,
    }));

    // Conversion rates per stage
    const total = applications.length || 1;
    const conversionStages = stageOrder.filter(s => stageMap[s]).map(name => ({
      name,
      count: stageMap[name] || 0,
      rate: (((stageMap[name] || 0) / total) * 100).toFixed(1),
    }));

    // Jobs fill rate by client
    const clientJobStats = {};
    jobs.forEach(j => {
      const c = j.client?.companyName || 'Unknown';
      if (!clientJobStats[c]) clientJobStats[c] = { name: c, total: 0, filled: 0 };
      clientJobStats[c].total++;
      if (j.status === 'FILLED') clientJobStats[c].filled++;
    });
    const jobFillByClient = Object.values(clientJobStats)
      .map((c) => ({ ...c, rate: c.total ? ((c.filled / c.total) * 100).toFixed(0) : 0 }))
      .sort((a, b) => b.total - a.total).slice(0, 10);

    res.json({
      summary: {
        totalApplications: applications.length,
        placed: applications.filter(a => a.status === 'JOINED').length,
        offered: applications.filter(a => a.status === 'OFFERED').length,
        rejected: applications.filter(a => a.status === 'REJECTED').length,
        onHold: applications.filter(a => a.status === 'ON_HOLD').length,
        conversionRate: applications.length ? ((applications.filter(a => a.status === 'JOINED').length / applications.length) * 100).toFixed(1) : '0.0',
        totalJobs: jobs.length,
        filledJobs: jobs.filter(j => j.status === 'FILLED').length,
        fillRate: jobs.length ? ((jobs.filter(j => j.status === 'FILLED').length / jobs.length) * 100).toFixed(1) : '0.0',
        uniqueClients: Object.keys(clientPlacement).length,
      },
      funnel, byClient, byIndustry, byNationality,
      monthlyPlacements, conversionStages, jobFillByClient,
    });
  } catch (err) {
    console.error('placements-detail error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── PIPELINE / REGISTRATIONS ── */
router.get('/pipeline', authenticate, async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const y = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const [registrations, profileRequests, interviews, candidates] = await Promise.all([
      prisma.candidateRegistration.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, createdAt: true, firstName: true, lastName: true },
      }),
      prisma.profileRequest.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.interview.findMany({
        where: { scheduledAt: range },
        select: { id: true, status: true, scheduledAt: true, type: true },
      }),
      prisma.candidate.findMany({
        where: { createdAt: range },
        select: { id: true, status: true, createdAt: true, isPublic: true },
      }),
    ]);

    // Monthly registration vs candidate created trend
    const monthlyTrend = MONTHS.map((m, idx) => ({
      month: m,
      registrations: registrations.filter(r => new Date(r.createdAt).getMonth() === idx).length,
      profileRequests: profileRequests.filter(r => new Date(r.createdAt).getMonth() === idx).length,
      candidates: candidates.filter(c => new Date(c.createdAt).getMonth() === idx).length,
      interviews: interviews.filter(i => new Date(i.scheduledAt).getMonth() === idx).length,
    }));

    const regByStatus      = groupCount(registrations,   r => r.status);
    const profileByStatus  = groupCount(profileRequests, r => r.status);
    const interviewByStatus = groupCount(interviews,      i => i.status);
    const interviewByType   = groupCount(interviews,      i => i.type || 'Unknown');

    // Public vs private candidates
    const publicVsPrivate = [
      { name: 'Public', value: candidates.filter(c => c.isPublic).length },
      { name: 'Private', value: candidates.filter(c => !c.isPublic).length },
    ];

    // Candidate status pipeline
    const candidateByStatus = groupCount(candidates, c => c.status);

    res.json({
      summary: {
        totalRegistrations: registrations.length,
        approvedRegistrations: registrations.filter(r => r.status === 'APPROVED').length,
        pendingRegistrations: registrations.filter(r => r.status === 'PENDING').length,
        totalProfileRequests: profileRequests.length,
        newProfileRequests: profileRequests.filter(r => r.status === 'NEW').length,
        totalInterviews: interviews.length,
        passedInterviews: interviews.filter(i => i.status === 'PASSED').length,
        publicCandidates: candidates.filter(c => c.isPublic).length,
        totalCandidates: candidates.length,
      },
      monthlyTrend, regByStatus, profileByStatus,
      interviewByStatus, interviewByType,
      publicVsPrivate, candidateByStatus,
    });
  } catch (err) {
    console.error('pipeline error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── helper ── */
function groupCount(arr, keyFn) {
  const map = {};
  arr.forEach(item => { const k = keyFn(item); map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

module.exports = router;
