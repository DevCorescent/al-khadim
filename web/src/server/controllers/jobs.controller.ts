// Ported from api/src/routes/jobs.js
import { prisma } from '@/lib/prisma';
import { CandidateStatus, JobStatus, Prisma } from '@/generated/prisma/client';
import { requireApprovedClient } from '../auth';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { sendTemplatedMail } from '../utils/templateRenderer';
import { pagination, pickFields, scalarFields, toDate, toNumber } from '../validate';

const CATEGORY_INDUSTRY_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  industry: { select: { id: true, key: true, name: true, color: true } },
};

const JOB_STATUSES = Object.values(JobStatus) as string[];
const APPLICATION_STATUSES = Object.values(CandidateStatus) as string[];

/** Columns staff may set; publishing and company-request provenance have their own flows. */
const STAFF_FIELDS = scalarFields(Prisma.JobScalarFieldEnum, [
  'source', 'requestedByClientUserId', 'isPublished', 'publishedAt', 'publishedByUserId',
]);

/** Columns a company portal user may set on a job request. */
const COMPANY_FIELDS = [
  'title', 'description', 'requirements', 'location', 'country', 'jobType', 'experience',
  'positionsCount', 'salaryMin', 'salaryMax', 'currency', 'deadline', 'categoryId', 'industryId',
];

const NULLABLE_TEXT = ['description', 'requirements', 'location', 'jobType', 'experience'];

/**
 * Whitelists and normalises a job payload (numbers, dates, empty selects).
 * With `partial` only the fields that were sent are touched.
 */
function jobData(raw: any, allowed: readonly string[], partial: boolean) {
  const data: any = pickFields(raw || {}, allowed);

  if (!partial || 'title' in data) {
    if (typeof data.title !== 'string' || !data.title.trim()) throw new HttpError(400, 'Job title is required');
  }
  if (allowed.includes('clientId') && (!partial || 'clientId' in data)) {
    if (typeof data.clientId !== 'string' || !data.clientId) throw new HttpError(400, 'clientId is required');
  }
  if (data.status !== undefined) {
    if (!JOB_STATUSES.includes(data.status)) throw new HttpError(400, 'Invalid status');
  }
  for (const f of ['salaryMin', 'salaryMax']) {
    if (data[f] !== undefined) data[f] = toNumber(data[f], f) ?? null;
  }
  for (const f of ['positionsCount', 'filledCount']) {
    if (data[f] === undefined) continue;
    const n = toNumber(data[f], f);
    if (n === undefined) delete data[f]; // non-nullable — keep default / current value
    else if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${f} must be a non-negative whole number`);
    else data[f] = n;
  }
  if (data.salaryMin != null && data.salaryMax != null && data.salaryMin > data.salaryMax) {
    throw new HttpError(400, 'salaryMin cannot be greater than salaryMax');
  }
  if (data.deadline !== undefined) data.deadline = toDate(data.deadline, 'deadline');
  for (const f of ['categoryId', 'industryId']) if (data[f] === '') data[f] = null;
  for (const f of ['country', 'currency']) if (data[f] === '' || data[f] === null) delete data[f];
  for (const f of NULLABLE_TEXT) if (data[f] === '') data[f] = null;
  return data;
}

/** Maps Prisma write errors to client errors instead of 500s. */
function prismaError(err: any, notFound = 'Job not found'): never {
  if (err instanceof HttpError) throw err;
  if (err?.code === 'P2025') throw new HttpError(404, notFound);
  if (err?.code === 'P2003') throw new HttpError(400, 'Invalid client, category or industry');
  if (err?.name === 'PrismaClientValidationError') throw new HttpError(400, 'Invalid job data');
  throw err;
}

export const list = handler(async (req) => {
  await requirePermission(req, 'jobs', 'view');
  const q = query(req);
  const { search, status, clientId, categoryId, industryId } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 500 });
  const where: any = {};
  if (search) where.title = { contains: String(search), mode: 'insensitive' };
  if (status) {
    if (!JOB_STATUSES.includes(String(status))) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }
  if (clientId) where.clientId = String(clientId);
  if (categoryId) where.categoryId = String(categoryId);
  if (industryId) where.industryId = String(industryId);

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { applications: true, interviews: true } },
        ...CATEGORY_INDUSTRY_INCLUDE,
      },
    }),
    prisma.job.count({ where }),
  ]);
  return json({ data: jobs, total, page, limit });
});

export const listPublic = handler(async (req) => {
  const { limit } = pagination(query(req), { defaultLimit: 50, maxLimit: 50 });
  const jobs = await prisma.job.findMany({
    where: { status: 'OPEN', isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { companyName: true, country: true } } },
    // Internal account ids (company requester / publishing staff user) are not public.
    omit: { requestedByClientUserId: true, publishedByUserId: true },
    take: limit,
  });
  return json(jobs);
});

/* ── Company portal: this company's own submitted job requests ── */
export const listMine = handler(async (req) => {
  const { client } = await requireApprovedClient(req);
  const jobs = await prisma.job.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    include: CATEGORY_INDUSTRY_INCLUDE,
  });
  return json(jobs);
});

/* ── Company portal: submit a new job request (internal-only until staff publishes it) ── */
export const createMine = handler(async (req) => {
  const { client, clientUser } = await requireApprovedClient(req);
  const data = jobData(await body(req), COMPANY_FIELDS, false);
  data.title = data.title.trim();

  let job: any;
  try {
    job = await prisma.job.create({
      data: {
        ...data,
        clientId: client.id,
        source: 'COMPANY_REQUEST',
        requestedByClientUserId: clientUser.id,
        isPublished: false,
        status: 'OPEN',
      },
      include: CATEGORY_INDUSTRY_INCLUDE,
    });
  } catch (err: any) {
    if (err?.code === 'P2003') throw new HttpError(400, 'Invalid category or industry');
    prismaError(err);
  }

  // Fire-and-forget admin notification.
  prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { email: true } })
    .then((admins) => Promise.all(admins.map((a) => sendTemplatedMail({
      templateSlug: 'admin-new-job-request',
      to: a.email,
      data: { companyName: client.companyName, jobTitle: job.title },
    }).catch((e: any) => console.error('job request admin notify failed', e)))))
    .catch((e) => console.error('admin lookup failed', e));

  return json(job, 201);
});

export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'jobs', 'view');
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      applications: { include: { candidate: true } },
      interviews: { include: { candidate: true } },
      requestedByClientUser: { select: { name: true, email: true } },
      ...CATEGORY_INDUSTRY_INCLUDE,
    },
  });
  if (!job) return json({ error: 'Job not found' }, 404);
  return json(job);
});

export const create = handler(async (req) => {
  await requirePermission(req, 'jobs', 'create');
  const data = jobData(await body(req), STAFF_FIELDS, false);
  try {
    const job = await prisma.job.create({ data, include: { client: true, ...CATEGORY_INDUSTRY_INCLUDE } });
    return json(job, 201);
  } catch (err: any) {
    prismaError(err);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'jobs', 'edit');
  const data = jobData(await body(req), STAFF_FIELDS, true);
  try {
    const job = await prisma.job.update({
      where: { id: params.id }, data,
      include: { client: true, ...CATEGORY_INDUSTRY_INCLUDE },
    });
    return json(job);
  } catch (err: any) {
    prismaError(err);
  }
});

export const publish = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'jobs', 'edit');
  try {
    const job = await prisma.job.update({
      where: { id: params.id },
      data: { isPublished: true, publishedAt: new Date(), publishedByUserId: user.id },
    });
    return json(job);
  } catch (err: any) {
    prismaError(err);
  }
});

export const unpublish = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'jobs', 'edit');
  try {
    const job = await prisma.job.update({
      where: { id: params.id },
      data: { isPublished: false },
    });
    return json(job);
  } catch (err: any) {
    prismaError(err);
  }
});

export const updateApplication = handler<{ appId: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'edit', ['jobs', 'edit']);
  const { status } = await body(req);
  if (!APPLICATION_STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);
  try {
    const app = await prisma.candidateJob.update({
      where: { id: params.appId },
      data: { status },
    });
    return json(app);
  } catch (err: any) {
    prismaError(err, 'Application not found');
  }
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'jobs', 'delete');
  try {
    await prisma.job.delete({ where: { id: params.id } });
    return json({ message: 'Job deleted' });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return json({ error: 'This job has applications, interviews or deals linked to it and cannot be deleted. Close it instead.' }, 409);
    }
    prismaError(err);
  }
});
