import * as activities from '@/server/controllers/activities.controller';

export const dynamic = 'force-dynamic';

export const GET = activities.list;
export const POST = activities.create;
