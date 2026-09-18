import * as followUps from '@/server/controllers/followUps.controller';

export const dynamic = 'force-dynamic';

export const GET = followUps.list;
export const POST = followUps.create;
