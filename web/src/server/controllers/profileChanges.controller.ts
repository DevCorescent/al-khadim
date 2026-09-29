/**
 * Review queue for candidate self-service profile edits. Candidates stage a
 * change with a reason (candidateAuth.updateMe); only a SUPER_ADMIN may
 * approve (apply it to the profile) or reject it. Either way the candidate is
 * emailed and sees the outcome on their profile page.
 */
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { body, handler, json, query } from '../http';
import { pagination } from '../validate';
import {
  type ChangeSet, changeData, discardStagedFiles, notifyCandidateOfDecision,
} from '../utils/profileChanges';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
const NOTE_MAX = 1000;

const CANDIDATE_SELECT = {
  id: true, cvId: true, firstName: true, lastName: true, email: true, phone: true, photo: true,
};

/* GET /  ?status=PENDING&search=&page=&limit= */
export const list = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const q = query(req);
  const { page, limit, skip } = pagination(q, { defaultLimit: 20 });
  const status = STATUSES.includes(q.status) ? q.status : undefined;
  const where: any = {};
  if (status) where.status = status;
  if (q.search) {
    const search = String(q.search);
    where.candidate = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cvId: { contains: search, mode: 'insensitive' } },
      ],
    };
  }
  const [data, total, pendingCount] = await Promise.all([
    prisma.candidateProfileChange.findMany({
      where, skip, take: limit,
      // Oldest pending first, so the queue is worked in order; history newest first.
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      include: {
        candidate: { select: CANDIDATE_SELECT },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.candidateProfileChange.count({ where }),
    prisma.candidateProfileChange.count({ where: { status: 'PENDING' } }),
  ]);
  return json({ data, total, page, limit, pendingCount });
});

/* GET /count — for the sidebar badge */
export const count = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  return json({ pending: await prisma.candidateProfileChange.count({ where: { status: 'PENDING' } }) });
});

async function review(id: string, approve: boolean, reviewerId: string, note: string | null) {
  const request = await prisma.candidateProfileChange.findUnique({
    where: { id }, include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!request) return json({ error: 'Not found' }, 404);
  const changes = request.changes as ChangeSet;
  const decided = { status: approve ? 'APPROVED' as const : 'REJECTED' as const, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note };

  const applied = await prisma.$transaction(async (tx) => {
    // Conditional on PENDING so a double click / withdraw race can't apply twice.
    const { count } = await tx.candidateProfileChange.updateMany({ where: { id, status: 'PENDING' }, data: decided });
    if (!count) return false;
    if (approve) {
      await tx.candidate.update({ where: { id: request.candidateId }, data: changeData(changes) });
      await tx.candidateEditHistory.create({
        data: {
          candidateId: request.candidateId,
          editedBy: 'candidate',
          editorName: `${request.candidate.firstName} ${request.candidate.lastName}`,
          editorId: reviewerId, // the approver
          changes,
          reason: request.reason,
        },
      });
    }
    return true;
  });
  if (!applied) return json({ error: 'This request has already been reviewed or withdrawn.' }, 409);

  if (!approve) await discardStagedFiles(changes);
  notifyCandidateOfDecision(request.candidate, changes, approve, note)
    .catch((e: any) => console.error('[profileChanges] decision email failed:', e.message));

  const updated = await prisma.candidateProfileChange.findUnique({
    where: { id }, include: { candidate: { select: CANDIDATE_SELECT }, reviewedBy: { select: { id: true, name: true } } },
  });
  return json(updated);
}

function readNote(raw: any): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw Object.assign(new Error('note must be a string'), { status: 400 });
  const note = raw.trim();
  if (note.length > NOTE_MAX) throw Object.assign(new Error(`note must be ${NOTE_MAX} characters or fewer`), { status: 400 });
  return note || null;
}

/* POST /:id/approve  { note? } */
export const approve = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const { note } = (await body(req)) || {};
    return await review(params.id, true, user.id, readNote(note));
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* POST /:id/reject  { note } — the candidate is told why */
export const reject = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const { note } = (await body(req)) || {};
    const reason = readNote(note);
    if (!reason) return json({ error: 'Please give the candidate a reason for rejecting.' }, 400);
    return await review(params.id, false, user.id, reason);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});
