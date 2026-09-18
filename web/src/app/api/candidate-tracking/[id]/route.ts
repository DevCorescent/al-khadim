import * as tracking from '@/server/controllers/candidateTracking.controller';

export const dynamic = 'force-dynamic';

export const GET = tracking.get;
export const PUT = tracking.update;
export const DELETE = tracking.remove;
