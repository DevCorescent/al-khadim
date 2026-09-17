const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { authenticateApprovedClient } = require('../middleware/clientAuth');
const { sendTemplatedMail } = require('../utils/templateRenderer');
const { nextStatus } = require('../utils/profileShareStatus');
const { ALL_SHAREABLE_FIELDS } = require('../constants/shareableFields');

const INTERVIEW_SELECT = {
  id: true, scheduledAt: true, mode: true, meetLink: true, location: true,
  interviewers: true, notes: true, status: true,
};

const prisma = new PrismaClient();
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const TOKEN_EXPIRY_DAYS = 30;

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a comma/newline-separated string or array into a de-duplicated list of valid emails. */
function parseEmails(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,\n]/);
  const emails = raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const valid = [...new Set(emails.filter((e) => EMAIL_RE.test(e)))];
  const invalid = [...new Set(emails.filter((e) => !EMAIL_RE.test(e)))];
  return { valid, invalid };
}

/* ── Helpers ── */

function buildSnapshot(candidate, sharedFields, documents) {
  const fields = {};
  for (const key of sharedFields) {
    fields[key] = candidate[key] ?? null;
  }
  return { fields, documents };
}

async function resolveDocuments(candidateId, sharedDocumentIds, candidate) {
  const docs = [];
  const realIds = sharedDocumentIds.filter((id) => id !== 'cv');

  if (sharedDocumentIds.includes('cv') && candidate.cvPath) {
    docs.push({
      id: 'cv',
      type: 'CV',
      title: `CV - ${candidate.firstName} ${candidate.lastName}`,
      filePath: candidate.cvPath,
      mimeType: null,
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

async function logEvent(shareId, { eventType, actorType, actorId = null, actorName = null, metadata = null }) {
  return prisma.profileShareEvent.create({
    data: { shareId, eventType, actorType, actorId, actorName, metadata },
  });
}

function safeShareView(share) {
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
    snapshotData: share.snapshotData,
    // Scalar-only — never carries candidate/company account or credential data.
    interview: latestInterview,
  };
}

/** Create one ProfileShare (validate → snapshot → persist → optional email).
 * Shared by the single-create route and the bulk-create route so both stay
 * in lockstep. Throws { status, message } on validation failure. */
async function createProfileShare({ candidateId, clientId, jobId, sharedFields = [], sharedDocumentIds = [], method = 'PORTAL', message, notes, toEmail, sentByUser }) {
  if (!candidateId || !clientId) throw { status: 400, message: 'candidateId and clientId are required' };

  const validFields = sharedFields.filter((f) => ALL_SHAREABLE_FIELDS.includes(f));
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
      },
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
            jobTitleBlock: job ? ` for the role of <strong>${job.title}</strong>` : '',
            messageBlock: message ? `<p>${message}</p>` : '',
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

async function notifyStaff(share, subject, extra) {
  if (!share.sentByUser?.email) return;
  await sendTemplatedMail({
    templateSlug: 'staff-share-notification',
    to: share.sentByUser.email,
    subjectOverride: subject,
    data: { messageHtml: extra, shareUrl: `${WEB_URL}/admin/profile-shares/${share.id}` },
  });
}

/* ══════════════ STAFF (ADMIN) — list/create only; :id routes moved below the
   COMPANY/PUBLIC sections so a bare "/mine" or "/public/..." path can never
   be swallowed by a generic single-segment "/:id" route registered earlier ══════════════ */

router.get('/', authenticate, async (req, res) => {
  const { candidateId, clientId, jobId, status, sentByUserId, page = 1, limit = 20 } = req.query;
  const where = {};
  if (candidateId) where.candidateId = candidateId;
  if (clientId) where.clientId = clientId;
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;
  if (sentByUserId) where.sentByUserId = sentByUserId;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    prisma.profileShare.findMany({
      where,
      skip,
      take: Number(limit),
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
  res.json({ data, total, page: Number(page) });
});

router.post('/', authenticate, async (req, res) => {
  try {
    const share = await createProfileShare({ ...req.body, sentByUser: req.user });
    const full = await prisma.profileShare.findUnique({
      where: { id: share.id },
      include: { candidate: { select: { firstName: true, lastName: true } }, client: { select: { companyName: true } }, job: { select: { title: true } } },
    });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(err.status || 400).json({ error: err.message || 'Failed to create share' });
  }
});

/* Bulk-share: same field/document/method selection applied to many candidates
 * at once against a single company (+ optional job). Bulk mode only offers the
 * "include CV" document toggle — arbitrary uploaded documents are per-candidate
 * and don't generalize across a batch. */
router.post('/bulk', authenticate, async (req, res) => {
  const { candidateIds, clientId, jobId, sharedFields = [], includeCv = false, method = 'PORTAL', message, notes } = req.body;
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({ error: 'candidateIds must be a non-empty array' });
  }
  if (candidateIds.length > 200) {
    return res.status(400).json({ error: 'Bulk share is limited to 200 candidates at a time' });
  }
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });

  const created = [];
  const failed = [];

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
        sentByUser: req.user,
      });
      created.push(share.id);
    } catch (err) {
      failed.push({ candidateId, error: err.message || 'Failed to share' });
    }
  }

  res.status(created.length ? 201 : 400).json({ created: created.length, failed, shareIds: created });
});

/* ══════════════ COMPANY PORTAL ══════════════ */

router.get('/mine', authenticateApprovedClient, async (req, res) => {
  const { status } = req.query;
  const where = { clientId: req.client.id };
  if (status) where.status = status;

  const shares = await prisma.profileShare.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  res.json(shares.map(safeShareView));
});

router.get('/mine/:id', authenticateApprovedClient, async (req, res) => {
  const share = await prisma.profileShare.findUnique({
    where: { id: req.params.id },
    include: {
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  const updatedStatus = nextStatus(share.status, 'VIEWED');
  await Promise.all([
    updatedStatus !== share.status
      ? prisma.profileShare.update({ where: { id: share.id }, data: { status: updatedStatus } })
      : Promise.resolve(),
    logEvent(share.id, { eventType: 'VIEWED', actorType: 'CLIENT_USER', actorId: req.clientUser.id, actorName: req.clientUser.name }),
  ]);

  res.json(safeShareView({ ...share, status: updatedStatus }));
});

router.get('/mine/:id/documents/:docId/download', authenticateApprovedClient, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { id: req.params.id } });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  const doc = (share.snapshotData?.documents || []).find((d) => d.id === req.params.docId);
  if (!doc) return res.status(404).json({ error: 'Document not shared' });

  await logEvent(share.id, {
    eventType: 'DOWNLOADED',
    actorType: 'CLIENT_USER',
    actorId: req.clientUser.id,
    actorName: req.clientUser.name,
    metadata: { documentId: doc.id },
  });
  const status = nextStatus(share.status, 'DOWNLOADED');
  if (status !== share.status) await prisma.profileShare.update({ where: { id: share.id }, data: { status } });

  res.download(doc.filePath, doc.title);
});

router.post('/mine/:id/respond', authenticateApprovedClient, async (req, res) => {
  const { action, reason, preferredAt, interviewerEmails } = req.body;
  const ACTIONS = { SHORTLIST: 'SHORTLISTED', REJECT: 'REJECTED', REQUEST_INTERVIEW: 'INTERVIEW_REQUESTED' };
  if (!ACTIONS[action]) return res.status(400).json({ error: 'Invalid action' });

  let preferredDate = null;
  let interviewerEmailList = [];
  if (action === 'REQUEST_INTERVIEW') {
    if (!preferredAt) return res.status(400).json({ error: 'Please choose a preferred date and time for the interview' });
    preferredDate = new Date(preferredAt);
    if (isNaN(preferredDate.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

    const { valid, invalid } = parseEmails(interviewerEmails);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `These don't look like valid email addresses: ${invalid.join(', ')}` });
    }
    if (valid.length === 0) {
      return res.status(400).json({ error: 'Enter the email address of at least one person who will take the interview.' });
    }
    interviewerEmailList = valid;
  }

  const share = await prisma.profileShare.findUnique({
    where: { id: req.params.id },
    include: { sentByUser: { select: { email: true } }, candidate: { select: { firstName: true, lastName: true } }, job: true },
  });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  if ((action === 'SHORTLIST' || action === 'REJECT') && !share.jobId) {
    return res.status(400).json({ error: 'This share has no associated job order — ask Al Khadim staff to re-share against a specific job to shortlist or reject.' });
  }

  const newStatus = nextStatus(share.status, ACTIONS[action]);

  await prisma.$transaction(async (tx) => {
    await tx.profileShare.update({
      where: { id: share.id },
      data: {
        status: newStatus,
        respondedByClientUserId: req.clientUser.id,
        respondedAt: new Date(),
      },
    });
    await tx.profileShareEvent.create({
      data: {
        shareId: share.id,
        eventType: ACTIONS[action],
        actorType: 'CLIENT_USER',
        actorId: req.clientUser.id,
        actorName: req.clientUser.name,
        metadata: action === 'REQUEST_INTERVIEW'
          ? { preferredAt: preferredDate.toISOString(), reason: reason || null, interviewerEmails: interviewerEmailList }
          : (reason ? { reason } : null),
      },
    });
    if (action === 'SHORTLIST' || action === 'REJECT') {
      await tx.candidateJob.upsert({
        where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
        update: { status: newStatus },
        create: { candidateId: share.candidateId, jobId: share.jobId, status: newStatus },
      });
    }
  });

  const candidateName = `${share.candidate.firstName} ${share.candidate.lastName}`;
  const verb = action === 'SHORTLIST' ? 'shortlisted' : action === 'REJECT' ? 'rejected' : 'requested an interview for';
  const preferredNote = action === 'REQUEST_INTERVIEW'
    ? ` Preferred time: ${preferredDate.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' })}. Interviewer(s): ${interviewerEmailList.join(', ')}.`
    : '';
  await notifyStaff(
    { ...share, sentByUser: share.sentByUser },
    `${req.client.companyName} ${verb} ${candidateName}`,
    `${req.clientUser.name} at ${req.client.companyName} ${verb} ${candidateName}${share.job ? ` for ${share.job.title}` : ''}.${preferredNote}${reason ? ` Note: ${reason}` : ''}`
  );

  res.json({ status: newStatus });
});

/* Industry tracking Al Khadim has made visible to this company for the
 * shared candidate (independent of which job/fields were shared). */
router.get('/mine/:id/tracking', authenticateApprovedClient, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { id: req.params.id } });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  const records = await prisma.candidateTracking.findMany({
    where: { candidateId: share.candidateId, visibility: 'PUBLIC', visibleToCompany: true },
    select: { id: true, industry: { select: { key: true, name: true, color: true } }, data: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(records);
});

/* Verified documents Al Khadim has made visible to this company for the
 * shared candidate. */
router.get('/mine/:id/document-requests', authenticateApprovedClient, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { id: req.params.id } });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  const requests = await prisma.documentRequest.findMany({
    where: { candidateId: share.candidateId, status: 'VERIFIED', visibleToCompany: true },
    select: { id: true, title: true, description: true, verifiedAt: true },
    orderBy: { verifiedAt: 'desc' },
  });
  res.json(requests);
});

router.get('/mine/:id/document-requests/:reqId/download', authenticateApprovedClient, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { id: req.params.id } });
  if (!share || share.clientId !== req.client.id) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });

  const request = await prisma.documentRequest.findUnique({ where: { id: req.params.reqId } });
  if (!request || request.candidateId !== share.candidateId || request.status !== 'VERIFIED' || !request.visibleToCompany || !request.filePath) {
    return res.status(404).json({ error: 'Document not available' });
  }
  res.download(request.filePath, request.title);
});

/* ══════════════ PUBLIC TOKENIZED LINK (no login) ══════════════ */

router.get('/public/:token', publicLimiter, async (req, res) => {
  const share = await prisma.profileShare.findUnique({
    where: { accessToken: req.params.token },
    include: {
      job: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      interviews: { select: INTERVIEW_SELECT, orderBy: { scheduledAt: 'desc' }, take: 1 },
    },
  });
  if (!share) return res.status(404).json({ error: 'This link is invalid' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const updatedStatus = nextStatus(share.status, 'VIEWED');
  await Promise.all([
    updatedStatus !== share.status
      ? prisma.profileShare.update({ where: { id: share.id }, data: { status: updatedStatus } })
      : Promise.resolve(),
    logEvent(share.id, {
      eventType: 'VIEWED',
      actorType: 'ANONYMOUS_TOKEN',
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
    }),
  ]);

  res.json(safeShareView({ ...share, status: updatedStatus }));
});

router.get('/public/:token/documents/:docId/download', publicLimiter, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { accessToken: req.params.token } });
  if (!share) return res.status(404).json({ error: 'This link is invalid' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const doc = (share.snapshotData?.documents || []).find((d) => d.id === req.params.docId);
  if (!doc) return res.status(404).json({ error: 'Document not shared' });

  await logEvent(share.id, {
    eventType: 'DOWNLOADED',
    actorType: 'ANONYMOUS_TOKEN',
    metadata: { documentId: doc.id, ip: req.ip, userAgent: req.headers['user-agent'] },
  });
  const status = nextStatus(share.status, 'DOWNLOADED');
  if (status !== share.status) await prisma.profileShare.update({ where: { id: share.id }, data: { status } });

  res.download(doc.filePath, doc.title);
});

router.get('/public/:token/tracking', publicLimiter, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { accessToken: req.params.token } });
  if (!share) return res.status(404).json({ error: 'This link is invalid' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const records = await prisma.candidateTracking.findMany({
    where: { candidateId: share.candidateId, visibility: 'PUBLIC', visibleToCompany: true },
    select: { id: true, industry: { select: { key: true, name: true, color: true } }, data: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(records);
});

router.get('/public/:token/document-requests', publicLimiter, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { accessToken: req.params.token } });
  if (!share) return res.status(404).json({ error: 'This link is invalid' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const requests = await prisma.documentRequest.findMany({
    where: { candidateId: share.candidateId, status: 'VERIFIED', visibleToCompany: true },
    select: { id: true, title: true, description: true, verifiedAt: true },
    orderBy: { verifiedAt: 'desc' },
  });
  res.json(requests);
});

router.get('/public/:token/document-requests/:reqId/download', publicLimiter, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { accessToken: req.params.token } });
  if (!share) return res.status(404).json({ error: 'This link is invalid' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This profile is no longer available' });
  if (share.tokenExpiresAt && share.tokenExpiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const request = await prisma.documentRequest.findUnique({ where: { id: req.params.reqId } });
  if (!request || request.candidateId !== share.candidateId || request.status !== 'VERIFIED' || !request.visibleToCompany || !request.filePath) {
    return res.status(404).json({ error: 'Document not available' });
  }
  res.download(request.filePath, request.title);
});

/* ══════════════ STAFF (ADMIN) — :id routes, registered last so they never
   shadow the more specific "/mine" or "/public/..." paths above ══════════════ */

router.get('/:id', authenticate, async (req, res) => {
  const share = await prisma.profileShare.findUnique({
    where: { id: req.params.id },
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
  if (!share) return res.status(404).json({ error: 'Share not found' });
  res.json(share);
});

/* Schedule (or re-schedule) the interview for a share, and notify both sides.
 * If the candidate has no portal login yet, one is created and the temporary
 * password is emailed to the CANDIDATE ONLY — it must never appear in the
 * company-facing email/API response, per the confidentiality requirement. */
router.post('/:id/schedule-interview', authenticate, async (req, res) => {
  try {
    const { scheduledAt, mode, meetLink, location, interviewers, notes } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });
    if (!['ONLINE', 'OFFLINE'].includes(mode)) return res.status(400).json({ error: 'mode must be ONLINE or OFFLINE' });
    if (mode === 'ONLINE' && !meetLink) return res.status(400).json({ error: 'A meeting link is required for an online interview' });
    if (mode === 'OFFLINE' && !location) return res.status(400).json({ error: 'A location is required for an offline interview' });

    const { valid: interviewerEmailList, invalid: invalidInterviewerEmails } = parseEmails(interviewers);
    if (invalidInterviewerEmails.length > 0) {
      return res.status(400).json({ error: `These interviewer entries aren't valid email addresses: ${invalidInterviewerEmails.join(', ')}` });
    }

    const share = await prisma.profileShare.findUnique({
      where: { id: req.params.id },
      include: {
        candidate: true,
        client: { select: { companyName: true, contactPerson: true, email: true } },
        job: { select: { id: true, title: true } },
        respondedByClientUser: { select: { email: true, name: true } },
      },
    });
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This share has been withdrawn' });
    if (!share.jobId) return res.status(400).json({ error: 'This share has no associated job order — interviews must be scheduled against a specific job.' });

    let newAccountPassword = null;
    const { interview, isNewAccount } = await prisma.$transaction(async (tx) => {
      const createdInterview = await tx.interview.create({
        data: {
          candidateId: share.candidateId,
          jobId: share.jobId,
          scheduledAt: new Date(scheduledAt),
          type: mode === 'ONLINE' ? 'VIDEO' : 'IN_PERSON',
          mode,
          meetLink: mode === 'ONLINE' ? meetLink : null,
          location: mode === 'OFFLINE' ? location : null,
          interviewers: interviewerEmailList,
          notes: notes || null,
          profileShareId: share.id,
        },
      });

      await tx.candidateJob.upsert({
        where: { candidateId_jobId: { candidateId: share.candidateId, jobId: share.jobId } },
        update: { status: 'INTERVIEW_SCHEDULED' },
        create: { candidateId: share.candidateId, jobId: share.jobId, status: 'INTERVIEW_SCHEDULED' },
      });

      const newStatus = nextStatus(share.status, 'INTERVIEW_SCHEDULED');
      await tx.profileShare.update({ where: { id: share.id }, data: { status: newStatus } });
      await tx.profileShareEvent.create({
        data: {
          shareId: share.id,
          eventType: 'INTERVIEW_SCHEDULED',
          actorType: 'STAFF',
          actorId: req.user.id,
          actorName: req.user.name,
          metadata: { scheduledAt: createdInterview.scheduledAt.toISOString(), mode, meetLink: meetLink || null, location: location || null },
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
      ? `<p><strong>Meeting link:</strong> <a href="${meetLink}">${meetLink}</a></p>`
      : `<p><strong>Location:</strong> ${location}</p>`;
    const notesBlock = notes ? `<p><strong>Notes:</strong> ${notes}</p>` : '';

    // Candidate email — includes portal credentials ONLY when an account was just created.
    try {
      const accountBlock = isNewAccount
        ? `<p>We've created a candidate portal account for you so you can track this and future opportunities:</p>
           <p>Login: <a href="${candidateLoginUrl}">${candidateLoginUrl}</a><br/>Email: ${share.candidate.email}<br/>Temporary password: <strong>${newAccountPassword}</strong></p>
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
      }))
    );
    const interviewerFailures = interviewerResults
      .map((r, i) => (r.status === 'rejected' ? interviewerEmailList[i] : null))
      .filter(Boolean);
    if (interviewerFailures.length > 0) {
      console.error('schedule-interview: interviewer email(s) failed:', interviewerFailures.join(', '));
    }

    res.status(201).json({
      interview,
      accountCreated: isNewAccount,
      interviewersNotified: interviewerEmailList.length - interviewerFailures.length,
      interviewerFailures,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/resend', authenticate, async (req, res) => {
  const share = await prisma.profileShare.findUnique({
    where: { id: req.params.id },
    include: { client: true, job: { select: { title: true } } },
  });
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(410).json({ error: 'This share has been withdrawn' });
  if (!share.accessToken) return res.status(400).json({ error: 'This share has no access link to resend' });

  const recipient = req.body.toEmail || share.client.email;
  const link = `${WEB_URL}/company/view/${share.accessToken}`;
  await sendTemplatedMail({
    templateSlug: 'profile-share-reminder',
    to: recipient,
    subjectOverride: `Reminder: candidate profile shared with ${share.client.companyName}${share.job ? ` — ${share.job.title}` : ''}`,
    data: { companyName: share.client.companyName, jobTitleBlock: share.job ? ` — ${share.job.title}` : '', viewLink: link },
  });
  await logEvent(share.id, { eventType: 'RESENT', actorType: 'STAFF', actorId: req.user.id, actorName: req.user.name });
  res.json({ message: 'Share resent' });
});

router.patch('/:id/withdraw', authenticate, async (req, res) => {
  const share = await prisma.profileShare.findUnique({ where: { id: req.params.id } });
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'WITHDRAWN') return res.status(400).json({ error: 'Already withdrawn' });

  await prisma.$transaction([
    prisma.profileShare.update({
      where: { id: share.id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnByUserId: req.user.id },
    }),
    prisma.profileShareEvent.create({
      data: { shareId: share.id, eventType: 'WITHDRAWN', actorType: 'STAFF', actorId: req.user.id, actorName: req.user.name },
    }),
  ]);
  res.json({ message: 'Share withdrawn' });
});

module.exports = router;
