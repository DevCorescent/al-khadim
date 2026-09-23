import * as jobs from '@/server/controllers/jobs.controller';

export const dynamic = 'force-dynamic';

export const PUT = jobs.updateMine;
export const DELETE = jobs.removeMine;
