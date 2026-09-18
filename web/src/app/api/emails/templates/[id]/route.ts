import * as templates from '@/server/controllers/emailTemplates.controller';

export const dynamic = 'force-dynamic';

export const GET = templates.get;
export const PUT = templates.update;
export const DELETE = templates.remove;
