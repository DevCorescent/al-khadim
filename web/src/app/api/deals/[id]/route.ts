import * as deals from '@/server/controllers/deals.controller';

export const dynamic = 'force-dynamic';

export const GET = deals.get;
export const PUT = deals.update;
export const DELETE = deals.remove;
