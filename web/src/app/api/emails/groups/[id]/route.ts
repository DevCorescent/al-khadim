import * as groups from '@/server/controllers/emailGroups.controller';

export const dynamic = 'force-dynamic';

export const GET = groups.get;
export const PUT = groups.update;
export const DELETE = groups.remove;
