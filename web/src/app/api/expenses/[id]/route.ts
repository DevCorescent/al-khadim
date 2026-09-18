import * as expenses from '@/server/controllers/expenses.controller';

export const dynamic = 'force-dynamic';

export const GET = expenses.get;
export const PUT = expenses.update;
export const DELETE = expenses.remove;
