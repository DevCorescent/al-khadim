/**
 * Super-Admin-controlled recruitment rules (SiteConfig key "recruitment").
 * Read on every company response, so it is cached briefly and invalidated on save.
 */
import { prisma } from '@/lib/prisma';

export interface RecruitmentSettings {
  /** Once a company shortlists a candidate, it can no longer move them to "interview requested". */
  lockShortlisted: boolean;
}

export const RECRUITMENT_DEFAULTS: RecruitmentSettings = { lockShortlisted: true };

const CACHE_MS = 30_000;
let _cache: RecruitmentSettings | undefined;
let _cachedAt = 0;

export async function getRecruitmentSettings(): Promise<RecruitmentSettings> {
  if (_cache && Date.now() - _cachedAt < CACHE_MS) return _cache;
  const row = await prisma.siteConfig.findUnique({ where: { key: 'recruitment' } });
  _cache = { ...RECRUITMENT_DEFAULTS, ...((row?.value as any) || {}) };
  _cachedAt = Date.now();
  return _cache!;
}

export function invalidateRecruitmentSettings() {
  _cache = undefined;
  _cachedAt = 0;
}

/** Whether the company may still request an interview for a share in this status. */
export async function interviewLocked(status: string): Promise<boolean> {
  return status === 'SHORTLISTED' && (await getRecruitmentSettings()).lockShortlisted;
}
