import * as emails from '@/server/controllers/emails.controller';

export const dynamic = 'force-dynamic';

export const GET = emails.getSettings;
export const PUT = emails.saveSettings;
