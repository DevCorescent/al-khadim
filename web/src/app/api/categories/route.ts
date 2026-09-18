import * as categories from '@/server/controllers/categories.controller';

export const dynamic = 'force-dynamic';

export const GET = categories.list;
export const POST = categories.create;
