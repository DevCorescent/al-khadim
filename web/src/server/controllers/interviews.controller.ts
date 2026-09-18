// Ported from api/src/routes/interviews.js
import { prisma } from '@/lib/prisma';
import { InterviewMode } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { pagination, pickFields, toDate, toNumber } from '../validate';

/** Columns staff may set; the profile-share link is only set by the schedule-interview flow. */
const INTERVIEW_FIELDS = [
  'candidateId', 'jobId', 'scheduledAt', 'type', 'mode', 'meetLink', 'location',
  'interviewers', 'status', 'feedback', 'rating', 'notes',
];
const MODES = Object.values(InterviewMode) as string[];
const NULLABLE_TEXT = ['meetLink', 'location', 'feedback', 'notes'];

function interviewData(raw: any, partial: boolean) {
  const data: any = pickFields(raw || {}, INTERVIEW_FIELDS);

  for (const f of ['candidateId', 'jobId']) {
    if ((!partial || f in data) && (typeof data[f] !== 'string' || !data[f])) throw new HttpError(400, `${f} is required`);
  }
  if (!partial || 'scheduledAt' in data) {
    const d = toDate(data.scheduledAt, 'scheduledAt');
    if (!d) throw new HttpError(400, 'scheduledAt is required');
    data.scheduledAt = d;
  }
  for (const f of ['type', 'status']) {
    if (data[f] === undefined) continue;
    if (data[f] === '' || data[f] === null) delete data[f]; // non-nullable — keep default / current value
    else if (typeof data[f] !== 'string') throw new HttpError(400, `Invalid ${f}`);
  }
  if (data.mode !== undefined && !MODES.includes(data.mode)) throw new HttpError(400, 'mode must be ONLINE or OFFLINE');
  if (data.interviewers !== undefined) {
    const list = Array.isArray(data.interviewers) ? data.interviewers : String(data.interviewers ?? '').split(',');
    data.interviewers = list.map((s: unknown) => String(s).trim()).filter(Boolean);
  }
  if (data.rating !== undefined) {
    const n = toNumber(data.rating, 'rating');
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 5)) throw new HttpError(400, 'rating must be a whole number from 1 to 5');
    data.rating = n ?? null;
  }
  for (const f of NULLABLE_TEXT) if (data[f] === '') data[f] = null;
  return data;
}

function prismaError(err: any): never {
  if (err instanceof HttpError) throw err;
  if (err?.code === 'P2025') throw new HttpError(404, 'Interview not found');
  if (err?.code === 'P2003') throw new HttpError(400, 'Invalid candidate or job');
  if (err?.name === 'PrismaClientValidationError') throw new HttpError(400, 'Invalid interview data');
  throw err;
}

export const list = handler(async (req) => {
  await requirePermission(req, 'interviews', 'view');
  const q = query(req);
  const { status, candidateId, jobId } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 500 });
  const where: any = {};
  if (status) where.status = String(status);
  if (candidateId) where.candidateId = String(candidateId);
  if (jobId) where.jobId = String(jobId);

  const [interviews, total] = await Promise.all([
    prisma.interview.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { include: { client: { select: { companyName: true } } } },
      },
    }),
    prisma.interview.count({ where }),
  ]);
  return json({ data: interviews, total, page, limit });
});

export const create = handler(async (req) => {
  await requirePermission(req, 'interviews', 'create');
  const data = interviewData(await body(req), false);
  try {
    const interview = await prisma.interview.create({
      data,
      include: {
        candidate: true,
        job: { include: { client: true } },
      },
    });
    return json(interview, 201);
  } catch (err: any) {
    prismaError(err);
  }
});

export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'interviews', 'edit');
  const data = interviewData(await body(req), true);
  try {
    const interview = await prisma.interview.update({
      where: { id: params.id },
      data,
      include: { candidate: true, job: true },
    });
    return json(interview);
  } catch (err: any) {
    prismaError(err);
  }
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'interviews', 'delete');
  try {
    await prisma.interview.delete({ where: { id: params.id } });
    return json({ message: 'Interview deleted' });
  } catch (err: any) {
    prismaError(err);
  }
});
