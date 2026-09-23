// Ported from api/src/routes/registrations.js
import crypto from 'crypto';
import { unlink } from 'fs/promises';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { HttpError, body, handler, json, query } from '../http';
import { absoluteUploadPath, parseUpload } from '../upload';
import { generateCvId } from '../utils/cvId';
import { sendMail } from '../utils/mailer';
import { sendTemplatedMail } from '../utils/templateRenderer';
import { escapeHtml, pickFields } from '../validate';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/** Fields the public "Apply for a Job" form (src/app/register/page.tsx) submits. */
const PUBLIC_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'nationality', 'experience', 'skills'] as const;

/** Fields staff may edit on a registration (never password, convertedTo, parsedData, file paths). */
const ADMIN_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'nationality', 'experience', 'skills', 'education',
  'headline', 'summary', 'linkedIn', 'currentLocation', 'languages', 'status', 'notes',
] as const;

/** Statuses settable via PUT; APPROVED only through /approve (which creates the portal account). */
const EDITABLE_STATUSES = ['NEW', 'REJECTED'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Coerces picked form/JSON values to strings (repeated form fields are comma-joined). */
function stringify(data: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === null ? null : Array.isArray(v) ? v.map(String).join(', ') : String(v).trim();
  }
  return out;
}

/* Public endpoint – parse CV and register */
export const registerPublic = handler(async (req) => {
  const { body: fields, file } = await parseUpload(req, ['cv']);
  const data: any = stringify(pickFields(fields, PUBLIC_FIELDS));
  if (!data.firstName || !data.lastName || !data.email || !data.phone) {
    return json({ error: 'First name, last name, email and phone are required' }, 400);
  }
  if (!EMAIL_RE.test(data.email)) return json({ error: 'Please enter a valid email address' }, 400);
  data.email = data.email.toLowerCase();
  if (file) data.cvPath = file.path;
  try {
    const reg = await prisma.candidateRegistration.create({ data });
    return json({ message: 'Registration submitted successfully', id: reg.id }, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'An application with this email already exists.' }, 409);
    return json({ error: err.message }, 400);
  }
});

/* List all registrations (admin) */
export const list = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const { status } = query(req);
  const where: any = {};
  if (status) where.status = String(status);
  const registrations = await prisma.candidateRegistration.findMany({
    where, orderBy: { createdAt: 'desc' },
    omit: { password: true }, // never expose the candidate's password hash
  });
  return json(registrations);
});

/* Update a registration (admin) */
export const update = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'edit');
  const data: any = stringify(pickFields(await body(req), ADMIN_FIELDS));
  for (const k of ['firstName', 'lastName', 'email', 'phone', 'status']) {
    if (k in data && !data[k]) return json({ error: `${k} cannot be empty` }, 400);
  }
  if (data.email && !EMAIL_RE.test(data.email)) return json({ error: 'Please enter a valid email address' }, 400);
  if (data.status && !EDITABLE_STATUSES.includes(data.status)) {
    return json({ error: `status must be one of ${EDITABLE_STATUSES.join(', ')} (use /approve to approve)` }, 400);
  }
  const existing = await prisma.candidateRegistration.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return json({ error: 'Registration not found' }, 404);
  try {
    const reg = await prisma.candidateRegistration.update({
      where: { id: params.id }, data, omit: { password: true },
    });
    return json(reg);
  } catch (err: any) {
    if (err.code === 'P2002') return json({ error: 'An application with this email already exists.' }, 409);
    throw err;
  }
});

/** Random temporary password: letters/digits plus the classes common password rules ask for. */
function temporaryPassword() {
  return `Ak-${crypto.randomBytes(9).toString('base64url')}9`;
}

/**
 * Approve – creates Candidate + CandidateAccount, marks registration APPROVED.
 * Shared by /approve and the legacy /convert route.
 */
async function approveRegistration(id: string, isPublicRaw: any) {
  const reg = await prisma.candidateRegistration.findUnique({ where: { id } });
  if (!reg) throw new HttpError(404, 'Registration not found');
  if (reg.status === 'APPROVED') throw new HttpError(409, 'Already approved');
  if (isPublicRaw !== undefined && isPublicRaw !== null && typeof isPublicRaw !== 'boolean' && isPublicRaw !== 'true' && isPublicRaw !== 'false') {
    throw new HttpError(400, 'isPublic must be true or false');
  }
  const isPublic = isPublicRaw === undefined || isPublicRaw === null ? true : isPublicRaw === true || isPublicRaw === 'true';

  // Check if candidate with email already exists
  let candidate = await prisma.candidate.findUnique({ where: { email: reg.email } });

  if (!candidate) {
    const skillsArr = reg.skills ? reg.skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const langsArr  = reg.languages ? reg.languages.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const experience = reg.experience ? parseInt(reg.experience, 10) : NaN;

    candidate = await prisma.candidate.create({
      data: {
        cvId:            await generateCvId(prisma),
        firstName:       reg.firstName,
        lastName:        reg.lastName,
        email:           reg.email,
        phone:           reg.phone,
        nationality:     reg.nationality,
        currentLocation: reg.currentLocation,
        skills:          skillsArr,
        languages:       langsArr,
        education:       reg.education,
        headline:        reg.headline,
        summary:         reg.summary,
        linkedIn:        reg.linkedIn,
        experience:      Number.isFinite(experience) ? experience : null,
        cvPath:          reg.cvPath,
        photo:           reg.photo,
        source:          'WEBSITE',
        isPublic,
        status:          'NEW',
      },
    });
  }

  // Create account if not already exists. Registrations from the public form have no
  // password: those get a random temporary one, emailed to the candidate (and returned
  // to staff) instead of the old shared hard-coded default.
  let tempPassword: string | null = null;
  const existingAccount = await prisma.candidateAccount.findUnique({ where: { candidateId: candidate.id } });
  if (!existingAccount) {
    let passwordHash = reg.password;
    if (!passwordHash) {
      tempPassword = temporaryPassword();
      passwordHash = await bcrypt.hash(tempPassword, 12);
    }
    await prisma.candidateAccount.create({
      data: { candidateId: candidate.id, password: passwordHash, isActive: true },
    });
  } else {
    await prisma.candidateAccount.update({ where: { candidateId: candidate.id }, data: { isActive: true } });
  }

  await prisma.candidateRegistration.update({
    where: { id: reg.id },
    data: { status: 'APPROVED', convertedTo: candidate.id },
  });

  // Welcome email from the Careers identity (fire-and-forget — never blocks approval)
  sendTemplatedMail({
    templateSlug: 'candidate-welcome',
    to: candidate.email,
    data: { firstName: candidate.firstName, cvId: candidate.cvId },
  }).catch((e: any) => console.error('[registrations] welcome email failed:', e.message));

  if (tempPassword) {
    const loginUrl = `${WEB_URL}/candidate/login`;
    sendMail({
      module: 'candidates',
      to: candidate.email,
      subject: 'Your Al Khadim candidate portal login',
      html: `<p>Dear ${escapeHtml(candidate.firstName)},</p>
             <p>Your candidate portal account is ready. Sign in at
             <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> with:</p>
             <p>Email: <strong>${escapeHtml(candidate.email)}</strong><br/>
             Temporary password: <strong>${escapeHtml(tempPassword)}</strong></p>
             <p>Please change this password from your profile page after signing in.</p>
             <p>Regards,<br/>Al Khadim Careers Team</p>`,
    }).catch((e: any) => console.error('[registrations] login details email failed:', e.message));
  }

  return {
    message: 'Candidate approved and portal account created.',
    candidateId: candidate.id,
    ...(tempPassword && { temporaryPassword: tempPassword }),
  };
}

export const approve = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'create');
  const b = await body(req);
  return json(await approveRegistration(params.id, b.isPublic));
});

/* Reject */
export const reject = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'edit');
  const b = await body(req);
  const existing = await prisma.candidateRegistration.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return json({ error: 'Registration not found' }, 404);
  await prisma.candidateRegistration.update({
    where: { id: params.id },
    data: { status: 'REJECTED', notes: b.reason ? String(b.reason) : null },
  });
  return json({ message: 'Registration rejected' });
});

/* Legacy convert route — same action and response as /approve. (The Express original
 * redirected to a root-relative "/<id>/approve", which never reached the API.) */
export const convert = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'create');
  const b = await body(req);
  return json(await approveRegistration(params.id, b.isPublic));
});

/**
 * Delete a registration outright (spam, duplicates, withdrawn applications).
 * Approve/reject only change `status`, so without this the row is permanent.
 *
 * An approved registration is kept by default: it is the audit record of how a
 * live candidate entered the system, and `convertedTo` points at them. Pass
 * `?force=1` to delete it anyway, which leaves the candidate untouched.
 *
 * Uploaded files are removed only when nothing else references them — approval
 * copies `cvPath`/`photo` onto the Candidate rather than duplicating the file,
 * so unlinking blindly would blank a live candidate's CV.
 */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'delete');

  const reg = await prisma.candidateRegistration.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, status: true, convertedTo: true, cvPath: true, photo: true },
  });
  if (!reg) return json({ error: 'Registration not found' }, 404);

  const force = ['1', 'true'].includes(String(query(req).force ?? ''));
  if (reg.status === 'APPROVED' && !force) {
    return json(
      {
        error:
          'This registration has been approved and is the audit record for a live candidate. ' +
          'Delete the candidate instead, or repeat with ?force=1 to remove only this record.',
        candidateId: reg.convertedTo,
      },
      409,
    );
  }

  const candidates = reg.cvPath || reg.photo
    ? await prisma.candidate.findMany({
        where: {
          OR: [
            ...(reg.cvPath ? [{ cvPath: reg.cvPath }] : []),
            ...(reg.photo ? [{ photo: reg.photo }] : []),
          ],
        },
        select: { cvPath: true, photo: true },
      })
    : [];
  const stillUsed = new Set(candidates.flatMap((c) => [c.cvPath, c.photo]).filter(Boolean) as string[]);

  await prisma.candidateRegistration.delete({ where: { id: reg.id } });

  const removedFiles: string[] = [];
  for (const p of [reg.cvPath, reg.photo]) {
    if (!p || stillUsed.has(p)) continue;
    try {
      await unlink(absoluteUploadPath(p));
      removedFiles.push(p);
    } catch {
      /* already gone from disk */
    }
  }

  return json({ message: 'Registration deleted', removedFiles });
});
