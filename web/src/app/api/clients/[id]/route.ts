import * as clients from '@/server/controllers/clients.controller';

export const dynamic = 'force-dynamic';

export const GET = clients.get;
export const PUT = clients.update;
export const DELETE = clients.remove;
