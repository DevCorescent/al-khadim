import * as industries from '@/server/controllers/industries.controller';

export const dynamic = 'force-dynamic';

export const GET = industries.list;
export const POST = industries.create;
