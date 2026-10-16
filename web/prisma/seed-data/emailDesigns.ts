/**
 * Builder designs for the transactional emails, in the brand email theme.
 * Placeholders ending in Block / Html are pre-built HTML fragments supplied by
 * the code that sends the email, so they sit in Custom HTML blocks.
 */
import { newEmailBlock as b, type EmailDesign } from '../../src/lib/email/blocks';

const design = (preheader: string, blocks: ReturnType<typeof b>[]): EmailDesign => ({
  kind: 'ak-email', version: 1, settings: { preheader, showHeader: true, showFooter: true }, blocks,
});
const heading = (text: string) => b('heading', { text, level: 'h2', paddingTop: 0, paddingBottom: 12 });
const text = (t: string, extra: Record<string, any> = {}) => b('text', { text: t, paddingTop: 0, paddingBottom: 4, ...extra });
const raw = (html: string) => b('html', { html, paddingTop: 0, paddingBottom: 0 });
const button = (label: string, url: string, note = '') => b('button', { label, url, note, paddingTop: 12, paddingBottom: 12 });
const details = (title: string, rows: [string, string][]) => b('details', { title, rows: rows.map(([label, value]) => ({ label, value })), paddingTop: 8, paddingBottom: 12 });
const sign = (name: string) => b('signature', { closing: 'Kind regards,', name, title: 'Al Khadim LLC', paddingTop: 16, paddingBottom: 0 });
const ticks = (items: string[]) => b('list', { style: 'check', items: items.map(t => ({ text: t })), paddingTop: 4, paddingBottom: 8 });

export const EMAIL_DESIGNS: Record<string, EmailDesign> = {
  'otp-verification': design('Your Al Khadim verification code is {{code}}', [
    heading('Verify your email address'),
    text('Use the code below to continue. For your security it expires in **{{expiryMinutes}} minutes**.'),
    b('code', { label: 'Verification code', code: '{{code}}', note: 'Enter this code on the verification screen.', paddingTop: 8, paddingBottom: 12 }),
    b('callout', { tone: 'neutral', text: "Didn't request this? You can safely ignore this email — your account stays secure.", paddingTop: 4, paddingBottom: 4 }),
    sign('Al Khadim Team'),
  ]),
  'client-signup-review': design('We have received your business profile and our team is reviewing it.', [
    heading('Thanks for registering, {{contactPerson}}'),
    text("We've received the business profile for **{{companyName}}** on the Al Khadim recruitment platform. Here's what happens next:"),
    ticks([
      'Our team reviews every new company profile, usually within one business day',
      "You'll receive an email as soon as your account is approved",
      'Once approved, you can share requirements and review shortlisted candidates',
    ]),
    text('Questions in the meantime? Simply reply to this email.', { size: 'sm' }),
    sign('Al Khadim Recruitment'),
  ]),
  'admin-new-company-registration': design('{{companyName}} registered and is awaiting approval.', [
    heading('New company registration'),
    text('A new business profile has been created and is awaiting your approval.'),
    details('Company details', [['Company', '{{companyName}}'], ['Contact person', '{{contactPerson}}'], ['Email', '{{email}}']]),
    button('Review in admin panel', '{{appUrl}}/admin/crm/clients'),
  ]),
  'client-profile-approved': design('{{companyName}} is approved — your company dashboard is ready.', [
    heading('Your business profile is approved'),
    text('Hi {{contactPerson}},\n\nGood news — **{{companyName}}** is now approved on Al Khadim and your company dashboard is ready.'),
    ticks(['Share your hiring requirements', 'Review shortlisted candidate profiles', 'Invite colleagues to your company portal']),
    button('Go to your company portal', '{{appUrl}}/company/login'),
    sign('Al Khadim Recruitment'),
  ]),
  'client-profile-rejected': design('An update on the business profile for {{companyName}}.', [
    heading('Update on your business profile'),
    text('Hi {{contactPerson}},\n\nThank you for your interest in working with Al Khadim. We were unable to approve the business profile for **{{companyName}}** at this time.'),
    raw('<p>{{reasonBlock}}</p>'),
    text('If you have questions or would like to share more information, simply reply to this email and our team will be glad to help.'),
    sign('Al Khadim Recruitment'),
  ]),
  'admin-new-job-request': design('{{companyName}} submitted a job request: {{jobTitle}}.', [
    heading('New job request'),
    text('A client has submitted a new job request. It stays internal until you publish it.'),
    details('Request', [['Company', '{{companyName}}'], ['Role', '{{jobTitle}}']]),
    button('Review job requests', '{{appUrl}}/admin/jobs'),
  ]),
  'candidate-welcome': design('Your profile is approved. Your CV ID is {{cvId}}.', [
    heading('Welcome to Al Khadim, {{firstName}}'),
    text('Your profile has been approved. Please quote your CV ID in all correspondence with us.'),
    b('code', { label: 'Your CV ID', code: '{{cvId}}', paddingTop: 8, paddingBottom: 12 }),
    ticks(['Track your applications and interviews', 'Upload documents when they are requested', 'Get matched with roles across the UAE']),
    button('Sign in to your dashboard', '{{appUrl}}/candidate/login'),
    sign('Al Khadim Careers Team'),
  ]),
  'document-requested': design('Please upload: {{documentTitle}}', [
    heading('A document is needed'),
    text('Dear {{firstName}},\n\nTo continue with your application, please upload the following document:'),
    details('', [['Document', '{{documentTitle}}']]),
    raw('{{descriptionBlock}}'),
    button('Upload document', '{{dashboardUrl}}', 'Or open this link: {{dashboardUrl}}'),
    sign('Al Khadim HR'),
  ]),
  'document-uploaded-notify': design('{{candidateFullName}} uploaded {{documentTitle}}.', [
    heading('Document uploaded'),
    text('**{{candidateFullName}}** has uploaded a requested document. Please review and verify it.'),
    details('', [['Document', '{{documentTitle}}'], ['Candidate', '{{candidateFullName}}']]),
    button('Open documents', '{{appUrl}}/admin/documents'),
  ]),
  'profile-shared-client': design('A candidate profile has been shared with {{companyName}}.', [
    heading('A candidate profile for you'),
    text('Dear {{recipientName}},\n\nAl Khadim has shared a candidate profile with you{{jobTitleBlock}}.'),
    raw('{{messageBlock}}'),
    button('View candidate profile', '{{viewLink}}'),
    text('No login is needed to view this profile. If you have a company portal account, you will also find it under “Candidates” in your dashboard.', { size: 'sm', color: '#5F6B70' }),
    sign('Al Khadim Recruitment'),
  ]),
  'staff-share-notification': design('Profile share update', [
    heading('Profile share update'),
    raw('<p>{{messageHtml}}</p>'),
    button('Open profile shares', '{{shareUrl}}'),
  ]),
  'interview-scheduled-candidate': design('Your interview for {{jobTitle}} is on {{whenFormatted}}.', [
    heading('Your interview is scheduled'),
    text('Dear {{candidateName}},\n\nYour interview for **{{jobTitle}}** at **{{companyName}}** has been confirmed.'),
    details('Interview details', [['Date & time', '{{whenFormatted}}'], ['Mode', '{{modeLabel}}'], ['Role', '{{jobTitle}}'], ['Company', '{{companyName}}']]),
    raw('{{meetingOrLocationBlock}}{{notesBlock}}'),
    raw('{{credentialsBlock}}'),
    b('callout', { tone: 'brand', text: 'Please be ready a few minutes early and keep a copy of your CV and ID with you.', paddingTop: 8, paddingBottom: 8 }),
    raw('{{accountBlock}}'),
    sign('Al Khadim Recruitment'),
  ]),
  'interview-confirmed-client': design('Interview for {{jobTitle}} confirmed for {{whenFormatted}}.', [
    heading('Interview confirmed'),
    text('Dear {{recipientName}},\n\nThe interview for the **{{jobTitle}}** role has been scheduled.'),
    details('Interview details', [['Date & time', '{{whenFormatted}}'], ['Mode', '{{modeLabel}}'], ['Role', '{{jobTitle}}']]),
    raw('{{meetingOrLocationBlock}}{{notesBlock}}'),
    button('Open company portal', '{{portalUrl}}'),
    sign('Al Khadim Recruitment'),
  ]),
  'interview-invitation-interviewer': design('Interview: {{candidateName}} for {{jobTitle}}, {{whenFormatted}}.', [
    heading("You're invited to interview a candidate"),
    text("Hello,\n\nYou've been added as an interviewer for **{{candidateName}}**, shortlisted for **{{jobTitle}}** at **{{companyName}}**."),
    details('Interview details', [['Candidate', '{{candidateName}}'], ['Date & time', '{{whenFormatted}}'], ['Mode', '{{modeLabel}}'], ['Role', '{{jobTitle}}']]),
    raw('{{meetingOrLocationBlock}}{{notesBlock}}'),
    sign('Al Khadim Recruitment Team'),
  ]),
  'profile-share-reminder': design('A candidate profile is waiting for your review.', [
    heading('A candidate profile is waiting for you'),
    text('This is a friendly reminder about a candidate profile shared with **{{companyName}}**. We would value your feedback.'),
    button('View candidate profile', '{{viewLink}}'),
    sign('Al Khadim Recruitment'),
  ]),
  'client-portal-invite': design("{{invitedByName}} invited you to {{companyName}}'s portal.", [
    heading("You're invited to {{companyName}}'s portal"),
    text('Hi {{recipientName}},\n\n**{{invitedByName}}** has invited you to join the **{{companyName}}** company portal on Al Khadim, where you can review candidate profiles shared with your company.'),
    button('Accept invite & set your password', '{{acceptLink}}', 'This link expires in {{expiryDays}} days.'),
    sign('Al Khadim Recruitment'),
  ]),
  'interview-credentials-candidate': design('Your login details for the {{jobTitle}} interview.', [
    heading('Your interview login details'),
    text('Dear {{candidateName}},\n\nHere are the login details you need for your interview for **{{jobTitle}}** at **{{companyName}}** on **{{whenFormatted}}**.'),
    raw('{{credentialsBlock}}'),
    button('Open your candidate dashboard', '{{dashboardUrl}}'),
    b('callout', { tone: 'warning', text: 'Never share these details. Al Khadim will never ask you for your password by phone or message.', paddingTop: 8, paddingBottom: 8 }),
    sign('Al Khadim Recruitment'),
  ]),
};
