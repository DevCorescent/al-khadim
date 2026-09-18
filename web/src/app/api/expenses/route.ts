import * as expenses from '@/server/controllers/expenses.controller';

export const dynamic = 'force-dynamic';

export const GET = expenses.list;
export const POST = expenses.create;
