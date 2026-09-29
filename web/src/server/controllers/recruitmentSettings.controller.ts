/** Recruitment rules toggled by the Super Admin (see utils/recruitmentSettings). */
import { prisma } from '@/lib/prisma';
import { requireStaff } from '../auth';
import { body, handler, json } from '../http';
import { getRecruitmentSettings, invalidateRecruitmentSettings } from '../utils/recruitmentSettings';

export const get = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  return json(await getRecruitmentSettings());
});

export const update = handler(async (req) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  const { lockShortlisted } = (await body(req)) || {};
  if (typeof lockShortlisted !== 'boolean') return json({ error: 'lockShortlisted must be true or false' }, 400);
  const value = { ...(await getRecruitmentSettings()), lockShortlisted };
  await prisma.siteConfig.upsert({
    where: { key: 'recruitment' },
    create: { key: 'recruitment', value, updatedBy: user.id },
    update: { value, updatedBy: user.id },
  });
  invalidateRecruitmentSettings();
  return json(value);
});
