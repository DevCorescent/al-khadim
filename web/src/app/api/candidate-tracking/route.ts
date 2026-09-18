import * as tracking from '@/server/controllers/candidateTracking.controller';

export const dynamic = 'force-dynamic';

export const GET = tracking.list;
export const POST = tracking.create;
