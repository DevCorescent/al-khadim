import * as bankAccounts from '@/server/controllers/bankAccounts.controller';

export const dynamic = 'force-dynamic';

export const GET = bankAccounts.list;
export const POST = bankAccounts.create;
