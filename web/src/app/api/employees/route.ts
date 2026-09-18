import * as employees from '@/server/controllers/employees.controller';

export const dynamic = 'force-dynamic';

export const GET = employees.list;
export const POST = employees.create;
