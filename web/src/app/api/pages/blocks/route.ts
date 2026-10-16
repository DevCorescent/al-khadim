import * as pages from '@/server/controllers/pages.controller';

export const dynamic = 'force-dynamic';

export const GET = pages.listBlocks;
export const POST = pages.createBlock;
