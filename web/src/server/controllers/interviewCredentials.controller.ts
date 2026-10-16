/**
 * Staff management of interview login credentials. Staff can set, replace,
 * revoke and re-send them, and see their status — but never read the username
 * or password back (see utils/interviewCredentials).
 */
import { prisma } from '@/lib/prisma';
import { requireCandidate } from '../auth';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json } from '../http';
import {
  cleanCredentialInput, credentialState, decrypt, emailCredentials, purgeExpiredCredentials, saveCredentials, staffView,
} from '../utils/interviewCredentials';

const audit = (userId: string, action: string, recordId: string, newData?: any) =>
  prisma.auditLog.create({ data: { userId, action, module: 'interviews', recordId, newData } }).catch(() => {});

/* GET /api/interviews/:id/credentials — status only */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'interviews', 'view');
  await purgeExpiredCredentials();
  const c = await prisma.interviewCredential.findUnique({ where: { interviewId: params.id } });
  return json({ credential: staffView(c) });
});

/* PUT /api/interviews/:id/credentials — set or replace { label, loginUrl, username, password, instructions, expiresAt, sendEmail } */
export const put = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'interview_credentials', 'manage');
  const raw = (await body(req)) || {};
  const iv = await prisma.interview.findUnique({ where: { id: params.id }, select: { id: true, scheduledAt: true } });
  if (!iv) throw new HttpError(404, 'Interview not found');
  // Only an upcoming interview requires the login to outlast it.
  const input = cleanCredentialInput(raw, { scheduledAt: iv.scheduledAt > new Date() ? iv.scheduledAt : undefined });
  const saved = await saveCredentials(iv.id, input, user.id);
  await audit(user.id, 'SET_INTERVIEW_CREDENTIALS', iv.id, { expiresAt: input.expiresAt.toISOString(), label: input.label || null });

  let emailError: string | null = null;
  if (raw.sendEmail !== false) {
    try { await emailCredentials(iv.id); } catch (e: any) { emailError = e.message || 'Email failed'; }
  }
  const fresh = await prisma.interviewCredential.findUnique({ where: { id: saved.id } });
  return json({ credential: staffView(fresh), emailed: raw.sendEmail !== false && !emailError, emailError });
});

/* DELETE /api/interviews/:id/credentials — revoke now (removed from the candidate's dashboard) */
export const revoke = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'interview_credentials', 'manage');
  const c = await prisma.interviewCredential.findUnique({ where: { interviewId: params.id } });
  if (!c) throw new HttpError(404, 'No login details are set for this interview');
  const updated = await prisma.interviewCredential.update({
    where: { id: c.id },
    data: { revokedAt: new Date(), usernameEnc: null, passwordEnc: null, purgedAt: new Date(), updatedById: user.id },
  });
  await audit(user.id, 'REVOKE_INTERVIEW_CREDENTIALS', params.id);
  return json({ credential: staffView(updated) });
});

/* POST /api/interviews/:id/credentials/resend */
export const resend = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'interview_credentials', 'manage');
  await emailCredentials(params.id);
  await audit(user.id, 'RESEND_INTERVIEW_CREDENTIALS', params.id);
  const c = await prisma.interviewCredential.findUnique({ where: { interviewId: params.id } });
  return json({ credential: staffView(c) });
});

/* GET /api/candidate-auth/interview-credentials — the signed-in candidate's active logins */
export const mine = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  await purgeExpiredCredentials();
  const rows = await prisma.interviewCredential.findMany({
    where: { interview: { candidateId: candidate.id }, revokedAt: null, purgedAt: null, expiresAt: { gt: new Date() } },
    include: { interview: { select: { id: true, scheduledAt: true, mode: true, job: { select: { title: true, client: { select: { companyName: true } } } } } } },
    orderBy: { expiresAt: 'asc' },
  });
  const out = rows.flatMap(c => {
    const plain = credentialState(c) === 'active' ? decrypt(c) : null;
    if (!plain) return [];
    return [{
      interviewId: c.interviewId, jobTitle: c.interview.job?.title || null, companyName: c.interview.job?.client?.companyName || null,
      scheduledAt: c.interview.scheduledAt, label: c.label, loginUrl: c.loginUrl, instructions: c.instructions,
      username: plain.username, password: plain.password, expiresAt: c.expiresAt,
    }];
  });
  const firstViews = rows.filter(c => !c.viewedAt).map(c => c.id);
  if (firstViews.length) await prisma.interviewCredential.updateMany({ where: { id: { in: firstViews } }, data: { viewedAt: new Date() } });
  return json(out, 200, { 'Cache-Control': 'no-store, private' });
});
