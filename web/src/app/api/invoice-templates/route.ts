import * as invoiceTemplates from '@/server/controllers/invoiceTemplates.controller';

export const dynamic = 'force-dynamic';

export const GET = invoiceTemplates.list;
export const POST = invoiceTemplates.create;
