import * as budgets from '@/server/controllers/budgets.controller';

export const dynamic = 'force-dynamic';

export const GET = budgets.list;
export const POST = budgets.create;
