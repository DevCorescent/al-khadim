import * as jobs from '@/server/controllers/jobs.controller';

export const dynamic = 'force-dynamic';

export const GET = jobs.get;
export const PUT = jobs.update;
export const DELETE = jobs.remove;
