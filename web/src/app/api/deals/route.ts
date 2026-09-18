import * as deals from '@/server/controllers/deals.controller';

export const dynamic = 'force-dynamic';

export const GET = deals.list;
export const POST = deals.create;
