import * as clientDocuments from '@/server/controllers/clientDocuments.controller';

export const dynamic = 'force-dynamic';

export const GET = clientDocuments.list;
export const POST = clientDocuments.create;
