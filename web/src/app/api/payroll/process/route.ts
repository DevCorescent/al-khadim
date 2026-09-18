import * as payroll from '@/server/controllers/payroll.controller';

export const dynamic = 'force-dynamic';

export const POST = payroll.processPayroll;
