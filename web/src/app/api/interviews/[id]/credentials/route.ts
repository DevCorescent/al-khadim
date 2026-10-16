import * as credentials from '@/server/controllers/interviewCredentials.controller';

export const dynamic = 'force-dynamic';

export const GET = credentials.get;
export const PUT = credentials.put;
export const DELETE = credentials.revoke;
