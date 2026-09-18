import * as leave from '@/server/controllers/leave.controller';

export const dynamic = 'force-dynamic';

export const GET = leave.list;
export const POST = leave.create;
