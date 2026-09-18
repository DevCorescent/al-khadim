/**
 * Direct DB access for the auth/portal tests: reading values the API never
 * returns (invite tokens) and removing rows that have no delete endpoint
 * (OTP codes, registrations, enquiries, logged emails). Everything is scoped
 * to this test process's TAG, so it never touches seed data or other runs.
 */
import 'dotenv/config';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { TAG } from './_client';

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function removeUpload(p?: string | null) {
  if (!p || !p.startsWith('uploads/')) return;
  await unlink(path.join(process.cwd(), p)).catch(() => {});
}

/** Deletes every row (and uploaded file) created by this test process, identified by TAG. */
export async function cleanupTagged(extraUploads: string[] = []) {
  const tagged = { contains: TAG };

  const candidates = await db.candidate.findMany({
    where: { email: tagged },
    select: { id: true, cvPath: true, photo: true, documentRequests: { select: { filePath: true } } },
  });
  const registrations = await db.candidateRegistration.findMany({
    where: { email: tagged }, select: { cvPath: true, photo: true },
  });
  const uploads = [
    ...extraUploads,
    ...candidates.flatMap((c) => [c.cvPath, c.photo, ...c.documentRequests.map((d) => d.filePath)]),
    ...registrations.flatMap((r) => [r.cvPath, r.photo]),
  ];

  const clients = await db.client.findMany({ where: { email: tagged }, select: { id: true } });
  const clientIds = clients.map((c) => c.id);
  await db.deal.deleteMany({ where: { OR: [{ clientId: { in: clientIds } }, { enquiry: { email: tagged } }] } });
  await db.clientEnquiry.deleteMany({ where: { email: tagged } });
  await db.clientUser.deleteMany({ where: { email: tagged, clientId: { notIn: clientIds } } });
  await db.client.deleteMany({ where: { id: { in: clientIds } } }); // cascades client users + activities

  await db.candidate.deleteMany({ where: { email: tagged } }); // cascades account, history, document requests
  await db.candidateRegistration.deleteMany({ where: { email: tagged } });
  await db.otpCode.deleteMany({ where: { email: tagged } });
  await db.scheduledEmail.deleteMany({ where: { to: tagged } });

  const users = await db.user.findMany({ where: { email: tagged }, select: { id: true } });
  if (users.length) {
    const ids = users.map((u) => u.id);
    await db.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
  await db.customRole.deleteMany({ where: { name: tagged } });

  await Promise.all(uploads.map(removeUpload));
}

/** Makes an OTP send→verify round trip (using the dev code) and returns the ticket. */
export async function otpTicket(
  api: (m: string, p: string, b?: unknown) => Promise<{ status: number; data: any }>,
  email: string,
  purpose: 'CANDIDATE_REGISTRATION' | 'COMPANY_REGISTRATION',
): Promise<string> {
  const sent = await api('POST', '/otp/send', { email, purpose });
  if (sent.status !== 200 || !sent.data.devCode) {
    throw new Error(`otp/send failed (${sent.status}): ${JSON.stringify(sent.data)} — is SMTP configured?`);
  }
  const verified = await api('POST', '/otp/verify', { email, purpose, code: sent.data.devCode });
  if (verified.status !== 200) throw new Error(`otp/verify failed: ${JSON.stringify(verified.data)}`);
  return verified.data.ticket;
}
