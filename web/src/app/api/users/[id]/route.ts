import * as users from '@/server/controllers/users.controller';

export const dynamic = 'force-dynamic';

export const GET = users.get;
export const PUT = users.update;
export const DELETE = users.remove;
