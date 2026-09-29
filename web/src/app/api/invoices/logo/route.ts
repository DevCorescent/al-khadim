import * as invoices from '@/server/controllers/invoices.controller';

export const dynamic = 'force-dynamic';

export const GET = invoices.getLogo;
export const POST = invoices.uploadLogo;
export const PUT = invoices.setLogo;
