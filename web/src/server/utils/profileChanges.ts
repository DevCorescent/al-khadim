/**
 * Candidate self-service profile edits are held as a CandidateProfileChange
 * until a Super Admin approves them (candidateAuth.updateMe stages them,
 * profileChanges.controller reviews them). Helpers shared by both sides.
 */
import { prisma } from '@/lib/prisma';
import { deleteUpload } from '../storage';
import { escapeHtml } from '../validate';
import { sendMail } from './mailer';

export type ChangeSet = Record<string, { old: any; new: any }>;

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/** Human labels, shared with the emails. Mirrors HISTORY_LABELS on the candidate profile page. */
export const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', phone: 'Phone',
  headline: 'Headline', summary: 'Summary', nationality: 'Nationality',
  currentLocation: 'Location', visaStatus: 'Visa status', experience: 'Experience',
  skills: 'Skills', languages: 'Languages', education: 'Education',
  linkedIn: 'LinkedIn', portfolio: 'Portfolio', introVideoUrl: 'Intro video',
  cvPath: 'CV', photo: 'Photo',
  currentSalary: 'Current salary', expectedSalary: 'Expected salary', currency: 'Currency',
};

/** Files uploaded with a change live on disk from submission; drop them if the change never applies. */
export async function discardStagedFiles(changes: ChangeSet) {
  for (const key of ['cvPath', 'photo']) {
    const staged = changes[key]?.new;
    if (typeof staged === 'string' && staged) {
      await deleteUpload(staged);
    }
  }
}

/** The candidate columns a change set writes. */
export function changeData(changes: ChangeSet): Record<string, any> {
  const data: Record<string, any> = {};
  for (const [field, { new: value }] of Object.entries(changes)) {
    if (field in FIELD_LABELS) data[field] = value;
  }
  return data;
}

function fieldList(changes: ChangeSet) {
  return Object.keys(changes).map((f) => FIELD_LABELS[f] || f).join(', ');
}

/** Tell the Super Admins a request is waiting. Fire-and-forget. */
export async function notifyAdminsOfRequest(candidate: { firstName: string; lastName: string; email: string }, changes: ChangeSet, reason: string) {
  const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { email: true } });
  if (!admins.length) return;
  const url = `${WEB_URL}/admin/profile-changes`;
  const name = `${candidate.firstName} ${candidate.lastName}`;
  await sendMail({
    module: 'candidates',
    to: admins.map((a) => a.email).join(','),
    subject: `Profile change awaiting approval: ${name}`,
    html: `<p>${escapeHtml(name)} (${escapeHtml(candidate.email)}) has requested changes to their profile.</p>
           <p><strong>Fields:</strong> ${escapeHtml(fieldList(changes))}<br/>
           <strong>Reason:</strong> ${escapeHtml(reason)}</p>
           <p><a href="${escapeHtml(url)}">Review it in the admin panel</a></p>`,
  });
}

/** Tell the candidate the outcome. Fire-and-forget. */
export async function notifyCandidateOfDecision(
  candidate: { firstName: string; email: string },
  changes: ChangeSet,
  approved: boolean,
  note?: string | null,
) {
  const url = `${WEB_URL}/candidate/profile`;
  const outcome = approved
    ? 'has been <strong>approved</strong> and your profile is now updated'
    : 'was <strong>not approved</strong>, so your profile has not changed';
  await sendMail({
    module: 'candidates',
    to: candidate.email,
    subject: approved ? 'Your profile changes were approved' : 'Your profile changes were not approved',
    html: `<p>Dear ${escapeHtml(candidate.firstName)},</p>
           <p>Your request to update ${escapeHtml(fieldList(changes))} ${outcome}.</p>
           ${note ? `<p><strong>Note from Al Khadim:</strong> ${escapeHtml(note)}</p>` : ''}
           <p><a href="${escapeHtml(url)}">View your profile</a></p>
           <p>Regards,<br/>Al Khadim Careers Team</p>`,
  });
}
