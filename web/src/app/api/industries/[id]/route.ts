import * as industries from '@/server/controllers/industries.controller';

export const dynamic = 'force-dynamic';

export const GET = industries.get;
export const PUT = industries.update;
export const DELETE = industries.remove;
