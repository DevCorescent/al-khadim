// Ported from api/src/routes/candidateAuth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFile } from 'fs/promises';
import path from 'path';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCandidate } from '../auth';
import { body, handler, json, query } from '../http';
import { rateLimit } from '../rateLimit';
import { absoluteUploadPath, parseUpload } from '../upload';
import { parseCV } from '../utils/cvParser';
import { isValidYouTubeUrl } from '../utils/youtube';
import { sendTemplatedMail } from '../utils/templateRenderer';
import { normalizeEmail, redeemTicket } from '../utils/otp';
import { pagination, pickFields } from '../validate';

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

/** Text fields a candidate may submit when registering (src/app/candidate/register/page.tsx). */
const REGISTRATION_TEXT_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'nationality', 'currentLocation',
  'education', 'summary', 'headline', 'linkedIn',
] as const;

/** Text fields a candidate may edit on their own profile (src/app/candidate/profile/page.tsx). */
const PROFILE_TEXT_FIELDS = [
  'firstName', 'lastName', 'phone', 'nationality', 'currentLocation', 'visaStatus',
  'headline', 'summary', 'education', 'linkedIn', 'portfolio', 'currency',
] as const;

const toList = (v: any): string[] =>
  (Array.isArray(v) ? v : String(v).split(',')).map((s: any) => String(s).trim()).filter(Boolean);

function generateTokens(candidateId: string) {
  const access = jwt.sign(
    { candidateId, type: 'candidate' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );
  const refresh = jwt.sign(
    { candidateId, type: 'candidate' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' },
  );
  return { access, refresh };
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Content-Disposition like Express `res.download(file, name)`. */
function attachmentHeader(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '?').replace(/["\\]/g, '\\$&');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return ascii === filename
    ? `attachment; filename="${ascii}"`
    : `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/* ── Parse CV (public – no auth needed) ── */
export const parseCv = handler(async (req) => {
  const { file } = await parseUpload(req, ['cv']);
  if (!file) return json({ error: 'No CV file uploaded' }, 400);
  try {
    const parsed = await parseCV(absoluteUploadPath(file.path));
    return json({ parsed, cvPath: file.path });
  } catch (err: any) {
    console.error('CV parse error:', err);
    return json({ error: 'Failed to parse CV', detail: err.message }, 500);
  }
});

/* ── Register (public) ── */
export const register = handler(async (req) => {
  const { body: reqBody, files } = await parseUpload(req, ['cv', 'photo']);
  try {
    const { password, skills, languages, experience, parsedData, emailVerificationTicket } = reqBody;
    // Only the profile fields the registration form collects — never status, notes,
    // convertedTo, cvPath/photo (set from the uploads below) etc.
    const rest: any = pickFields(reqBody, REGISTRATION_TEXT_FIELDS);
    for (const k of Object.keys(rest)) rest[k] = Array.isArray(rest[k]) ? rest[k].join(', ') : String(rest[k]);
    rest.email = normalizeEmail(rest.email);

    if (!rest.firstName || !rest.lastName || !rest.email || !rest.phone) {
      return json({ error: 'First name, last name, email and phone are required' }, 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const otp = await redeemTicket(emailVerificationTicket, rest.email, 'CANDIDATE_REGISTRATION');

    // Check if email already registered
    const existing = await prisma.candidateRegistration.findFirst({ where: { email: rest.email } });
    if (existing) return json({ error: 'An application with this email already exists.' }, 409);

    const existingCandidate = await prisma.candidate.findUnique({ where: { email: rest.email } });
    if (existingCandidate) return json({ error: 'A candidate profile already exists for this email. Please log in.' }, 409);

    const hashedPassword = await bcrypt.hash(password, 12);

    // Safely parse parsedData if sent as string
    let parsedDataJson = null;
    if (parsedData) {
      try { parsedDataJson = typeof parsedData === 'string' ? JSON.parse(parsedData) : parsedData; } catch {}
    }

    const data: any = {
      ...rest,
      password: hashedPassword,
      experience: experience ? String(Array.isArray(experience) ? experience[0] : experience) : null,
      skills: Array.isArray(skills) ? skills.join(', ') : (skills || null),
      languages: Array.isArray(languages) ? languages.join(', ') : (languages || null),
      parsedData: parsedDataJson ?? undefined, // a literal null is rejected for Json columns
    };
    if (files?.cv)    data.cvPath = files.cv[0].path;
    if (files?.photo) data.photo  = files.photo[0].path;

    const [reg] = await prisma.$transaction([
      prisma.candidateRegistration.create({ data }),
      prisma.otpCode.update({ where: { id: otp.id }, data: { ticketUsedAt: new Date() } }),
    ]);
    return json({ message: 'Application submitted! You will be notified once approved.', id: reg.id }, 201);
  } catch (err: any) {
    console.error(err);
    if (err.code === 'P2002') return json({ error: 'An application with this email already exists.' }, 409);
    return json({ error: err.message }, err.status || 400);
  }
});

/* ── Login (public) ── */
export const login = handler(async (req) => {
  limiter(req);
  const { email, password } = await body(req);
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return json({ error: 'Email and password required' }, 400);
  }

  try {
    const account = await prisma.candidateAccount.findFirst({
      where: { candidate: { email: email.toLowerCase().trim() } },
      include: { candidate: true },
    });

    if (!account || !account.isActive) {
      return json({ error: 'Invalid credentials or account not yet approved.' }, 401);
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) return json({ error: 'Invalid credentials' }, 401);

    const { access, refresh } = generateTokens(account.candidateId);
    await prisma.candidateAccount.update({
      where: { id: account.id },
      data: { refreshToken: refresh, lastLogin: new Date() },
    });

    return json({
      accessToken: access,
      refreshToken: refresh,
      candidate: {
        id: account.candidate.id,
        firstName: account.candidate.firstName,
        lastName: account.candidate.lastName,
        email: account.candidate.email,
        photo: account.candidate.photo,
        headline: account.candidate.headline,
        isPublic: account.candidate.isPublic,
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Server error' }, 500);
  }
});

/* ── Refresh token ── */
export const refresh = handler(async (req) => {
  const { refreshToken } = await body(req);
  if (!refreshToken) return json({ error: 'Refresh token required' }, 401);

  try {
    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    if (decoded.type !== 'candidate') return json({ error: 'Invalid token type' }, 401);

    const account = await prisma.candidateAccount.findUnique({
      where: { candidateId: decoded.candidateId },
    });
    if (!account || account.refreshToken !== refreshToken || !account.isActive) {
      return json({ error: 'Invalid refresh token' }, 401);
    }

    const { access, refresh } = generateTokens(decoded.candidateId);
    await prisma.candidateAccount.update({
      where: { id: account.id },
      data: { refreshToken: refresh },
    });
    return json({ accessToken: access, refreshToken: refresh });
  } catch {
    return json({ error: 'Invalid refresh token' }, 401);
  }
});

/* ── Get my profile ── */
export const me = handler(async (req) => {
  const { candidate: me } = await requireCandidate(req);
  const candidate = await prisma.candidate.findUnique({
    where: { id: me.id },
    include: {
      applications: {
        include: { job: { include: { client: { select: { companyName: true } } } } },
        orderBy: { appliedAt: 'desc' },
      },
      interviews: {
        include: { job: true },
        orderBy: { scheduledAt: 'desc' },
      },
      documents: true,
    },
  });
  return json(candidate);
});

/* ── Update my profile ── */
export const updateMe = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const { body: reqBody, files } = await parseUpload(req, ['cv', 'photo']);
  try {
    const { skills, languages, currentSalary, expectedSalary, experience, introVideoUrl } = reqBody;
    // Allow-list: a candidate must not be able to change their email, status,
    // visibility (isPublic), cvId, notes, category/industry etc.
    const data: any = pickFields(reqBody, PROFILE_TEXT_FIELDS);
    for (const k of Object.keys(data)) {
      data[k] = Array.isArray(data[k]) ? String(data[k][0]) : String(data[k]);
    }
    for (const k of ['firstName', 'lastName', 'phone', 'currency']) {
      if (data[k] !== undefined && !data[k].trim()) return json({ error: `${k} cannot be empty` }, 400);
    }

    if (files?.cv)    data.cvPath = files.cv[0].path;
    if (files?.photo) data.photo  = files.photo[0].path;
    // An empty value (sent when the candidate clears a field) clears it.
    if (skills !== undefined)    data.skills    = toList(skills);
    if (languages !== undefined) data.languages = toList(languages);
    for (const [key, raw] of [['currentSalary', currentSalary], ['expectedSalary', expectedSalary]] as const) {
      if (raw === undefined) continue;
      if (raw === '') { data[key] = null; continue; }
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) return json({ error: `${key} must be a number` }, 400);
      data[key] = n;
    }
    if (experience === '') data.experience = null;
    else if (experience !== undefined) {
      const n = parseInt(experience, 10);
      if (!Number.isFinite(n) || n < 0) return json({ error: 'experience must be a number' }, 400);
      data.experience = n;
    }
    if (introVideoUrl !== undefined) {
      if (introVideoUrl && !isValidYouTubeUrl(introVideoUrl)) {
        return json({ error: 'Please enter a valid YouTube video URL' }, 400);
      }
      data.introVideoUrl = introVideoUrl || null;
    }

    // Capture changes for edit history
    const before: any = candidate;
    const changes: Record<string, { old: any; new: any }> = {};
    const TRACKED = ['firstName','lastName','email','phone','headline','summary','nationality','currentLocation','experience','skills','languages','education','linkedIn','portfolio','isPublic','introVideoUrl'];
    for (const field of TRACKED) {
      const oldVal = before[field];
      const newVal = data[field];
      if (newVal !== undefined) {
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) changes[field] = { old: oldVal, new: newVal };
      }
    }
    if (files?.cv)    changes.cvPath = { old: before.cvPath, new: data.cvPath };
    if (files?.photo) changes.photo  = { old: before.photo,  new: data.photo };

    const [updated] = await prisma.$transaction([
      prisma.candidate.update({ where: { id: candidate.id }, data }),
      ...(Object.keys(changes).length > 0 ? [
        prisma.candidateEditHistory.create({
          data: {
            candidateId: candidate.id,
            editedBy: 'candidate',
            editorName: `${before.firstName} ${before.lastName}`,
            changes,
          },
        }),
      ] : []),
    ]);

    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Get edit history ── */
export const editHistory = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const history = await prisma.candidateEditHistory.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return json(history);
});

/* ── Apply to a job as myself. The candidate always comes from the session, never the body. ── */
export const apply = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const { jobId } = await body(req);
  if (!jobId || typeof jobId !== 'string') return json({ error: 'jobId is required' }, 400);

  // Same rule as the public job list (jobs.controller listPublic): only open, published jobs.
  // Unpublished jobs get the same 404 as missing ones so they aren't revealed.
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true, isPublished: true } });
  if (!job || !job.isPublished) return json({ error: 'Job not found' }, 404);
  if (job.status !== 'OPEN') return json({ error: 'This job is no longer accepting applications' }, 400);

  try {
    const application = await prisma.candidateJob.create({
      data: { candidateId: candidate.id, jobId },
      include: { job: { include: { client: { select: { companyName: true } } } } },
    });
    return json(application, 201);
  } catch (err: any) {
    if (err?.code === 'P2002') return json({ error: 'You have already applied to this job' }, 409);
    throw err;
  }
});

/* ── Shared With: which companies my profile has been shared with ── */
export const shares = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const rows = await prisma.profileShare.findMany({
    where: { candidateId: candidate.id, status: { not: 'WITHDRAWN' } },
    select: {
      id: true,
      sentAt: true,
      status: true,
      client: { select: { companyName: true } },
      job: { select: { title: true } },
    },
    orderBy: { sentAt: 'desc' },
  });
  return json(rows);
});

/* ── My industry tracking (read-only, only what admin made visible to me) ── */
export const tracking = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const records = await prisma.candidateTracking.findMany({
    where: { candidateId: candidate.id, visibility: 'PUBLIC', visibleToCandidate: true },
    select: { id: true, industry: { select: { key: true, name: true, color: true } }, data: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return json(records);
});

/* ── My requested documents ── */
export const documentRequests = handler(async (req) => {
  const { candidate } = await requireCandidate(req);
  const requests = await prisma.documentRequest.findMany({
    where: { candidateId: candidate.id },
    select: {
      id: true, title: true, description: true, status: true,
      fileSize: true, mimeType: true, requestedAt: true, uploadedAt: true,
      verifiedAt: true, rejectionReason: true,
    },
    orderBy: { requestedAt: 'desc' },
  });
  return json(requests);
});

/* ── Upload a document against a request ── */
export const uploadDocument = handler<{ id: string }>(async (req, { params }) => {
  const { candidate } = await requireCandidate(req);
  const { file } = await parseUpload(req, ['file']);
  try {
    if (!file) return json({ error: 'File is required' }, 400);
    const request = await prisma.documentRequest.findUnique({
      where: { id: params.id },
      include: { requestedByUser: { select: { email: true, name: true } } },
    });
    if (!request || request.candidateId !== candidate.id) return json({ error: 'Request not found' }, 404);
    if (!['REQUESTED', 'REJECTED'].includes(request.status)) {
      return json({ error: 'This document has already been uploaded' }, 400);
    }

    const updated = await prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        filePath: file.path, fileSize: file.size, mimeType: file.mimetype,
        status: 'UPLOADED', uploadedAt: new Date(), rejectionReason: null,
      },
    });

    if (request.requestedByUser?.email) {
      sendTemplatedMail({
        templateSlug: 'document-uploaded-notify',
        to: request.requestedByUser.email,
        data: {
          candidateFullName: `${candidate.firstName} ${candidate.lastName}`,
          documentTitle: request.title,
        },
      }).catch((e) => console.error('document upload notify failed', e));
    }

    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Download my own uploaded document ── */
export const downloadDocument = handler<{ id: string }>(async (req, { params }) => {
  const { candidate } = await requireCandidate(req);
  const request = await prisma.documentRequest.findUnique({ where: { id: params.id } });
  if (!request || request.candidateId !== candidate.id || !request.filePath) {
    return json({ error: 'File not found' }, 404);
  }
  const abs = absoluteUploadPath(request.filePath);
  let data: Buffer;
  try {
    data = await readFile(abs);
  } catch (err: any) {
    // res.download's send error (ENOENT → 404) went to the global error handler.
    if (err.code === 'ENOENT') return json({ error: err.message }, 404);
    throw err;
  }
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': MIME[path.extname(request.title).toLowerCase()] || MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Disposition': attachmentHeader(request.title),
      'Content-Length': String(data.length),
    },
  });
});

/* ── Change password ── */
export const changePassword = handler(async (req) => {
  const { candidateAccount } = await requireCandidate(req);
  const { currentPassword, newPassword } = await body(req);
  if (!currentPassword || !newPassword) return json({ error: 'Both passwords required' }, 400);
  if (String(newPassword).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  try {
    const valid = await bcrypt.compare(String(currentPassword), candidateAccount.password);
    if (!valid) return json({ error: 'Current password is incorrect' }, 400);

    const hashed = await bcrypt.hash(String(newPassword), 12);
    await prisma.candidateAccount.update({
      where: { id: candidateAccount.id },
      data: { password: hashed },
    });
    return json({ message: 'Password changed successfully' });
  } catch {
    return json({ error: 'Server error' }, 500);
  }
});

/* ── Logout ── */
export const logout = handler(async (req) => {
  const { candidateAccount } = await requireCandidate(req);
  await prisma.candidateAccount.update({
    where: { id: candidateAccount.id },
    data: { refreshToken: null },
  });
  return json({ message: 'Logged out' });
});

/* ── Public profiles (approved + isPublic) ── */
export const publicProfiles = handler(async (req) => {
  const q = query(req);
  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 100 });
  const search = q.search ? String(q.search) : '';

  const where: any = { isPublic: true };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { headline:  { contains: search, mode: 'insensitive' } },
      { skills: { has: search } },
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true,
        headline: true, summary: true, photo: true,
        currentLocation: true, experience: true, skills: true,
        languages: true, nationality: true, linkedIn: true,
        portfolio: true, status: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.candidate.count({ where }),
  ]);

  return json({ data: profiles, total, page });
});
