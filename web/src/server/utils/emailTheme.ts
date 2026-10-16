import { prisma } from '@/lib/prisma';
import { normalizeEmailTheme, type EmailTheme } from '@/lib/email/theme';

export const EMAIL_THEME_KEY = 'emailTheme';
const CACHE_MS = 30_000;
let cache: { theme: EmailTheme; at: number } | null = null;

/** The brand theme emails are rendered with (SiteConfig "emailTheme"), cached briefly. */
export async function getEmailTheme(): Promise<EmailTheme> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.theme;
  let raw: any = null;
  try {
    raw = (await prisma.siteConfig.findUnique({ where: { key: EMAIL_THEME_KEY } }))?.value;
  } catch (err: any) {
    console.error('[emailTheme] could not load, using defaults:', err.message);
  }
  const theme = normalizeEmailTheme(raw);
  cache = { theme, at: Date.now() };
  return theme;
}

export function invalidateEmailThemeCache() {
  cache = null;
}

/** Origin for absolute image URLs in emails (logo, uploads). */
export function emailAssetBase() {
  return (process.env.WEB_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
