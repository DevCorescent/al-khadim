import * as jobs from '@/server/controllers/jobs.controller';

export const dynamic = 'force-dynamic';

export const GET = jobs.listMine;
export const POST = jobs.createMine;
