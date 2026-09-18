import * as roles from '@/server/controllers/roles.controller';

export const dynamic = 'force-dynamic';

export const PUT = roles.update;
export const DELETE = roles.remove;
