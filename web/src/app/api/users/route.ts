import * as users from '@/server/controllers/users.controller';

export const dynamic = 'force-dynamic';

export const GET = users.list;
export const POST = users.create;
