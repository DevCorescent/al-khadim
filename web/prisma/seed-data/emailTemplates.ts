// The 16 transactional email templates rendered by the platform's mailers.
// Copied from api/scripts/seedEmailTemplates.js — keep the two in sync.
import type { Prisma } from '../../src/generated/prisma/client';

export const EMAIL_TEMPLATES: Prisma.EmailTemplateCreateInput[] = [
  {
    slug: 'otp-verification',
    name: 'OTP Verification Code',
    category: 'TRANSACTIONAL',
    module: 'otp',
    subject: 'Your Al Khadim verification code',
    html: `<p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">{{code}}</p>
      <p>This code expires in {{expiryMinutes}} minutes. If you didn't request this, you can ignore this email.</p>`,
    mergeTags: [
      { key: 'code', label: 'Verification code', sample: '482913' },
      { key: 'expiryMinutes', label: 'Expiry (minutes)', sample: '10' },
    ],
  },
  {
    slug: 'client-signup-review',
    name: 'Company Signup — Under Review',
    category: 'TRANSACTIONAL',
    module: 'clientAuth',
    subject: 'Your Al Khadim business profile is under review',
    html: `<p>Hi {{contactPerson}},</p><p>Thanks for creating a business profile for <strong>{{companyName}}</strong> on the Al Khadim recruitment platform. Our team will review your account shortly — you'll be notified once it's approved.</p>`,
    mergeTags: [
      { key: 'contactPerson', label: 'Contact person', sample: 'Sarah Ahmed' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
    ],
  },
  {
    slug: 'admin-new-company-registration',
    name: 'Admin Notify — New Company Registration',
    category: 'TRANSACTIONAL',
    module: 'clients',
    subject: 'New company registration pending approval: {{companyName}}',
    html: `<p>{{companyName}} ({{contactPerson}}, {{email}}) just created a business profile and is awaiting approval.</p>`,
    mergeTags: [
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'contactPerson', label: 'Contact person', sample: 'Sarah Ahmed' },
      { key: 'email', label: 'Contact email', sample: 'sarah@acme.ae' },
    ],
  },
  {
    slug: 'client-profile-approved',
    name: 'Company Profile Approved',
    category: 'TRANSACTIONAL',
    module: 'clients',
    subject: 'Your Al Khadim business profile has been approved',
    html: `<p>Hi {{contactPerson}},</p><p>Good news — <strong>{{companyName}}</strong>'s business profile has been approved. You can now log in and access your full company dashboard.</p>`,
    mergeTags: [
      { key: 'contactPerson', label: 'Contact person', sample: 'Sarah Ahmed' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
    ],
  },
  {
    slug: 'client-profile-rejected',
    name: 'Company Profile Rejected',
    category: 'TRANSACTIONAL',
    module: 'clients',
    subject: 'Update on your Al Khadim business profile',
    html: `<p>Hi {{contactPerson}},</p><p>We were unable to approve <strong>{{companyName}}</strong>'s business profile at this time.{{reasonBlock}} Please contact Al Khadim for more information.</p>`,
    mergeTags: [
      { key: 'contactPerson', label: 'Contact person', sample: 'Sarah Ahmed' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'reasonBlock', label: 'Rejection reason (HTML fragment, may be blank)', sample: ' Reason: incomplete documentation.' },
    ],
  },
  {
    slug: 'admin-new-job-request',
    name: 'Admin Notify — New Job Request',
    category: 'TRANSACTIONAL',
    module: 'jobs',
    subject: 'New job request from {{companyName}}: {{jobTitle}}',
    html: `<p><strong>{{companyName}}</strong> submitted a new job request — "{{jobTitle}}". It's internal-only until you publish it.</p>`,
    mergeTags: [
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'jobTitle', label: 'Job title', sample: 'Senior Accountant' },
    ],
  },
  {
    slug: 'candidate-welcome',
    name: 'Candidate Welcome (CV ID)',
    category: 'TRANSACTIONAL',
    module: 'candidates',
    subject: 'Welcome to Al Khadim — your CV ID is {{cvId}}',
    html: `<p>Dear {{firstName}},</p>
             <p>Your profile has been approved. Your unique CV ID is
             <strong>{{cvId}}</strong> — please quote it in any correspondence with us.</p>
             <p>You can now sign in to the candidate portal to track your applications.</p>
             <p>Regards,<br/>Al Khadim Careers Team</p>`,
    mergeTags: [
      { key: 'firstName', label: 'First name', sample: 'Ahmed' },
      { key: 'cvId', label: 'CV ID', sample: 'AK-CV-00123' },
    ],
  },
  {
    slug: 'document-requested',
    name: 'Document Requested From Candidate',
    category: 'TRANSACTIONAL',
    module: 'documents',
    subject: 'Document requested: {{documentTitle}}',
    html: `<p>Dear {{firstName}},</p>
          <p>Al Khadim has requested a document from you: <strong>{{documentTitle}}</strong>.</p>
          {{descriptionBlock}}
          <p>Please log in to your candidate dashboard to upload it:</p>
          <p><a href="{{dashboardUrl}}">{{dashboardUrl}}</a></p>`,
    mergeTags: [
      { key: 'firstName', label: 'First name', sample: 'Ahmed' },
      { key: 'documentTitle', label: 'Document title', sample: 'Passport copy' },
      { key: 'descriptionBlock', label: 'Description (HTML fragment, may be blank)', sample: '<p>Please upload a clear scan of all pages.</p>' },
      { key: 'dashboardUrl', label: 'Candidate dashboard URL', sample: 'https://alkhadim.ae/candidate/dashboard' },
    ],
  },
  {
    slug: 'document-uploaded-notify',
    name: 'Document Uploaded — Notify Requester',
    category: 'TRANSACTIONAL',
    module: 'documents',
    subject: 'Document uploaded: {{documentTitle}}',
    html: `<p>{{candidateFullName}} uploaded the requested document "<strong>{{documentTitle}}</strong>". Please review and verify it.</p>`,
    mergeTags: [
      { key: 'candidateFullName', label: 'Candidate full name', sample: 'Ahmed Khan' },
      { key: 'documentTitle', label: 'Document title', sample: 'Passport copy' },
    ],
  },
  {
    slug: 'profile-shared-client',
    name: 'Candidate Profile Shared With Client',
    category: 'TRANSACTIONAL',
    module: 'profileShares',
    subject: 'Candidate profile shared with {{companyName}}',
    html: `<p>Dear {{recipientName}},</p>
            <p>Al Khadim has shared a candidate profile with you{{jobTitleBlock}}.</p>
            {{messageBlock}}
            <p><a href="{{viewLink}}">View the candidate profile</a></p>
            <p>No login is required to view this profile. If you already have a company portal account, you can also find it under "Candidates" in your dashboard.</p>`,
    mergeTags: [
      { key: 'recipientName', label: 'Recipient name', sample: 'Sarah Ahmed' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'jobTitleBlock', label: 'Job title (HTML fragment, may be blank)', sample: ' for the role of <strong>Senior Accountant</strong>' },
      { key: 'messageBlock', label: 'Personal message (HTML fragment, may be blank)', sample: '<p>Let us know your thoughts.</p>' },
      { key: 'viewLink', label: 'View profile link', sample: 'https://alkhadim.ae/company/view/abc123' },
    ],
  },
  {
    slug: 'staff-share-notification',
    name: 'Staff Notify — Profile Share Event',
    category: 'TRANSACTIONAL',
    module: 'profileShares',
    subject: 'Profile Share Update',
    html: `<p>{{messageHtml}}</p><p>View it in the admin panel: <a href="{{shareUrl}}">Profile Shares</a></p>`,
    mergeTags: [
      { key: 'messageHtml', label: 'Event message', sample: 'Acme Trading LLC shortlisted Ahmed Khan.' },
      { key: 'shareUrl', label: 'Admin profile-share URL', sample: 'https://alkhadim.ae/admin/profile-shares/abc123' },
    ],
  },
  {
    slug: 'interview-scheduled-candidate',
    name: 'Interview Scheduled — Candidate',
    category: 'TRANSACTIONAL',
    module: 'interviews',
    subject: 'Interview Scheduled — {{jobTitle}} at {{companyName}}',
    html: `<p>Dear {{candidateName}},</p>
          <p>Your interview for <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong> has been scheduled.</p>
          <p><strong>Date &amp; time:</strong> {{whenFormatted}}</p>
          <p><strong>Mode:</strong> {{modeLabel}}</p>
          {{meetingOrLocationBlock}}
          {{notesBlock}}
          {{accountBlock}}`,
    mergeTags: [
      { key: 'candidateName', label: 'Candidate name', sample: 'Ahmed Khan' },
      { key: 'jobTitle', label: 'Job title', sample: 'Senior Accountant' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'whenFormatted', label: 'Date & time', sample: 'Sunday, 12 October 2026 at 3:00 PM' },
      { key: 'modeLabel', label: 'Mode', sample: 'Online' },
      { key: 'meetingOrLocationBlock', label: 'Meeting link or location (HTML fragment)', sample: '<p><strong>Meeting link:</strong> <a href="#">Join</a></p>' },
      { key: 'notesBlock', label: 'Notes (HTML fragment, may be blank)', sample: '<p><strong>Notes:</strong> Bring a copy of your CV.</p>' },
      { key: 'accountBlock', label: 'Portal account / credentials block (HTML fragment)', sample: '<p>You can view this anytime in your candidate dashboard.</p>' },
    ],
  },
  {
    slug: 'interview-confirmed-client',
    name: 'Interview Confirmed — Client',
    category: 'TRANSACTIONAL',
    module: 'profileShares',
    subject: 'Interview Confirmed — {{jobTitle}}',
    html: `<p>Dear {{recipientName}},</p>
          <p>The interview for the <strong>{{jobTitle}}</strong> role has been scheduled.</p>
          <p><strong>Date &amp; time:</strong> {{whenFormatted}}</p>
          <p><strong>Mode:</strong> {{modeLabel}}</p>
          {{meetingOrLocationBlock}}
          {{notesBlock}}
          <p>Full details are also available in your <a href="{{portalUrl}}">company portal</a>.</p>`,
    mergeTags: [
      { key: 'recipientName', label: 'Recipient name', sample: 'Sarah Ahmed' },
      { key: 'jobTitle', label: 'Job title', sample: 'Senior Accountant' },
      { key: 'whenFormatted', label: 'Date & time', sample: 'Sunday, 12 October 2026 at 3:00 PM' },
      { key: 'modeLabel', label: 'Mode', sample: 'Online' },
      { key: 'meetingOrLocationBlock', label: 'Meeting link or location (HTML fragment)', sample: '<p><strong>Meeting link:</strong> <a href="#">Join</a></p>' },
      { key: 'notesBlock', label: 'Notes (HTML fragment, may be blank)', sample: '' },
      { key: 'portalUrl', label: 'Company portal URL', sample: 'https://alkhadim.ae/company/candidates/abc123' },
    ],
  },
  {
    slug: 'interview-invitation-interviewer',
    name: 'Interview Invitation — Interviewer',
    category: 'TRANSACTIONAL',
    module: 'interviews',
    subject: 'Interview Invitation — {{candidateName}} for {{jobTitle}} at {{companyName}}',
    html: `<p>Hello,</p>
          <p>You've been added as an interviewer for <strong>{{candidateName}}</strong>, shortlisted for
          <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
          <p><strong>Date &amp; time:</strong> {{whenFormatted}}</p>
          <p><strong>Mode:</strong> {{modeLabel}}</p>
          {{meetingOrLocationBlock}}
          {{notesBlock}}
          <p>Regards,<br/>Al Khadim Recruitment Team</p>`,
    mergeTags: [
      { key: 'candidateName', label: 'Candidate name', sample: 'Ahmed Khan' },
      { key: 'jobTitle', label: 'Job title', sample: 'Senior Accountant' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'whenFormatted', label: 'Date & time', sample: 'Sunday, 12 October 2026 at 3:00 PM' },
      { key: 'modeLabel', label: 'Mode', sample: 'Online' },
      { key: 'meetingOrLocationBlock', label: 'Meeting link or location (HTML fragment)', sample: '<p><strong>Meeting link:</strong> <a href="#">Join</a></p>' },
      { key: 'notesBlock', label: 'Notes (HTML fragment, may be blank)', sample: '' },
    ],
  },
  {
    slug: 'profile-share-reminder',
    name: 'Reminder — Profile Share Resend',
    category: 'TRANSACTIONAL',
    module: 'profileShares',
    subject: 'Reminder: candidate profile shared with {{companyName}}{{jobTitleBlock}}',
    html: `<p>This is a reminder of a candidate profile shared with you.</p><p><a href="{{viewLink}}">View the candidate profile</a></p>`,
    mergeTags: [
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'jobTitleBlock', label: 'Job title suffix (plain text, may be blank)', sample: ' — Senior Accountant' },
      { key: 'viewLink', label: 'View profile link', sample: 'https://alkhadim.ae/company/view/abc123' },
    ],
  },
  {
    slug: 'client-portal-invite',
    name: 'Client Portal Invite',
    category: 'TRANSACTIONAL',
    module: 'clientAuth',
    subject: "You've been invited to {{companyName}}'s Al Khadim portal",
    html: `<p>Hi {{recipientName}},</p>
      <p>{{invitedByName}} has invited you to join the <strong>{{companyName}}</strong> company portal on the Al Khadim recruitment platform, where you can review candidate profiles shared with your company.</p>
      <p><a href="{{acceptLink}}">Accept invite &amp; set your password</a></p>
      <p>This link expires in {{expiryDays}} days.</p>`,
    mergeTags: [
      { key: 'recipientName', label: 'Recipient name', sample: 'Sarah Ahmed' },
      { key: 'invitedByName', label: 'Invited by', sample: 'Al Khadim' },
      { key: 'companyName', label: 'Company name', sample: 'Acme Trading LLC' },
      { key: 'acceptLink', label: 'Accept invite link', sample: 'https://alkhadim.ae/company/accept-invite/abc123' },
      { key: 'expiryDays', label: 'Expiry (days)', sample: '7' },
    ],
  },
];
