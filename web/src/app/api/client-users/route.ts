import * as clientUsers from '@/server/controllers/clientUsers.controller';

export const dynamic = 'force-dynamic';

export const GET = clientUsers.list;
export const POST = clientUsers.create;
