import * as aiAssistant from '@/server/controllers/aiAssistant.controller';

export const dynamic = 'force-dynamic';

export const GET = aiAssistant.getConversation;
export const DELETE = aiAssistant.deleteConversation;
