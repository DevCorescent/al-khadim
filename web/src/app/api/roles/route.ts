import * as roles from '@/server/controllers/roles.controller';

export const dynamic = 'force-dynamic';

export const GET = roles.list;
export const POST = roles.create;
