import * as interviews from '@/server/controllers/interviews.controller';

export const dynamic = 'force-dynamic';

export const GET = interviews.list;
export const POST = interviews.create;
