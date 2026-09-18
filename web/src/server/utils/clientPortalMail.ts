// Ported from api/src/utils/clientPortalMail.js
import { sendTemplatedMail } from './templateRenderer';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
export const INVITE_EXPIRY_DAYS = 7;

export async function sendInviteEmail({ clientUser, inviteToken, companyName, invitedByName }: {
  clientUser: { email: string; name: string };
  inviteToken: string;
  companyName: string;
  invitedByName?: string | null;
}): Promise<void> {
  const link = `${WEB_URL}/company/accept-invite/${inviteToken}`;
  await sendTemplatedMail({
    templateSlug: 'client-portal-invite',
    to: clientUser.email,
    subjectOverride: `You've been invited to ${companyName}'s Al Khadim portal`,
    data: {
      recipientName: clientUser.name,
      invitedByName: invitedByName || 'Al Khadim',
      companyName,
      acceptLink: link,
      expiryDays: String(INVITE_EXPIRY_DAYS),
    },
  });
}
