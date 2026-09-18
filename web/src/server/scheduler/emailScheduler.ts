// Ported from api/src/scheduler/emailScheduler.js
/**
 * Background email scheduler.
 *
 * Polls the scheduled_emails table for messages whose sendAt time has passed
 * and delivers them via the module-aware mailer. Failed sends are retried up
 * to 3 times before being marked FAILED. Runs in-process via setInterval so
 * no extra infrastructure is required.
 */
import { prisma } from '@/lib/prisma';
import { sendMail } from '../utils/mailer';

const POLL_MS = Number(process.env.EMAIL_POLL_MS) || 60_000;
const MAX_ATTEMPTS = 3;

// The timer lives on globalThis (not module scope) because Next dev re-evaluates
// modules on hot reload; a module-level `let timer` would reset and a second
// interval would start polling alongside the first.
const globalForScheduler = globalThis as unknown as {
  __emailSchedulerTimer?: ReturnType<typeof setInterval> | null;
};

export async function processDue(): Promise<number> {
  const now = new Date();
  const due = await prisma.scheduledEmail.findMany({
    where: { status: 'PENDING', sendAt: { lte: now } },
    orderBy: { sendAt: 'asc' },
    take: 25,
  });

  let processed = 0;
  for (const email of due) {
    // Claim the row before sending: the interval poller and a manual
    // /emails/run-scheduler call can overlap, and only the one whose
    // conditional update wins may deliver it (no double sends).
    const claim = await prisma.scheduledEmail.updateMany({
      where: { id: email.id, status: 'PENDING', attempts: email.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    processed++;
    const attempts = email.attempts + 1;
    try {
      await sendMail({
        module: email.module,
        to: email.to,
        cc: email.cc || undefined,
        bcc: email.bcc || undefined,
        subject: email.subject,
        html: email.html || undefined,
        text: email.text || undefined,
        // This row already tracks its own history — sendMail() must not
        // create a second log entry for it.
        scheduledEmailId: email.id,
      });
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: 'SENT', sentAt: new Date(), error: null },
      });
    } catch (err: any) {
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          error: String(err?.message || err).slice(0, 500),
        },
      });
    }
  }
  return processed;
}

export function startEmailScheduler(): void {
  if (globalForScheduler.__emailSchedulerTimer) return;
  const timer = setInterval(() => {
    processDue().catch((e) => console.error('[emailScheduler]', e.message));
  }, POLL_MS);
  if (timer.unref) timer.unref();
  globalForScheduler.__emailSchedulerTimer = timer;
  console.log(`[emailScheduler] started — polling every ${POLL_MS}ms`);
  // Kick once shortly after boot to flush anything already due.
  setTimeout(() => processDue().catch(() => {}), 5000);
}
