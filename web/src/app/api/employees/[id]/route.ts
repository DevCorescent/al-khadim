import * as employees from '@/server/controllers/employees.controller';

export const dynamic = 'force-dynamic';

export const GET = employees.get;
export const PUT = employees.update;
export const DELETE = employees.remove;
