// Ported from api/src/routes/documentRequests.js
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json, query } from '../http';
import { absoluteUploadPath } from '../upload';
import { sendTemplatedMail } from '../utils/templateRenderer';
import { escapeHtml } from '../validate';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** `Content-Disposition: attachment` like Express's res.download (via the content-disposition package). */
function attachmentHeader(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '?').replace(/["\\]/g, '\\$&');
  if (/^[\x20-\x7e]*$/.test(filename)) return `attachment; filename="${fallback}"`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/* ── List requests for a candidate (staff) ── */
export const list = handler(async (req) => {
  await requirePermission(req, 'documents', 'view', ['candidates', 'view']);
  const { candidateId, trackingId } = query(req);
  if (!candidateId) return json({ error: 'candidateId is required' }, 400);

  const where: any = { candidateId: String(candidateId) };
  if (trackingId) where.trackingId = String(trackingId);

  const requests = await prisma.documentRequest.findMany({
    where,
    include: {
      requestedByUser: { select: { id: true, name: true } },
      verifiedByUser: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });
  return json(requests);
});

/* ── Request a document from a candidate ── */
export const create = handler(async (req) => {
  const user = await requirePermission(req, 'documents', 'upload', ['candidates', 'edit']);
  try {
    const { candidateId, trackingId, title, description } = await body(req);
    if (!candidateId || typeof candidateId !== 'string' || typeof title !== 'string' || !title.trim()) {
      return json({ error: 'candidateId and title are required' }, 400);
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return json({ error: 'description must be text' }, 400);
    }

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return json({ error: 'Candidate not found' }, 404);
    if (trackingId) {
      const tracking = await prisma.candidateTracking.findUnique({ where: { id: String(trackingId) }, select: { candidateId: true } });
      if (!tracking || tracking.candidateId !== candidateId) return json({ error: 'Tracking record not found for this candidate' }, 400);
    }

    const request = await prisma.documentRequest.create({
      data: {
        candidateId, trackingId: trackingId ? String(trackingId) : null, title: title.trim(), description: description || null,
        requestedByUserId: user.id,
      },
    });

    try {
      await sendTemplatedMail({
        templateSlug: 'document-requested',
        to: candidate.email,
        data: {
          firstName: candidate.firstName,
          documentTitle: title,
          descriptionBlock: description ? `<p>${escapeHtml(description)}</p>` : '',
          dashboardUrl: `${WEB_URL}/candidate/dashboard`,
        },
      });
    } catch (mailErr) {
      console.error('documentRequests: email send failed', mailErr);
    }

    return json(request, 201);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Get one request (staff) ── */
export const get = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'view', ['candidates', 'view']);
  const request = await prisma.documentRequest.findUnique({
    where: { id: params.id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      requestedByUser: { select: { id: true, name: true } },
      verifiedByUser: { select: { id: true, name: true } },
    },
  });
  if (!request) return json({ error: 'Request not found' }, 404);
  return json(request);
});

/* ── Staff downloads the uploaded file ── */
export const download = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'view', ['candidates', 'view']);
  const request = await prisma.documentRequest.findUnique({ where: { id: params.id } });
  if (!request || !request.filePath) return json({ error: 'No file uploaded yet' }, 404);

  const abs = absoluteUploadPath(request.filePath);
  let file: Buffer;
  try {
    file = await readFile(abs);
  } catch (err: any) {
    // res.download forwarded a missing file to the error handler as a 404.
    return json({ error: err.message }, err.code === 'ENOENT' ? 404 : 500);
  }
  // Like res.download: Content-Type from the stored file's extension, download name = request title.
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': MIME_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Disposition': attachmentHeader(request.title),
      'Content-Length': String(file.length),
    },
  });
});

/* ── Verify or reject an uploaded document ── */
export const verify = handler<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'documents', 'upload', ['candidates', 'edit']);
  try {
    const { approved, rejectionReason } = await body(req);
    if (typeof approved !== 'boolean') return json({ error: 'approved must be true or false' }, 400);
    const request = await prisma.documentRequest.findUnique({ where: { id: params.id } });
    if (!request) return json({ error: 'Request not found' }, 404);
    if (request.status !== 'UPLOADED') return json({ error: 'Only uploaded documents can be verified' }, 400);

    const updated = await prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        status: approved ? 'VERIFIED' : 'REJECTED',
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
        rejectionReason: approved ? null : (rejectionReason || 'Document rejected'),
      },
    });
    return json(updated);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Toggle whether a verified document is visible to the company ── */
export const setVisibility = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'upload', ['candidates', 'edit']);
  try {
    const { visibleToCompany } = await body(req);
    if (typeof visibleToCompany !== 'boolean') return json({ error: 'visibleToCompany must be true or false' }, 400);
    const updated = await prisma.documentRequest.update({
      where: { id: params.id },
      data: { visibleToCompany },
    });
    return json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Request not found' }, 404);
    return json({ error: err.message }, 400);
  }
});

/* ── Remove a request ── */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'delete');
  try {
    await prisma.documentRequest.delete({ where: { id: params.id } });
    return json({ message: 'Request removed' });
  } catch (err: any) {
    if (err?.code === 'P2025') return json({ error: 'Request not found' }, 404);
    return json({ error: err.message }, 400);
  }
});
