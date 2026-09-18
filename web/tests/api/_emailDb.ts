/**
 * Direct DB access for the email/AI tests — only for cleanup and for rows the
 * API can't delete (sent/cancelled campaigns, history rows, public chats,
 * a SiteConfig row that didn't exist before the test). Call `disconnectDb()`
 * in an `after` hook so the test process can exit.
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';

export { prisma };

export async function disconnectDb() {
  await prisma.$disconnect();
}

/** Deletes campaigns (and their fanned-out ScheduledEmail rows) by id. */
export async function deleteCampaigns(ids: string[]) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  await prisma.scheduledEmail.deleteMany({ where: { campaignId: { in: list } } });
  await prisma.emailCampaign.deleteMany({ where: { id: { in: list } } });
}

/** Deletes send-history rows addressed to any test address containing `tag`. */
export async function deleteHistoryFor(tag: string) {
  await prisma.scheduledEmail.deleteMany({ where: { to: { contains: tag } } });
}

/** Reads a SiteConfig row's raw value (null when missing). */
export async function siteConfig(key: string) {
  return prisma.siteConfig.findUnique({ where: { key } });
}
