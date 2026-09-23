// Ported from api/src/routes/profileShares.js
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedClient } from '../auth';
import { requirePermission } from '../permissions';
import { body, clientIp, handler, json, query } from '../http';
import { rateLimit } from '../rateLimit';
import { downloadName, fileResponse, isViewableType, MIME_BY_EXT, wantsInline } from '../utils/fileResponse';
import { sendTemplatedMail } from '../utils/templateRenderer';
import { nextStatus } from '../utils/profileShareStatus';
import { ALL_SHAREABLE_FIELDS } from '../constants/shareableFields';
import { escapeHtml, pagination, toDate } from '../validate';

const SHARE_METHODS = ['PORTAL', 'EMAIL', 'BOTH'];
const SHARE_STATUSES = ['SENT', 'VIEWED', 'DOWNLOADED', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED', 'WITHDRAWN'];

/** Throws the { status, message } shape createProfileShare's callers expect. */
function invalid(message: string): never {
  throw { status: 400, message };
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const INTERVIEW_SELECT = {
  id: true, scheduledAt: true, mode: true, meetLink: true, location: true,
  interviewers: true, notes: true, status: true,
} as const;

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const TOKEN_EXPIRY_DAYS = 30;

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a comma/newline-separated string or array into a de-duplicated list of valid emails. */
function parseEmails(input: unknown) {
  const raw: unknown[] = Array.isArray(input) ? input : String(input || '').split(/[,\n]/);
  const emails = raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const valid = [...new Set(emails.filter((e) => EMAIL_RE.test(e)))];
  const invalid = [...new Set(emails.filter((e) => !EMAIL_RE.test(e)))];
  return { valid, invalid };
}

/* ── Helpers ── */

function buildSnapshot(candidate: any, sharedFields: string[], documents: any[]) {
  const fields: Record<string, any> = {};
  for (const key of sharedFields) {
    fields[key] = candidate[key] ?? null;
  }
  return { fields, documents };
}

async function resolveDocuments(candidateId: string, sharedDocumentIds: string[], candidate: any) {
  const docs: any[] = [];
  const realIds = sharedDocumentIds.filter((id) => id !== 'cv');

  if (sharedDocumentIds.includes('cv') && candidate.cvPath) {
    docs.push({
      id: 'cv',
      type: 'CV',
      title: `CV - ${candidate.firstName} ${candidate.lastName}`,
      filePath: candidate.cvPath,
      // The CV has no Document row to read a type from, so derive it from the
      // stored file. Without it the download arrives as octet-stream.
      mimeType: MIME_BY_EXT[path.extname(String(candidate.cvPath)).toLowerCase()] || null,
      fileSize: null,
    });
  }

  if (realIds.length > 0) {
    const rows = await prisma.document.findMany({
      where: { id: { in: realIds }, candidateId },
    });
    for (const doc of rows) {
      docs.push({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        filePath: doc.filePath,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
      });
    }
  }
  return docs;
}

async function logEvent(
  shareId: string,
  { eventType, actorType, actorId = null, actorName = null, metadata = null }: { eventType: string; actorType: string; actorId?: string | null; actorName?: string | null; metadata?: any },
) {
  return prisma.profileShareEvent.create({
    data: { shareId, eventType, actorType, actorId, actorName, metadata } as any,
  });
}

/** Company-facing snapshot: documents are downloaded through the share endpoints
 * (which check withdrawal/expiry and log the download), so their stored file
 * paths are not exposed. */
function companySnapshot(snapshot: any) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.documents)) return snapshot;
  return {
    ...snapshot,
    documents: snapshot.documents.map(({ filePath, ...doc }: any) => {
      const mime = doc.mimeType || MIME_BY_EXT[path.extname(String(filePath || '')).toLowerCase()] || null;
      return {
        ...doc,
        mimeType: mime,
        // The name the download will actually arrive under, and whether the
        // browser can preview it — both drive the company-portal buttons.
        filename: downloadName(doc.title, String(filePath || '')),
        viewable: isViewableType(mime),
      };
    }),
  };
}

function safeShareView(share: any) {
  const latestInterview = (share.interviews || [])[0] || null;
  return {
    id: share.id,
    status: share.status,
    method: share.method,
    message: share.message,
    sentAt: share.sentAt,
    respondedAt: share.respondedAt,
    job: share.job ? { id: share.job.id, title: share.job.title } : null,
    client: share.client ? { id: share.client.id, companyName: share.client.companyName } : undefined,
    snapshotData: companySnapshot(share.snapshotData),
    // Scalar-only — never carries candidate/company account or credential data.
    interview: latestInterview,
  };
}

/** Effective mime type of a snapshot document: stored value, else its extension. */
function docMime(doc: any): string | null {
  return doc?.mimeType || MIME_BY_EXT[path.extname(String(doc?.filePath || '')).toLowerCase()] || null;
}

/**
 * Serves a shared document. `inline` renders it in the browser (document
 * preview) instead of downloading; see server/utils/fileResponse.
 */
async function download(storedPath: string, filename: string, inline = false, mimeType?: string | null) {
  return fileResponse(storedPath, filename, { inline, mimeType });
}

/** Create one ProfileShare (validate → snapshot → persist → optional email).
 * Shared by the single-create route and the bulk-create route so both stay
 * in lockstep. Throws { status, message } on validation failure. */
async function createProfileShare({ candidateId, clientId, jobId, sharedFields = [], sharedDocumentIds = [], method = 'PORTAL', message, notes, toEmail, sentByUser }: any) {
  if (!candidateId || !clientId || typeof candidateId !== 'string' || typeof clientId !== 'string') {
    throw { status: 400, message: 'candidateId and clientId are required' };
  }
  if (jobId !== undefined && jobId !== null && jobId !== '' && typeof jobId !== 'string') invalid('Invalid jobId');
  if (!Array.isArray(sharedFields)) invalid('sharedFields must be an array');
  if (!Array.isArray(sharedDocumentIds) || sharedDocumentIds.some((d: unknown) => typeof d !== 'string')) {
    invalid('sharedDocumentIds must be an array of ids');
  }
  if (!SHARE_METHODS.includes(method)) invalid('method must be PORTAL, EMAIL or BOTH');
  for (const [name, v] of [['message', message], ['notes', notes]] as const) {
    if (v !== undefined && v !== null && typeof v !== 'string') invalid(`${name} must be text`);
  }
  if (toEmail !== undefined && toEmail !== null && toEmail !== '' && (typeof toEmail !== 'string' || !EMAIL_RE.test(toEmail.trim()))) {
    invalid('toEmail must be a valid email address');
  }

  const validFields = sharedFields.filter((f: string) => ALL_SHAREABLE_FIELDS.includes(f));
  if (validFields.length === 0 && sharedDocumentIds.length === 0) {
    throw { status: 400, message: 'Select at least one field or document to share' };
  }

  const [candidate, client, job] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId } }),
    prisma.client.findUnique({ where: { id: clientId } }),
    jobId ? prisma.job.findUnique({ where: { id: jobId } }) : null,
  ]);
  if (!candidate) throw { status: 404, message: 'Candidate not found' };
  if (!client) throw { status: 404, message: 'Client not found' };
  if (jobId && (!job || job.clientId !== clientId)) {
    throw { status: 400, message: 'Job does not belong to the selected client' };
  }

  const documents = await resolveDocuments(candidateId, sharedDocumentIds, candidate);
  const snapshotData = buildSnapshot(candidate, validFields, documents);

  const accessToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const share = await prisma.$transaction(async (tx) => {
    const created = await tx.profileShare.create({
      data: {
        candidateId,
        clientId,
        jobId: jobId || null,
        sharedFields: validFields,
        sharedDocumentIds: documents.map((d) => d.id),
        snapshotData,
        method,
        accessToken,
        tokenExpiresAt,
        message: message || null,
        notes: notes || null,
        sentByUserId: sentByUser.id,
      } as any,
    });
    await tx.profileShareEvent.create({
      data: {
        shareId: created.id,
        eventType: 'CREATED',
        actorType: 'STAFF',
        actorId: sentByUser.id,
        actorName: sentByUser.name,
      },
    });
    return created;
  });

  if (method === 'EMAIL' || method === 'BOTH') {
    const recipient = toEmail || client.email;
    if (recipient) {
      try {
        const link = `${WEB_URL}/company/view/${accessToken}`;
        await sendTemplatedMail({
          templateSlug: 'profile-shared-client',
          to: recipient,
          subjectOverride: `Candidate profile shared with ${client.companyName}${job ? ` — ${job.title}` : ''}`,
          data: {
            recipientName: client.contactPerson || client.companyName,
            companyName: client.companyName,
            jobTitleBlock: job ? ` for the role of <strong>${escapeHtml(job.title)}</strong>` : '',
            messageBlock: message ? `<p>${escapeHtml(message)}</p>` : '',
            viewLink: link,
          },
        });
        await logEvent(share.id, { eventType: 'EMAIL_SENT', actorType: 'SYSTEM' });
      } catch (mailErr) {
        console.error('profileShares: email send failed', mailErr);
      }
    }
  }

  return share;
}

async function notifyStaff(share: any, subject: string, extra: string) {
  if (!share.sentByUser?.email) return;
  await sendTemplatedMail({
    templateSlug: 'staff-share-notification',
    to: share.sentByUser.email,
    subjectOverride: subject,
    data: { messageHtml: extra, shareUrl: `${WEB_URL}/admin/profile-shares/${share.id}` },
  });
}

/** Shared guard for the tokenized public link: returns the share, or an error response. */
async function findPublicShare(token: string) {
  const share = await prisma.profileShare.findUnique({ where: { accessToken: token } });
  if (!share) return { error: json({ error: 'This link is invalid' }, 404) };
  if (share.status === 'WITHDRAWN') return { error: json({ error: 'This profile is no longer available' }, 410) };
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return { error: json({ error: 'This link has expired' }, 410) };
  return { share };
}

/** Shared guard for company-portal routes: the share must belong to the caller's company and not be withdrawn. */
async function findClientShare(id: string, clientId: string) {
  const share = await prisma.profileShare.findUnique({ where: { id } });
  if (!share || share.clientId !== clientId) return { error: json({ error: 'Share not found' }, 404) };
  if (share.status === 'WITHDRAWN') return { error: json({ error: 'This profile is no longer available' }, 410) };
  return { share };
}

function visibleTracking(candidateId: string) {
  return prisma.candidateTracking.findMany({
    where: { candidateId, visibility: 'PUBLIC', visibleToCompany: true },
    select: { id: true, industry: { select: { key: true, name: true, color: true } }, data: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

function visibleDocumentRequests(candidateId: string) {
  return prisma.documentRequest.findMany({
    where: { candidateId, status: 'VERIFIED', visibleToCompany: true },
    select: { id: true, title: true, description: true, verifiedAt: true },
    orderBy: { verifiedAt: 'desc' },
  });
}

async function downloadDocumentRequest(reqId: string, candidateId: string) {
  const request = await prisma.documentRequest.findUnique({ where: { id: reqId } });
  if (!request || request.candidateId !== candidateId || request.status !== 'VERIFIED' || !request.visibleToCompany || !request.filePath) {
    return json({ error: 'Document not available' }, 404);
  }
  return download(request.filePath, request.title);
}

function userAgent(req: NextRequest) {
  return req.headers.get('user-agent') ?? undefined;
}

/* ══════════════ STAFF (ADMIN) ══════════════ */

export const list = handler(async (req) => {
  await requirePermission(req, 'candidates', 'view');
  const q = query(req);
  const { candidateId, clientId, jobId, status, sentByUserId } = q;
  const where: any = {};
  if (candidateId) where.candidateId = String(candidateId);
  if (clientId) where.clientId = String(clientId);
  if (jobId) where.jobId = String(jobId);
  if (status) {
    if (!SHARE_STATUSES.includes(String(status))) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }
  if (sentByUserId) where.sentByUserId = String(sentByUserId);

  const { page, limit, skip } = pagination(q, { defaultLimit: 20, maxLimit: 200 });
  const [data, total] = await Promise.all([
    prisma.profileShare.findMany({
      where,
      skip,
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, photo: true } },
        client: { select: { id: true, companyName: true } },
        job: { select: { id: true, title: true } },
        sentByUser: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.profileShare.count({ where }),
  ]);
  return json({ data, total, page });
});

export const create = handler(async (req) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  try {
    const { candidateId, clientId, jobId, sharedFields, sharedDocumentIds, method, message, notes, toEmail } = await body(req);
    const share = await createProfileShare({
      candidateId, clientId, jobId, sharedFields, sharedDocumentIds, method, message, notes, toEmail, sentByUser: user,
    });
    const full = await prisma.profileShare.findUnique({
      where: { id: share.id },
      include: { candidate: { select: { firstName: true, lastName: true } }, client: { select: { companyName: true } }, job: { select: { title: true } } },
    });
    return json(full, 201);
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message || 'Failed to create share' }, err.status || 400);
  }
});

/* Bulk-share: same field/document/method selection applied to many candidates
 * at once against a single company (+ optional job). Bulk mode only offers the
 * "include CV" document toggle — arbitrary uploaded documents are per-candidate
 * and don't generalize across a batch. */
export const bulkCreate = handler(async (req) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const { candidateIds, clientId, jobId, sharedFields = [], includeCv = false, method = 'PORTAL', message, notes } = await body(req);
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return json({ error: 'candidateIds must be a non-empty array' }, 400);
  }
  if (candidateIds.length > 200) {
    return json({ error: 'Bulk share is limited to 200 candidates at a time' }, 400);
  }
  if (!clientId) return json({ error: 'clientId is required' }, 400);
  if (candidateIds.some((id: unknown) => typeof id !== 'string' || !id)) {
    return json({ error: 'candidateIds must be an array of ids' }, 400);
  }

  const created: string[] = [];
  const failed: { candidateId: string; error: string }[] = [];

  for (const candidateId of candidateIds) {
    try {
      const share = await createProfileShare({
        candidateId,
        clientId,
        jobId,
        sharedFields,
        sharedDocumentIds: includeCv ? ['cv'] : [],
        method,
        message,
        notes,
        sentByUser: user,
      });
      created.push(share.id);
    } catch (err: any) {
      failed.push({ candidateId, error: err.message || 'Failed to share' });
    }
  }

  return json({ created: created.length, failed, shareIds: created }, created.length ? 201 : 400);
});

/* ══════════════ COMPANY PORTAL ══════════════ */

export const mineList = handler(async (req) => {
  const { client } = await requireApprovedClient(req);
  const { status } = query(req);
  const where: any = { clientId: client.id };
  if (status) {
    if (!SHARE_STATUSES.includes(String(status))) return json({ error: 'Invalid status' }, 400);
    where.status = status;
  }

  const shares = await prisma.profileShare.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  return json(shares.map(safeShareView));
});

export const mineGet = handler<{ id: string }>(async (req, { params }) => {
  const { client, clientUser } = await requireApprovedClient(req);
  const share = await prisma.profileShare.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  if (!share || share.clientId !== client.id) return json({ error: 'Share not found' }, 404);
  if (share.status === 'WITHDRAWN') return json({ error: 'This profile is no longer available' }, 410);

  const updatedStatus = nextStatus(share.status, 'VIEWED');
  await Promise.all([
    updatedStatus !== share.status
      ? prisma.profileShare.update({ where: { id: share.id }, data: { status: updatedStatus as any } })
      : Promise.resolve(),
    logEvent(share.id, { eventType: 'VIEWED', actorType: 'CLIENT_USER', actorId: clientUser.id, actorName: clientUser.name }),
  ]);

  return json(safeShareView({ ...share, status: updatedStatus }));
});

export const mineDownloadDocument = handler<{ id: string; docId: string }>(async (req, { params }) => {
  const { client, clientUser } = await requireApprovedClient(req);
  const { share, error } = await findClientShare(params.id, client.id);
  if (error) return error;

  const doc = ((share.snapshotData as any)?.documents || []).find((d: any) => d.id === params.docId);
  if (!doc) return json({ error: 'Document not shared' }, 404);

  // A preview is logged as VIEWED, an actual download as DOWNLOADED, so the
  // audit trail still answers "did this company take a copy of the CV?".
  const inline = wantsInline(req) && isViewableType(docMime(doc));
  const eventType = inline ? 'VIEWED' : 'DOWNLOADED';

  await logEvent(share.id, {
    eventType,
    actorType: 'CLIENT_USER',
    actorId: clientUser.id,
    actorName: clientUser.name,
    metadata: { documentId: doc.id, mode: inline ? 'inline' : 'download' },
  });
  const status = nextStatus(share.status, eventType);
  if (status !== share.status) await prisma.profileShare.update({ where: { id: share.id }, data: { status: status as any } });

  return download(doc.filePath, doc.title, inline, doc.mimeType);
});

/** Application (CandidateJob) statuses a company SHORTLIST / REJECT, or scheduling an
 * interview from a share, must not overwrite (they would move the application backwards). */
const APPLICATION_STAGES_KEPT_ON: Record<'SHORTLIST' | 'REJECT' | 'SCHEDULE_INTERVIEW', string[]> = {
  SHORTLIST: ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'JOINED'],
  REJECT: ['OFFERED', 'JOINED'],
  SCHEDULE_INTERVIEW: ['OFFERED', 'JOINED'],
};

export const mineRespond = handler<{ id: string }>(async (req, { params }) => {
  const { client, clientUser } = await requireApprovedClient(req);
  const { action, reason, preferredAt, interviewerEmails } = await body(req);
  const ACTIONS: Record<string, string> = { SHORTLIST: 'SHORTLISTED', REJECT: 'REJECTED', REQUEST_INTERVIEW: 'INTERVIEW_REQUESTED' };
  if (!ACTIONS[action]) return json({ error: 'Invalid action' }, 400);
  if (reason !== undefined && reason !== null && typeof reason !== 'string') return json({ error: 'reason must be text' }, 400);

  let preferredDate: Date | null = null;
  let interviewerEmailList: string[] = [];
  if (action === 'REQUEST_INTERVIEW') {
    if (!preferredAt) return json({ error: 'Please choose a preferred date and time for the interview' }, 400);
    preferredDate = new Date(preferredAt);
    if (isNaN(preferredDate.getTime())) return json({ error: 'Invalid date/time' }, 400);

    const { valid, invalid } = parseEmails(interviewerEmails);
    if (invalid.length > 0) {
      return json({ error: `These don't look like valid email addresses: ${invalid.join(', ')}` }, 400);
    }
    if (valid.length === 0) {
      return json({ error: 'Enter the email address of at least one person who will take the interview.' }, 400);
    }
    interviewerEmailList = valid;
  }

  const share = await prisma.profileShare.findUnique({
    where: { id: params.id },
    include: { sentByUser: { select: { email: true } }, candidate: { select: { firstName: true, lastName: true } }, job: true },
  });
  if (!share || share.clientId !== client.id) return json({ error: 'Share not found' }, 404);
  if (share.status === 'WITHDRAWN') return json({ error: 'This profile is no longer available' }, 410);

  if ((action === 'SHORTLIST' || action === 'REJECT') && !share.jobId) {
    return json({ error: 'This share has no associated job order — ask Al Khadim staff to re-share against a specific job to shortlist or reject.' }, 400);
  }

  const newStatus: any = nextStatus(share.status, ACTIONS[action]);

  await prisma.$transaction(async (tx) => {
    await tx.profileShare.update({
      where: { id: share.id },
      data: {
        status: newStatus,
        respondedByClientUserId: clientUser.id,
        respondedAt: new Date(),
      },
    });
    await tx.profileShareEvent.create({
      data: {
        shareId: share.id,
        eventType: ACTIONS[action],
        actorType: 'CLIENT_USER',
        actorId: clientUser.id,
        actorName: clientUser.name,
        metadata: action === 'REQUEST_INTERVIEW'
          ? { preferredAt: preferredDate.toISOString(), reason: reason || null, interviewerEmails: interviewerEmailList }
          : (reason ? { reason } : null),
      } as any,
    });
    if (action === 'SHORTLIST' || action === 'REJECT') {
      // Mirror the decision onto the application, but never move it backwards: once staff have
      // taken it further (interview/offer/placement) that status stays. The share above still
      // records the company's response and staff are notified below.
      const current = await tx.candidateJob.findUnique({
        where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
        select: { status: true },
      });
      if (!current || !APPLICATION_STAGES_KEPT_ON[action].includes(current.status)) {
        await tx.candidateJob.upsert({
          where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
          update: { status: newStatus },
          create: { candidateId: share.candidateId, jobId: share.jobId, status: newStatus },
        });
      }
    }
  });

  const candidateName = `${share.candidate.firstName} ${share.candidate.lastName}`;
  const verb = action === 'SHORTLIST' ? 'shortlisted' : action === 'REJECT' ? 'rejected' : 'requested an interview for';
  const preferredNote = action === 'REQUEST_INTERVIEW'
    ? ` Preferred time: ${preferredDate.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}. Interviewer(s): ${interviewerEmailList.join(', ')}.`
    : '';
  // messageHtml is inserted as raw HTML by the template renderer — escape every user-supplied part.
  try {
    await notifyStaff(
      { ...share, sentByUser: share.sentByUser },
      `${client.companyName} ${verb} ${candidateName}`,
      escapeHtml(`${clientUser.name} at ${client.companyName} ${verb} ${candidateName}${share.job ? ` for ${share.job.title}` : ''}.${preferredNote}${reason ? ` Note: ${reason}` : ''}`),
    );
  } catch (mailErr) {
    console.error('profileShares: staff notification failed', mailErr);
  }

  return json({ status: newStatus });
});

/* Industry tracking Al Khadim has made visible to this company for the
 * shared candidate (independent of which job/fields were shared). */
export const mineTracking = handler<{ id: string }>(async (req, { params }) => {
  const { client } = await requireApprovedClient(req);
  const { share, error } = await findClientShare(params.id, client.id);
  if (error) return error;
  return json(await visibleTracking(share.candidateId));
});

/* Verified documents Al Khadim has made visible to this company for the
 * shared candidate. */
export const mineDocumentRequests = handler<{ id: string }>(async (req, { params }) => {
  const { client } = await requireApprovedClient(req);
  const { share, error } = await findClientShare(params.id, client.id);
  if (error) return error;
  return json(await visibleDocumentRequests(share.candidateId));
});

export const mineDownloadDocumentRequest = handler<{ id: string; reqId: string }>(async (req, { params }) => {
  const { client } = await requireApprovedClient(req);
  const { share, error } = await findClientShare(params.id, client.id);
  if (error) return error;
  return downloadDocumentRequest(params.reqId, share.candidateId);
});

/* ══════════════ PUBLIC TOKENIZED LINK (no login) ══════════════ */

export const publicGet = handler<{ token: string }>(async (req, { params }) => {
  publicLimiter(req);
  const share = await prisma.profileShare.findUnique({
    where: { accessToken: params.token },
    include: {
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  if (!share) return json({ error: 'This link is invalid' }, 404);
  if (share.status === 'WITHDRAWN') return json({ error: 'This profile is no longer available' }, 410);
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return json({ error: 'This link has expired' }, 410);

  const updatedStatus = nextStatus(share.status, 'VIEWED');
  await Promise.all([
    updatedStatus !== share.status
      ? prisma.profileShare.update({ where: { id: share.id }, data: { status: updatedStatus as any } })
      : Promise.resolve(),
    logEvent(share.id, {
      eventType: 'VIEWED',
      actorType: 'ANONYMOUS_TOKEN',
      metadata: { ip: clientIp(req), userAgent: userAgent(req) },
    }),
  ]);

  return json(safeShareView({ ...share, status: updatedStatus }));
});

export const publicDownloadDocument = handler<{ token: string; docId: string }>(async (req, { params }) => {
  publicLimiter(req);
  const { share, error } = await findPublicShare(params.token);
  if (error) return error;

  const doc = ((share.snapshotData as any)?.documents || []).find((d: any) => d.id === params.docId);
  if (!doc) return json({ error: 'Document not shared' }, 404);

  const inline = wantsInline(req) && isViewableType(docMime(doc));
  const eventType = inline ? 'VIEWED' : 'DOWNLOADED';

  await logEvent(share.id, {
    eventType,
    actorType: 'ANONYMOUS_TOKEN',
    metadata: { documentId: doc.id, mode: inline ? 'inline' : 'download', ip: clientIp(req), userAgent: userAgent(req) },
  });
  const status = nextStatus(share.status, eventType);
  if (status !== share.status) await prisma.profileShare.update({ where: { id: share.id }, data: { status: status as any } });

  return download(doc.filePath, doc.title, inline, doc.mimeType);
});

export const publicTracking = handler<{ token: string }>(async (req, { params }) => {
  publicLimiter(req);
  const { share, error } = await findPublicShare(params.token);
  if (error) return error;
  return json(await visibleTracking(share.candidateId));
});

export const publicDocumentRequests = handler<{ token: string }>(async (req, { params }) => {
  publicLimiter(req);
  const { share, error } = await findPublicShare(params.token);
  if (error) return error;
  return json(await visibleDocumentRequests(share.candidateId));
});

export const publicDownloadDocumentRequest = handler<{ token: string; reqId: string }>(async (req, { params }) => {
  publicLimiter(req);
  const { share, error } = await findPublicShare(params.token);
  if (error) return error;
  return downloadDocumentRequest(params.reqId, share.candidateId);
});

/* ══════════════ STAFF (ADMIN) — single share ══════════════ */

export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'candidates', 'view');
  const share = await prisma.profileShare.findUnique({
    where: { id: params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, photo: true, email: true } },
      client: { select: { id: true, companyName: true, contactPerson: true, email: true } },
      job: { select: { id: true, title: true } },
      sentByUser: { select: { id: true, name: true } },
      respondedByClientUser: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: 'asc' } },
      interviews: { orderBy: { scheduledAt: 'desc' } },
    },
  });
  if (!share) return json({ error: 'Share not found' }, 404);
  return json(share);
});

/* Schedule (or re-schedule) the interview for a share, and notify both sides.
 * If the candidate has no portal login yet, one is created and the temporary
 * password is emailed to the CANDIDATE ONLY — it must never appear in the
 * company-facing email/API response, per the confidentiality requirement. */
export const scheduleInterview = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'interviews', 'create');
  try {
    const { scheduledAt, mode, meetLink, location, interviewers, notes } = await body(req);
    if (!scheduledAt) return json({ error: 'scheduledAt is required' }, 400);
    const scheduledDate = toDate(scheduledAt, 'scheduledAt');
    if (!['ONLINE', 'OFFLINE'].includes(mode)) return json({ error: 'mode must be ONLINE or OFFLINE' }, 400);
    if (mode === 'ONLINE' && !meetLink) return json({ error: 'A meeting link is required for an online interview' }, 400);
    if (mode === 'OFFLINE' && !location) return json({ error: 'A location is required for an offline interview' }, 400);
    if (mode === 'ONLINE' && (typeof meetLink !== 'string' || !isHttpUrl(meetLink))) {
      return json({ error: 'The meeting link must be a valid http(s) URL' }, 400);
    }
    if (mode === 'OFFLINE' && typeof location !== 'string') return json({ error: 'Invalid location' }, 400);
    if (notes !== undefined && notes !== null && typeof notes !== 'string') return json({ error: 'notes must be text' }, 400);

    const { valid: interviewerEmailList, invalid: invalidInterviewerEmails } = parseEmails(interviewers);
    if (invalidInterviewerEmails.length > 0) {
      return json({ error: `These interviewer entries aren't valid email addresses: ${invalidInterviewerEmails.join(', ')}` }, 400);
    }

    const share = await prisma.profileShare.findUnique({
      where: { id: params.id },
      include: {
        candidate: true,
        client: { select: { companyName: true, contactPerson: true, email: true } },
        job: { select: { id: true, title: true } },
        respondedByClientUser: { select: { email: true, name: true } },
      },
    });
    if (!share) return json({ error: 'Share not found' }, 404);
    if (share.status === 'WITHDRAWN') return json({ error: 'This share has been withdrawn' }, 410);
    if (!share.jobId) return json({ error: 'This share has no associated job order — interviews must be scheduled against a specific job.' }, 400);

    let newAccountPassword: string | null = null;
    const { interview, isNewAccount } = await prisma.$transaction(async (tx) => {
      const createdInterview = await tx.interview.create({
        data: {
          candidateId: share.candidateId,
          jobId: share.jobId,
          scheduledAt: scheduledDate,
          type: mode === 'ONLINE' ? 'VIDEO' : 'IN_PERSON',
          mode,
          meetLink: mode === 'ONLINE' ? meetLink : null,
          location: mode === 'OFFLINE' ? location : null,
          interviewers: interviewerEmailList,
          notes: notes || null,
          profileShareId: share.id,
        } as any,
      });

      // A further interview round is fine (e.g. INTERVIEWED → INTERVIEW_SCHEDULED), but an
      // offered/placed application keeps its status; the interview itself is still created.
      const currentApp = await tx.candidateJob.findUnique({
        where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
        select: { status: true },
      });
      if (!currentApp || !APPLICATION_STAGES_KEPT_ON.SCHEDULE_INTERVIEW.includes(currentApp.status)) {
        await tx.candidateJob.upsert({
          where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
          update: { status: 'INTERVIEW_SCHEDULED' },
          create: { candidateId: share.candidateId, jobId: share.jobId, status: 'INTERVIEW_SCHEDULED' },
        });
      }

      const newStatus = nextStatus(share.status, 'INTERVIEW_SCHEDULED');
      await tx.profileShare.update({ where: { id: share.id }, data: { status: newStatus as any } });
      await tx.profileShareEvent.create({
        data: {
          shareId: share.id,
          eventType: 'INTERVIEW_SCHEDULED',
          actorType: 'STAFF',
          actorId: user.id,
          actorName: user.name,
          metadata: { scheduledAt: createdInterview.scheduledAt.toISOString(), mode, meetLink: mode === 'ONLINE' ? meetLink : null, location: mode === 'OFFLINE' ? location : null },
        },
      });

      let accountCreated = false;
      const existingAccount = await tx.candidateAccount.findUnique({ where: { candidateId: share.candidateId } });
      if (!existingAccount) {
        newAccountPassword = crypto.randomBytes(6).toString('hex');
        const hashed = await bcrypt.hash(newAccountPassword, 12);
        await tx.candidateAccount.create({
          data: { candidateId: share.candidateId, password: hashed, isActive: true },
        });
        accountCreated = true;
      }

      return { interview: createdInterview, isNewAccount: accountCreated };
    });

    const when = interview.scheduledAt.toLocaleString('en-AE', { dateStyle: 'full', timeStyle: 'short' });
    const candidateLoginUrl = `${WEB_URL}/candidate/login`;
    const candidateName = `${share.candidate.firstName} ${share.candidate.lastName}`;

    const modeLabel = mode === 'ONLINE' ? 'Online' : 'In person';
    const meetingOrLocationBlock = mode === 'ONLINE'
      ? `<p><strong>Meeting link:</strong> <a href="${escapeHtml(meetLink)}">${escapeHtml(meetLink)}</a></p>`
      : `<p><strong>Location:</strong> ${escapeHtml(location)}</p>`;
    const notesBlock = notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : '';

    // Candidate email — includes portal credentials ONLY when an account was just created.
    let candidateEmailSent = true;
    try {
      const accountBlock = isNewAccount
        ? `<p>We've created a candidate portal account for you so you can track this and future opportunities:</p>
           <p>Login: <a href="${candidateLoginUrl}">${candidateLoginUrl}</a><br/>Email: ${escapeHtml(share.candidate.email)}<br/>Temporary password: <strong>${newAccountPassword}</strong></p>
           <p>Please log in and change your password.</p>`
        : `<p>You can view this anytime in your <a href="${candidateLoginUrl}">candidate dashboard</a>.</p>`;
      await sendTemplatedMail({
        templateSlug: 'interview-scheduled-candidate',
        to: share.candidate.email,
        subjectOverride: `Interview Scheduled — ${share.job.title} at ${share.client.companyName}`,
        data: {
          candidateName, jobTitle: share.job.title, companyName: share.client.companyName,
          whenFormatted: when, modeLabel, meetingOrLocationBlock, notesBlock, accountBlock,
        },
      });
    } catch (mailErr) {
      candidateEmailSent = false;
      console.error('schedule-interview: candidate email failed', mailErr);
    }

    // Company email — interview details only, NEVER candidate account/credential info.
    try {
      const companyRecipient = share.respondedByClientUser?.email || share.client.email;
      await sendTemplatedMail({
        templateSlug: 'interview-confirmed-client',
        to: companyRecipient,
        subjectOverride: `Interview Confirmed — ${share.job.title}`,
        data: {
          recipientName: share.respondedByClientUser?.name || share.client.contactPerson || share.client.companyName,
          jobTitle: share.job.title, whenFormatted: when, modeLabel, meetingOrLocationBlock, notesBlock,
          portalUrl: `${WEB_URL}/company/candidates/${share.id}`,
        },
      });
    } catch (mailErr) {
      console.error('schedule-interview: company email failed', mailErr);
    }

    // Interviewer invitations — candidate name + role + time + how to join.
    // Never includes candidate portal credentials (candidate-only, per the confidentiality note above).
    const interviewerResults = await Promise.allSettled(
      interviewerEmailList.map((to) => sendTemplatedMail({
        templateSlug: 'interview-invitation-interviewer',
        to,
        subjectOverride: `Interview Invitation — ${candidateName} for ${share.job.title} at ${share.client.companyName}`,
        data: {
          candidateName, jobTitle: share.job.title, companyName: share.client.companyName,
          whenFormatted: when, modeLabel, meetingOrLocationBlock, notesBlock,
        },
      })),
    );
    const interviewerFailures = interviewerResults
      .map((r, i) => (r.status === 'rejected' ? interviewerEmailList[i] : null))
      .filter(Boolean);
    if (interviewerFailures.length > 0) {
      console.error('schedule-interview: interviewer email(s) failed:', interviewerFailures.join(', '));
    }

    return json({
      interview,
      accountCreated: isNewAccount,
      interviewersNotified: interviewerEmailList.length - interviewerFailures.length,
      interviewerFailures,
      // The new account's temporary password only exists in the candidate email.
      // If that email failed, hand it to the staff member (this is a staff-only
      // endpoint) so it can be passed on — otherwise it would be lost for good.
      ...(!candidateEmailSent && {
        candidateEmailSent: false,
        ...(isNewAccount && { temporaryPassword: newAccountPassword }),
      }),
    }, 201);
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message }, 400);
  }
});

export const resend = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const share = await prisma.profileShare.findUnique({
    where: { id: params.id },
    include: { client: true, job: { select: { title: true } } },
  });
  if (!share) return json({ error: 'Share not found' }, 404);
  if (share.status === 'WITHDRAWN') return json({ error: 'This share has been withdrawn' }, 410);
  if (!share.accessToken) return json({ error: 'This share has no access link to resend' }, 400);

  const { toEmail } = await body(req);
  if (toEmail !== undefined && toEmail !== null && toEmail !== '' && (typeof toEmail !== 'string' || !EMAIL_RE.test(toEmail.trim()))) {
    return json({ error: 'toEmail must be a valid email address' }, 400);
  }
  const recipient = (toEmail && toEmail.trim()) || share.client.email;
  const link = `${WEB_URL}/company/view/${share.accessToken}`;
  await sendTemplatedMail({
    templateSlug: 'profile-share-reminder',
    to: recipient,
    subjectOverride: `Reminder: candidate profile shared with ${share.client.companyName}${share.job ? ` — ${share.job.title}` : ''}`,
    data: { companyName: share.client.companyName, jobTitleBlock: share.job ? ` — ${escapeHtml(share.job.title)}` : '', viewLink: link },
  });
  await logEvent(share.id, { eventType: 'RESENT', actorType: 'STAFF', actorId: user.id, actorName: user.name });
  return json({ message: 'Share resent' });
});

export const withdraw = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'candidates', 'edit');
  const share = await prisma.profileShare.findUnique({ where: { id: params.id } });
  if (!share) return json({ error: 'Share not found' }, 404);
  if (share.status === 'WITHDRAWN') return json({ error: 'Already withdrawn' }, 400);

  await prisma.$transaction([
    prisma.profileShare.update({
      where: { id: share.id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnByUserId: user.id },
    }),
    prisma.profileShareEvent.create({
      data: { shareId: share.id, eventType: 'WITHDRAWN', actorType: 'STAFF', actorId: user.id, actorName: user.name },
    }),
  ]);
  return json({ message: 'Share withdrawn' });
});
