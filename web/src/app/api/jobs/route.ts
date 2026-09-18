import * as jobs from '@/server/controllers/jobs.controller';

export const dynamic = 'force-dynamic';

export const GET = jobs.list;
export const POST = jobs.create;
