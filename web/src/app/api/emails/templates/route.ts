import * as templates from '@/server/controllers/emailTemplates.controller';

export const dynamic = 'force-dynamic';

export const GET = templates.list;
export const POST = templates.create;
