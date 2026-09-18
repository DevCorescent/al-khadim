import * as bankAccounts from '@/server/controllers/bankAccounts.controller';

export const dynamic = 'force-dynamic';

export const GET = bankAccounts.get;
export const PUT = bankAccounts.update;
export const DELETE = bankAccounts.remove;
