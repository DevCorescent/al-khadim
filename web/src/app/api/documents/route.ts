import * as documents from '@/server/controllers/documents.controller';

export const dynamic = 'force-dynamic';

export const GET = documents.list;
export const POST = documents.create;
