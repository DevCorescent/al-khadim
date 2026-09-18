import * as clientAuth from '@/server/controllers/clientAuth.controller';

export const dynamic = 'force-dynamic';

export const GET = clientAuth.viewInvite;
export const POST = clientAuth.acceptInvite;
