// Ported from api/src/routes/clients.js
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { hasPermission, requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { escapeHtml, pagination, pickFields, scalarFields } from '../validate';
import { sendTemplatedMail } from '../utils/templateRenderer';

const INDUSTRY_SELECT = { id: true, key: true, name: true, color: true };

/** Columns staff may set directly; approval state goes through /approve and /reject. */
const CLIENT_FIELDS = scalarFields(Prisma.ClientScalarFieldEnum, [
  'status', 'approvedAt', 'approvedByUserId', 'rejectedAt', 'rejectionReason',
]);
const REQUIRED_FIELDS = ['companyName', 'contactPerson', 'email', 'phone'];
/** Invoices that have been issued but not yet paid. */
const OUTSTANDING_STATUSES = ['SENT', 'OVERDUE'];

/** Whitelists and normalises a create/update payload. */
function clientData(raw: any, partial: boolean) {
  const data: any = pickFields(raw, CLIENT_FIELDS);
  for (const f of REQUIRED_FIELDS) {
    if ((!partial || f in data) && (typeof data[f] !== 'string' || !data[f].trim())) {
      throw new HttpError(400, `${f} is required`);
    }
  }
  if (data.industryId === '') data.industryId = null;
  if (data.isActive !== undefined) data.isActive = data.isActive === true || data.isActive === 'true';
  if (data.tags !== undefined) {
    const tags = Array.isArray(data.tags) ? data.tags : data.tags === null ? [] : [data.tags];
    data.tags = [...new Set(tags.map((t: any) => String(t).trim()).filter(Boolean))];
  }
  if (data.country === '' || data.country === null) delete data.country; // non-nullable, keeps its default
  return data;
}

/** Revenue/invoice figures are finance data: only for roles that can see invoices or finance
 * (same rule as the reports overview and the dashboard). */
async function canSeeRevenue(user: Parameters<typeof hasPermission>[0]) {
  return await hasPermission(user, 'invoices', 'view') || await hasPermission(user, 'finance', 'view');
}

export const list = handler(async (req) => {
  const user = await requirePermission(req, 'clients', 'view');
  const revenue = await canSeeRevenue(user);
  const q = query(req);
  const { search, isActive, industry, industryId, status } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20 });
  const where: any = {};
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
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { jobs: true, followUps: true, invoices: true, enquiries: true } },
        invoices: { select: { totalAmount: true, status: true }, ...(!revenue && { take: 0 }) },
        jobs: { select: { status: true } },
        industryRef: { select: INDUSTRY_SELECT },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const enriched = clients.map((c) => ({
    ...c,
    totalRevenue: c.invoices.reduce((s, i) => s + i.totalAmount, 0),
    paidRevenue:  c.invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
    openJobs:     c.jobs.filter((j) => j.status === 'OPEN').length,
    filledJobs:   c.jobs.filter((j) => j.status === 'FILLED').length,
  }));

  return json({ data: enriched, total, page, limit });
});

/* Full client detail with all analytics */
export const detail = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'clients', 'view');
  const revenue = await canSeeRevenue(user);
  try {
    const id = params.id;

    const [client, jobs, followUps, invoices, enquiries, clientUsers, profileShares] = await Promise.all([
      prisma.client.findUnique({ where: { id }, include: { industryRef: { select: INDUSTRY_SELECT } } }),
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
        ...(!revenue && { take: 0 }),
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

    if (!client) return json({ error: 'Client not found' }, 404);

    // Revenue analytics
    const totalRevenue   = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paidRevenue    = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
    const pendingRevenue = invoices.filter((i) => OUTSTANDING_STATUSES.includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);
    const overdueRevenue = invoices.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);

    // Revenue by month (current year)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const currentYear = new Date().getFullYear();
    const revenueByMonth = months.map((m, idx) => {
      const mi = invoices.filter((i) => {
        const d = new Date(i.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === idx;
      });
      return {
        month: m,
        total: mi.reduce((s, i) => s + i.totalAmount, 0),
        paid:  mi.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
      };
    });

    // Job analytics
    const totalJobs  = jobs.length;
    const openJobs   = jobs.filter((j) => j.status === 'OPEN').length;
    const filledJobs = jobs.filter((j) => j.status === 'FILLED').length;
    const closedJobs = jobs.filter((j) => j.status === 'CLOSED').length;
    const fillRate   = totalJobs ? ((filledJobs / totalJobs) * 100).toFixed(1) : '0.0';

    // Candidate placements (JOINED applications across client's jobs)
    const placements = jobs.flatMap((j) =>
      j.applications.filter((cj) => cj.status === 'JOINED').map((cj) => ({
        candidateName: `${cj.candidate.firstName} ${cj.candidate.lastName}`,
        nationality: cj.candidate.nationality,
        jobTitle: j.title,
        date: cj.appliedAt,
      })),
    );

    // Follow-up activity
    const totalFollowUps     = followUps.length;
    const completedFollowUps = followUps.filter((f) => f.isCompleted).length;
    const pendingFollowUps   = followUps.filter((f) => !f.isCompleted).length;

    const followUpByType = followUps.reduce((acc: Record<string, number>, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1; return acc;
    }, {});

    // Activity timeline (last 20 events across all entities)
    const timeline = [
      ...invoices.slice(0, 5).map((i) => ({
        type: 'invoice', date: i.createdAt, title: `Invoice ${i.invoiceNo}`,
        subtitle: `AED ${i.totalAmount.toLocaleString()} — ${i.status}`, color: '#6366f1',
      })),
      ...jobs.slice(0, 5).map((j) => ({
        type: 'job', date: j.createdAt, title: `Job: ${j.title}`,
        subtitle: j.status as string, color: '#10b981',
      })),
      ...followUps.slice(0, 5).map((f) => ({
        type: 'followup', date: f.createdAt, title: f.subject,
        subtitle: `${f.type} — ${f.isCompleted ? 'Done' : 'Pending'}`, color: '#f59e0b',
      })),
      ...enquiries.slice(0, 3).map((e) => ({
        type: 'enquiry', date: e.createdAt, title: `Enquiry: ${e.service || 'General'}`,
        subtitle: e.status as string, color: '#a855f7',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

    return json({
      client,
      analytics: {
        revenue: { totalRevenue, paidRevenue, pendingRevenue, overdueRevenue, collectionRate: totalRevenue ? ((paidRevenue / totalRevenue) * 100).toFixed(1) : '0.0' },
        jobs: { totalJobs, openJobs, filledJobs, closedJobs, fillRate },
        placements: placements.length,
        followUps: { totalFollowUps, completedFollowUps, pendingFollowUps, byType: Object.entries(followUpByType).map(([name, value]) => ({ name, value })) },
        enquiries: enquiries.length,
      },
      revenueByMonth,
      jobs: jobs.map((j) => ({ ...j, applications: j.applications.slice(0, 5) })),
      invoices,
      followUps,
      enquiries,
      placements,
      timeline,
      clientUsers,
      profileShares,
    });
  } catch (err: any) {
    console.error('client detail error', err);
    return json({ error: err.message }, 500);
  }
});

/* Distinct tags across all clients, for a tag-picker autocomplete. */
export const allTags = handler(async (req) => {
  await requirePermission(req, 'clients', 'view');
  const clients = await prisma.client.findMany({ where: { tags: { isEmpty: false } }, select: { tags: true } });
  const all = new Set<string>();
  clients.forEach((c) => c.tags.forEach((t) => all.add(t)));
  return json([...all].sort());
});

export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'view');
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      followUps: { orderBy: { dueDate: 'asc' }, take: 10 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
      industryRef: { select: INDUSTRY_SELECT },
    },
  });
  if (!client) return json({ error: 'Client not found' }, 404);
  return json(client);
});

export const create = handler(async (req) => {
  await requirePermission(req, 'clients', 'create');
  const data = clientData(await body(req), false);
  try {
    const client = await prisma.client.create({ data });
    return json(client, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'edit');
  const data = clientData(await body(req), true);
  try {
    const client = await prisma.client.update({ where: { id: params.id }, data });
    return json(client);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Client not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'clients', 'delete');
  try {
    await prisma.client.delete({ where: { id: params.id } });
    return json({ message: 'Client deleted' });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return json({ error: 'This client has linked records (jobs, invoices, deals, ...) and cannot be deleted. Deactivate it instead.' }, 409);
    }
    return json({ error: 'Client not found' }, 404);
  }
});

/* ── Approve a pending self-signup company (super admin / admin only) ── */
export const approve = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'clients', 'edit');
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) throw new HttpError(403, 'Insufficient permissions');
  try {
    const client = await prisma.client.update({
      where: { id: params.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: user.id, rejectedAt: null, rejectionReason: null },
    });
    sendTemplatedMail({
      templateSlug: 'client-profile-approved',
      to: client.email,
      data: { contactPerson: client.contactPerson, companyName: client.companyName },
    }).catch((e) => console.error('client approve email failed', e));
    return json(client);
  } catch {
    return json({ error: 'Client not found' }, 404);
  }
});

/* ── Reject a pending self-signup company (super admin / admin only) ── */
export const reject = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'clients', 'edit');
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) throw new HttpError(403, 'Insufficient permissions');
  try {
    const { reason } = await body(req);
    const client = await prisma.client.update({
      where: { id: params.id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || null },
    });
    sendTemplatedMail({
      templateSlug: 'client-profile-rejected',
      to: client.email,
      data: {
        contactPerson: client.contactPerson,
        companyName: client.companyName,
        reasonBlock: reason ? ` Reason: ${escapeHtml(reason)}` : '',
      },
    }).catch((e) => console.error('client reject email failed', e));
    return json(client);
  } catch {
    return json({ error: 'Client not found' }, 404);
  }
});
