import * as attendance from '@/server/controllers/attendance.controller';

export const dynamic = 'force-dynamic';

export const GET = attendance.list;
export const POST = attendance.create;
