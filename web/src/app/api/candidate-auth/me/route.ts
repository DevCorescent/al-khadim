import * as candidateAuth from '@/server/controllers/candidateAuth.controller';

export const dynamic = 'force-dynamic';

export const GET = candidateAuth.me;
export const PUT = candidateAuth.updateMe;
