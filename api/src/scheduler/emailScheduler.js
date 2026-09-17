/**
 * Background email scheduler.
 *
 * Polls the scheduled_emails table for messages whose sendAt time has passed
 * and delivers them via the module-aware mailer. Failed sends are retried up
 * to 3 times before being marked FAILED. Runs in-process via setInterval so
 * no extra infrastructure is required.
 */
const { PrismaClient } = require('@prisma/client');
const { sendMail } = require('../utils/mailer');

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.EMAIL_POLL_MS) || 60_000;
const MAX_ATTEMPTS = 3;
let timer = null;

async function processDue() {
  const now = new Date();
  const due = await prisma.scheduledEmail.findMany({
    where: { status: 'PENDING', sendAt: { lte: now } },
    orderBy: { sendAt: 'asc' },
    take: 25,
  });

  for (const email of due) {
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
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, error: null },
      });
    } catch (err) {
      const attempts = email.attempts + 1;
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          error: String(err.message || err).slice(0, 500),
        },
      });
    }
  }
  return due.length;
}

function startEmailScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    processDue().catch(e => console.error('[emailScheduler]', e.message));
  }, POLL_MS);
  if (timer.unref) timer.unref();
  console.log(`[emailScheduler] started — polling every ${POLL_MS}ms`);
  // Kick once shortly after boot to flush anything already due.
  setTimeout(() => processDue().catch(() => {}), 5000);
}

module.exports = { startEmailScheduler, processDue };
