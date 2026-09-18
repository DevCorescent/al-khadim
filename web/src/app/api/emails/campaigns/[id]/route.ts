import * as campaigns from '@/server/controllers/emailCampaigns.controller';

export const dynamic = 'force-dynamic';

export const GET = campaigns.get;
export const PUT = campaigns.update;
export const DELETE = campaigns.remove;
