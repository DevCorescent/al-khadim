import * as siteConfig from '@/server/controllers/siteConfig.controller';

export const dynamic = 'force-dynamic';

export const GET = siteConfig.getSection;
export const PUT = siteConfig.updateSection;
