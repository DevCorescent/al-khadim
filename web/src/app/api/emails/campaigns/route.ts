import * as campaigns from '@/server/controllers/emailCampaigns.controller';

export const dynamic = 'force-dynamic';

export const GET = campaigns.list;
export const POST = campaigns.create;
