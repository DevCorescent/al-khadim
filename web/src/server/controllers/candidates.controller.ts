// Ported from api/src/routes/candidates.js
import { unlink } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { CandidateStatus, Prisma } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { body, handler, HttpError, json, query } from '../http';
import { rateLimit } from '../rateLimit';
import { absoluteUploadPath, parseUpload } from '../upload';
import { parseCV } from '../utils/cvParser';
import { generateCvId } from '../utils/cvId';
import { isValidYouTubeUrl } from '../utils/youtube';
import { pagination, pickFields, scalarFields, toDate, toNumber } from '../validate';

const CATEGORY_INDUSTRY_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  industry: { select: { id: true, key: true, name: true, color: true } },
};

const CANDIDATE_STATUSES = Object.values(CandidateStatus) as string[];

/** Columns staff may set on create/update (cvId is generated, never client-controlled). */
const STAFF_FIELDS = scalarFields(Prisma.CandidateScalarFieldEnum, ['cvId']);

/** Columns the CV import review form sends. */
const IMPORT_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'altPhone', 'headline', 'summary', 'nationality',
  'currentLocation', 'experience', 'linkedIn', 'portfolio', 'skills', 'languages', 'education',
  'status', 'notes', 'isPublic', 'cvPath', 'source', 'categoryId', 'industryId',
];

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'phone'];
const CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const profileRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

/** Comma-separated string or array → trimmed, non-empty string list. */
function toList(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

/** A stored upload path supplied in the body (e.g. cvPath from /parse-cv) must point inside uploads/. */
function storedUploadPath(value: unknown, field: string): string | null {
  if (value === null || value === '') return null;
  const s = String(value).replace(/\\/g, '/');
  if (!/^uploads\/[\w\-./]+$/.test(s) || s.includes('..')) throw new HttpError(400, `Invalid ${field}`);
  absoluteUploadPath(s); // throws 400 when it resolves outside uploads/
  return s;
}

/**
 * Whitelists and normalises a candidate payload. With `partial` only the
 * fields that were sent are touched (update); otherwise required fields are
 * enforced and list/number fields get their create-time defaults.
 */
function candidateData(raw: any, allowed: readonly string[], partial: boolean) {
  const data: any = pickFields(raw || {}, allowed);

  for (const f of REQUIRED_FIELDS) {
    if ((!partial || f in data) && (typeof data[f] !== 'string' || !data[f].trim())) {
      throw new HttpError(400, `${f} is required`);
    }
  }
  if (data.email !== undefined) {
    data.email = String(data.email).trim();
    if (!EMAIL_RE.test(data.email)) throw new HttpError(400, 'email must be a valid email address');
  }
  if (data.status !== undefined && data.status !== '') {
    if (!CANDIDATE_STATUSES.includes(data.status)) throw new HttpError(400, 'Invalid status');
  } else if (data.status === '') delete data.status;

  if (data.skills !== undefined || !partial) data.skills = toList(data.skills);
  if (data.languages !== undefined || !partial) data.languages = toList(data.languages);

  for (const f of ['currentSalary', 'expectedSalary']) {
    if (data[f] !== undefined || !partial) data[f] = toNumber(data[f], f) ?? null;
  }
  if (data.experience !== undefined || !partial) {
    const n = toNumber(data.experience, 'experience');
    data.experience = n === undefined ? null : Math.trunc(n);
  }
  if (data.passportExpiry !== undefined) data.passportExpiry = toDate(data.passportExpiry, 'passportExpiry');
  if (data.isPublic !== undefined) data.isPublic = toBool(data.isPublic);
  if (data.categoryId === '') data.categoryId = null;
  if (data.industryId === '') data.industryId = null;
  if (data.currency === '' || data.currency === null) delete data.currency; // non-nullable, keeps its default
  if (data.cvPath !== undefined) data.cvPath = storedUploadPath(data.cvPath, 'cvPath');
  if (data.photo !== undefined) data.photo = storedUploadPath(data.photo, 'photo');

  if (data.introVideoUrl !== undefined) {
    if (data.introVideoUrl === '' || data.introVideoUrl === null) data.introVideoUrl = null;
    else if (!isValidYouTubeUrl(data.introVideoUrl)) throw new HttpError(400, 'Please enter a valid YouTube video URL');
  }
  return data;
}

/** Maps Prisma write errors to client errors instead of 500s. */
function prismaError(err: any, notFound = 'Candidate not found'): never {
  if (err instanceof HttpError) throw err;
  if (err?.code === 'P2002') throw new HttpError(409, 'A candidate with this email already exists.');
  if (err?.code === 'P2003') throw new HttpError(400, 'Invalid category or industry');
  if (err?.code === 'P2025') throw new HttpError(404, notFound);
  if (err?.name === 'PrismaClientValidationError') throw new HttpError(400, 'Invalid candidate data');
  throw err;
}

/** Creates a candidate with a generated cvId, retrying if a concurrent create took the same id. */
async function createCandidate(data: any) {
  for (let attempt = 0; attempt < 5; attempt++) {
    data.cvId = await generateCvId(prisma);
    try {
      return await prisma.candidate.create({ data });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const emailTaken = await prisma.candidate.findUnique({ where: { email: data.email }, select: { id: true } });
        if (!emailTaken) continue; // cvId collision — try the next id
      }
      prismaError(err);
    }
  }
  throw new HttpError(409, 'Could not allocate a CV ID, please retry');
}

/* ═══════════════════════════════════════════════════════
   PUBLIC ROUTES (no auth)
   ═══════════════════════════════════════════════════════ */

/* Public talent pool listing */
export const publicProfiles = handler(async (req) => {
  const q = query(req);
  const { search } = q;
  const { skip, limit } = pagination(q, { defaultLimit: 20, maxLimit: 100 });
  const where: any = { isPublic: true };
  if (search) {
    where.OR = [
      { firstName: { contains: String(search), mode: 'insensitive' } },
      { lastName:  { contains: String(search), mode: 'insensitive' } },
      { headline:  { contains: String(search), mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.candidate.findMany({
      where, skip, take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, headline: true,
        summary: true, photo: true, currentLocation: true, experience: true,
        skills: true, languages: true, nationality: true, status: true,
      },
    }),
    prisma.candidate.count({ where }),
  ]);
  return json({ data, total });
});

/* Single public profile (used by /candidates/[id] page) */
export const publicProfile = handler<{ id: string }>(async (req, { params }) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id, isPublic: true },
    select: {
      id: true, firstName: true, lastName: true, headline: true,
      summary: true, photo: true, currentLocation: true, experience: true,
      skills: true, languages: true, nationality: true, education: true,
      linkedIn: true, portfolio: true, status: true,
    },
  });
  if (!candidate) return json({ error: 'Profile not found' }, 404);
  return json(candidate);
});

/* Submit a profile request (public – no auth) */
export const requestProfile = handler<{ id: string }>(async (req, { params }) => {
  profileRequestLimiter(req);
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id, isPublic: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!candidate) return json({ error: 'Candidate not found' }, 404);

  const b = await body(req);
  const str = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
  const requesterName = str(b.requesterName, 200);
  const companyName = str(b.companyName, 200);
  const email = str(b.email, 200);
  const phone = str(b.phone, 50);
  const position = str(b.position, 200);
  const message = str(b.message, 5000);
  if (!requesterName || !companyName || !email || !phone) {
    return json({ error: 'Name, company, email and phone are required' }, 400);
  }
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address' }, 400);

  const request = await prisma.profileRequest.create({
    data: {
      candidateId: params.id,
      requesterName, companyName, email, phone,
      position: position || null,
      message: message || null,
    },
  });
  return json({ message: 'Request submitted successfully', id: request.id }, 201);
});

/* ═══════════════════════════════════════════════════════
   ADMIN ROUTES (require auth)
   ═══════════════════════════════════════════════════════ */

/* List all profile requests */
export const listProfileRequests = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const { status } = query(req);
  const where = status ? { status: String(status) } : {};
  const requests = await prisma.profileRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, headline: true, photo: true },
      },
    },
  });
  return json(requests);
});

/* Update a profile request status / admin notes */
export const updateProfileRequest = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'edit');
  const data: any = pickFields(await body(req), ['status', 'adminNotes']);
  if (data.status !== undefined && (typeof data.status !== 'string' || !data.status.trim())) {
    return json({ error: 'Invalid status' }, 400);
  }
  if (data.adminNotes !== undefined && data.adminNotes !== null) data.adminNotes = String(data.adminNotes);
  try {
    const updated = await prisma.profileRequest.update({ where: { id: params.id }, data });
    return json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Request not found' }, 404);
    throw err;
  }
});

/* Admin: parse a CV and return structured data (no candidate created yet) */
export const parseCv = handler(async (req) => {
  await requirePermission(req, 'candidates', 'create');
  const { file } = await parseUpload(req, ['cv']);
  if (!file) return json({ error: 'No CV file uploaded' }, 400);
  if (!CV_MIME_TYPES.includes(file.mimetype)) {
    await unlink(absoluteUploadPath(file.path)).catch(() => {});
    return json({ error: 'CV must be a PDF or Word document' }, 400);
  }
  try {
    const parsed = await parseCV(absoluteUploadPath(file.path));
    delete parsed._debug;
    return json({ parsed, cvPath: file.path });
  } catch (err: any) {
    return json({ error: 'Failed to parse CV', detail: err.message }, 500);
  }
});

/* Admin: create candidate directly from parsed CV data */
export const adminImport = handler(async (req) => {
  await requirePermission(req, 'candidates', 'create');
  const { body: fields, files } = await parseUpload(req, ['photo']);
  const data = candidateData(fields, IMPORT_FIELDS, false);
  if (files.photo) data.photo = files.photo[0].path;
  data.isPublic = toBool(fields.isPublic);
  data.source = data.source || 'ADMIN_IMPORT';
  const candidate = await createCandidate(data);
  return json(candidate, 201);
});

/* Admin: toggle isPublic for a candidate */
export const setVisibility = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'make_public');
  const b = await body(req);
  if (b.isPublic === undefined) return json({ error: 'isPublic is required' }, 400);
  try {
    const candidate = await prisma.candidate.update({
      where: { id: params.id },
      data: { isPublic: toBool(b.isPublic) },
    });
    return json(candidate);
  } catch (err: any) {
    prismaError(err);
  }
});

/* Admin list all candidates */
export const list = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const q = query(req);
  const {
    search, status, skills, nationality, source, currentLocation,
    minExperience, maxExperience, categoryId, industryId,
  } = q;
  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 500 });
  const where: any = {};
  const and: any[] = [];
  if (search) {
    const s = String(search);
    where.OR = [
      { cvId:      { contains: s, mode: 'insensitive' } },
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName:  { contains: s, mode: 'insensitive' } },
      { email:     { contains: s, mode: 'insensitive' } },
      { phone:     { contains: s } },
    ];
  }
  if (status) {
    if (!CANDIDATE_STATUSES.includes(String(status))) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }
  if (nationality) where.nationality = { contains: String(nationality), mode: 'insensitive' };
  if (currentLocation) where.currentLocation = { contains: String(currentLocation), mode: 'insensitive' };
  if (source) where.source = String(source);
  if (categoryId) where.categoryId = String(categoryId);
  if (industryId) where.industryId = String(industryId);
  if (skills) {
    // Case-insensitive "has any of these skills" (Prisma's `hasSome` is case-sensitive).
    const skillList = toList(skills).map((s) => s.toLowerCase());
    if (skillList.length) {
      const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "candidates"
        WHERE EXISTS (SELECT 1 FROM unnest("skills") AS s WHERE lower(s) = ANY(${skillList}::text[]))`);
      and.push({ id: { in: rows.map((r) => r.id) } });
    }
  }
  const minExp = toNumber(minExperience, 'minExperience');
  const maxExp = toNumber(maxExperience, 'maxExperience');
  if (minExp !== undefined || maxExp !== undefined) {
    where.experience = {};
    if (minExp !== undefined) where.experience.gte = Math.trunc(minExp);
    if (maxExp !== undefined) where.experience.lte = Math.trunc(maxExp);
  }
  if (and.length) where.AND = and;

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true, interviews: true } }, ...CATEGORY_INDUSTRY_INCLUDE },
    }),
    prisma.candidate.count({ where }),
  ]);
  return json({ data: candidates, total, page, limit });
});

/* Admin get single candidate (with edit history) */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'view');
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      applications: { include: { job: { include: { client: true } } } },
      interviews:   { include: { job: true } },
      documents: true,
      followUps: true,
      editHistory: { orderBy: { createdAt: 'desc' }, take: 100 },
      ...CATEGORY_INDUSTRY_INCLUDE,
    },
  });
  if (!candidate) return json({ error: 'Candidate not found' }, 404);
  return json(candidate);
});

/* Admin create candidate */
export const create = handler(async (req) => {
  await requirePermission(req, 'candidates', 'create');
  const { body: fields, files } = await parseUpload(req, ['cv', 'photo']);
  const data = candidateData(fields, STAFF_FIELDS, false);
  if (files.cv)    data.cvPath = files.cv[0].path;
  if (files.photo) data.photo  = files.photo[0].path;
  const candidate = await createCandidate(data);
  return json(candidate, 201);
});

/* Admin update candidate (with edit history) */
export const update = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const { body: fields, files } = await parseUpload(req, ['cv', 'photo']);
  const before: any = await prisma.candidate.findUnique({ where: { id: params.id } });
  if (!before) return json({ error: 'Candidate not found' }, 404);

  const data = candidateData(fields, STAFF_FIELDS, true);
  if (files.cv)    data.cvPath = files.cv[0].path;
  if (files.photo) data.photo  = files.photo[0].path;

  const TRACKED = ['firstName','lastName','email','phone','headline','summary','nationality','currentLocation','experience','skills','languages','education','linkedIn','portfolio','isPublic','status','notes','cvPath','photo','introVideoUrl','categoryId','industryId'];
  const changes: Record<string, { old: any; new: any }> = {};
  for (const field of TRACKED) {
    if (data[field] !== undefined && JSON.stringify(before[field]) !== JSON.stringify(data[field])) {
      changes[field] = { old: before[field], new: data[field] };
    }
  }

  const adminName = user?.name || 'Admin';
  try {
    const [candidate] = await prisma.$transaction([
      prisma.candidate.update({ where: { id: params.id }, data }),
      ...(Object.keys(changes).length > 0 ? [
        prisma.candidateEditHistory.create({
          data: { candidateId: params.id, editedBy: 'admin', editorName: adminName, editorId: user?.id, changes },
        }),
      ] : []),
    ] as any[]);
    return json(candidate);
  } catch (err: any) {
    prismaError(err);
  }
});

/* Admin delete candidate. Their job applications and interviews go with them
 * (other related rows cascade or are detached by the schema). */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'delete');
  const existing = await prisma.candidate.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return json({ error: 'Candidate not found' }, 404);
  try {
    await prisma.$transaction([
      prisma.interview.deleteMany({ where: { candidateId: params.id } }),
      prisma.candidateJob.deleteMany({ where: { candidateId: params.id } }),
      prisma.candidate.delete({ where: { id: params.id } }),
    ]);
    return json({ message: 'Candidate deleted' });
  } catch (err: any) {
    if (err?.code === 'P2003') return json({ error: 'This candidate has linked records and cannot be deleted' }, 409);
    prismaError(err);
  }
});

/* Assign candidate to job */
export const apply = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'edit');
  const { jobId } = await body(req);
  if (!jobId || typeof jobId !== 'string') return json({ error: 'jobId is required' }, 400);
  const [candidate, job] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: params.id }, select: { id: true } }),
    prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }),
  ]);
  if (!candidate) return json({ error: 'Candidate not found' }, 404);
  if (!job) return json({ error: 'Job not found' }, 404);
  try {
    const application = await prisma.candidateJob.create({
      data: { candidateId: params.id, jobId },
      include: { job: { include: { client: true } } },
    });
    return json(application, 201);
  } catch (err: any) {
    if (err?.code === 'P2002') return json({ error: 'Candidate has already been assigned to this job' }, 409);
    throw err;
  }
});
