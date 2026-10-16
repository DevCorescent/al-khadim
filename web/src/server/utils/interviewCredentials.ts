/**
 * Interview login credentials: the username / password a candidate uses to
 * attend an interview (e.g. on an assessment platform).
 *
 * Confidentiality rules enforced here:
 *  - stored encrypted; only `forCandidate` ever decrypts them for display, and
 *    only to the candidate the interview belongs to, before expiry;
 *  - staff see status only (set / emailed / viewed / expires / revoked);
 *  - after expiry or revocation the encrypted values are wiped (`purge`).
 */
import { prisma } from '@/lib/prisma';
import { HttpError } from '../http';
import { escapeHtml } from '../validate';
import { open, seal } from './secretBox';

export interface CredentialInput {
  label?: string;
  loginUrl?: string;
  username: string;
  password: string;
  instructions?: string;
  expiresAt: string | Date;
}

const MAX_DAYS = 90;

export function cleanCredentialInput(raw: any, { scheduledAt }: { scheduledAt?: Date } = {}): CredentialInput & { expiresAt: Date } {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Invalid credentials');
  const str = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const username = str(raw.username, 200);
  const password = typeof raw.password === 'string' ? raw.password.slice(0, 200) : '';
  if (!username) throw new HttpError(400, 'Enter the username for the interview login');
  if (!password) throw new HttpError(400, 'Enter the password for the interview login');
  const loginUrl = str(raw.loginUrl, 500);
  if (loginUrl && !/^https?:\/\/\S+$/i.test(loginUrl)) throw new HttpError(400, 'The login page must be a valid http(s) link');
  const expiresAt = new Date(raw.expiresAt);
  if (isNaN(expiresAt.getTime())) throw new HttpError(400, 'Choose when the credentials expire');
  if (expiresAt.getTime() <= Date.now()) throw new HttpError(400, 'The expiry must be in the future');
  if (scheduledAt && expiresAt < scheduledAt) throw new HttpError(400, 'The credentials must stay valid until at least the interview time');
  if (expiresAt.getTime() > Date.now() + MAX_DAYS * 86_400_000) throw new HttpError(400, `Credentials can be valid for at most ${MAX_DAYS} days`);
  return { label: str(raw.label, 120), loginUrl, username, password, instructions: str(raw.instructions, 1000), expiresAt };
}

/** Creates or replaces the credentials for an interview (inside an optional transaction). */
export async function saveCredentials(interviewId: string, input: CredentialInput & { expiresAt: Date }, userId: string, tx: any = prisma) {
  const data = {
    label: input.label || null,
    loginUrl: input.loginUrl || null,
    usernameEnc: seal(input.username),
    passwordEnc: seal(input.password),
    instructions: input.instructions || null,
    expiresAt: input.expiresAt,
    revokedAt: null, purgedAt: null, viewedAt: null, emailedAt: null,
    updatedById: userId,
  };
  return tx.interviewCredential.upsert({
    where: { interviewId },
    create: { interviewId, ...data, createdById: userId },
    update: data,
  });
}

/** Wipes the encrypted values of expired / revoked credentials (keeps the status record). */
export async function purgeExpiredCredentials() {
  await prisma.interviewCredential.updateMany({
    where: { purgedAt: null, OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
    data: { usernameEnc: null, passwordEnc: null, purgedAt: new Date() },
  });
}

export type CredentialState = 'active' | 'expired' | 'revoked';
export function credentialState(c: { expiresAt: Date; revokedAt: Date | null }): CredentialState {
  if (c.revokedAt) return 'revoked';
  return c.expiresAt.getTime() <= Date.now() ? 'expired' : 'active';
}

/** What staff may see: never the username or password. */
export function staffView(c: any) {
  if (!c) return null;
  return {
    id: c.id, label: c.label, loginUrl: c.loginUrl, instructions: c.instructions,
    expiresAt: c.expiresAt, emailedAt: c.emailedAt, viewedAt: c.viewedAt, revokedAt: c.revokedAt,
    createdAt: c.createdAt, updatedAt: c.updatedAt,
    state: credentialState(c),
  };
}

/** Decrypted values for the candidate, or null once expired / revoked / unreadable. */
export function decrypt(c: any): { username: string; password: string } | null {
  if (!c || credentialState(c) !== 'active') return null;
  const username = open(c.usernameEnc), password = open(c.passwordEnc);
  return username && password ? { username, password } : null;
}

const fmt = (d: Date) => d.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }) + ' (UAE time)';

/** The credentials section for the candidate's email (values escaped; fragment HTML). */
export function credentialsEmailBlock(c: { label?: string | null; loginUrl?: string | null; instructions?: string | null; expiresAt: Date }, plain: { username: string; password: string }) {
  const row = (label: string, value: string, mono = false) =>
    `<tr><td style="padding:10px 14px;border-top:1px solid #E3E8EA;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5F6B70;width:38%;background:#FAFBFB">${label}</td>`
    + `<td style="padding:10px 14px;border-top:1px solid #E3E8EA;font-family:${mono ? "'Courier New',Courier,monospace" : 'Arial,Helvetica,sans-serif'};font-size:14px;font-weight:700;color:#1F2A30;word-break:break-all">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 16px;border:1px solid #E3E8EA;border-radius:10px;border-collapse:separate;overflow:hidden">
    <tr><td colspan="2" style="padding:12px 14px;background:#0D4E60;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FFFFFF">Your interview login${c.label ? ` — ${escapeHtml(c.label)}` : ''}</td></tr>
    ${c.loginUrl ? row('Login page', `<a href="${escapeHtml(c.loginUrl)}" style="color:#0D4E60">${escapeHtml(c.loginUrl)}</a>`) : ''}
    ${row('Username', escapeHtml(plain.username), true)}
    ${row('Password', escapeHtml(plain.password), true)}
    ${row('Valid until', escapeHtml(fmt(c.expiresAt)))}
  </table>
  ${c.instructions ? `<p style="margin:0 0 12px">${escapeHtml(c.instructions).replace(/\n/g, '<br/>')}</p>` : ''}
  <p style="margin:0 0 14px;font-size:13px;color:#5F6B70">Please keep these details private. They are also shown in your candidate dashboard until they expire.</p>`;
}

export { fmt as formatCredentialExpiry };

/** Emails the interview login details to the candidate (dedicated template). */
export async function emailCredentials(interviewId: string) {
  const { sendTemplatedMail } = await import('./templateRenderer');
  const iv = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      credential: true,
      candidate: { select: { firstName: true, lastName: true, email: true } },
      job: { select: { title: true, client: { select: { companyName: true } } } },
    },
  });
  if (!iv?.credential) throw new HttpError(404, 'No login details are set for this interview');
  const plain = decrypt(iv.credential);
  if (!plain) throw new HttpError(410, 'These login details have expired or were revoked');
  const webUrl = (process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
  await sendTemplatedMail({
    templateSlug: 'interview-credentials-candidate',
    to: iv.candidate.email,
    data: {
      candidateName: `${iv.candidate.firstName} ${iv.candidate.lastName}`.trim(),
      jobTitle: iv.job?.title || 'your interview',
      companyName: iv.job?.client?.companyName || 'Al Khadim',
      whenFormatted: iv.scheduledAt.toLocaleString('en-AE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Dubai' }),
      credentialsBlock: credentialsEmailBlock(iv.credential, plain),
      dashboardUrl: `${webUrl}/candidate/dashboard`,
    },
  });
  await prisma.interviewCredential.update({ where: { interviewId }, data: { emailedAt: new Date() } });
}
