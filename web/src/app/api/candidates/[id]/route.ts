import * as candidates from '@/server/controllers/candidates.controller';

export const dynamic = 'force-dynamic';

export const GET = candidates.get;
export const PUT = candidates.update;
export const DELETE = candidates.remove;
