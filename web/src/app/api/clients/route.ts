import * as clients from '@/server/controllers/clients.controller';

export const dynamic = 'force-dynamic';

export const GET = clients.list;
export const POST = clients.create;
