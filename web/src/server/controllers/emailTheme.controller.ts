import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json } from '../http';
import { cleanEmailTheme } from '@/lib/email/theme';
import { EMAIL_THEME_KEY, emailAssetBase, getEmailTheme, invalidateEmailThemeCache } from '../utils/emailTheme';

/* GET /api/emails/theme — the brand theme plus the origin images are served from */
export const get = handler(async (req) => {
  await requirePermission(req, 'emails', 'view');
  return json({ theme: await getEmailTheme(), assetBase: emailAssetBase() });
});

/* PUT /api/emails/theme */
export const update = handler(async (req) => {
  const user = await requirePermission(req, 'emails', 'edit');
  const theme = cleanEmailTheme(await body(req));
  await prisma.siteConfig.upsert({
    where: { key: EMAIL_THEME_KEY },
    create: { key: EMAIL_THEME_KEY, value: theme as any, updatedBy: user?.id },
    update: { value: theme as any, updatedBy: user?.id },
  });
  invalidateEmailThemeCache();
  return json({ theme, assetBase: emailAssetBase() });
});
