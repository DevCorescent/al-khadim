import * as groups from '@/server/controllers/emailGroups.controller';

export const dynamic = 'force-dynamic';

export const GET = groups.list;
export const POST = groups.create;
