/**
 * Documents Al Khadim requests from a company (trade licence, VAT certificate…).
 * A Super Admin creates the request on the client; the company uploads it from
 * the company portal (/company/documents); the Super Admin then approves or
 * rejects it. Both sides see the status of every request.
 */
import { prisma } from '@/lib/prisma';
import { requireApprovedClient, requireStaff } from '../auth';
import { body, handler, json, query } from '../http';
import { parseUpload } from '../upload';
import { fileResponse, wantsInline } from '../utils/fileResponse';
import { sendMail } from '../utils/mailer';
import { escapeHtml } from '../validate';
import { applyChecklist, getChecklist, normaliseChecklist, saveChecklist } from '../utils/onboardingDocuments';
import { deleteUpload } from '../storage';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const STATUSES = ['REQUESTED', 'UPLOADED', 'APPROVED', 'REJECTED'];
const TEXT_MAX = 2000;

const STAFF_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
};

/** What the company portal may see: no storage path, no internal user ids. */
const COMPANY_SELECT = {
  id: true, title: true, description: true, dueDate: true, status: true,
  fileName: true, fileSize: true, mimeType: true, uploadedAt: true, uploadedByName: true,
  reviewedAt: true, reviewNote: true, createdAt: true,
};

async function removeFile(filePath: string | null | undefined) {
  await deleteUpload(filePath);
}

function optionalText(v: any, field: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw Object.assign(new Error(`${field} must be text`), { status: 400 });
  const t = v.trim();
  if (t.length > TEXT_MAX) throw Object.assign(new Error(`${field} is too long`), { status: 400 });
  return t || null;
}

/** Emails every active portal user of the company. Fire-and-forget. */
async function mailCompany(clientId: string, subject: string, html: string) {
  const users = await prisma.clientUser.findMany({ where: { clientId, isActive: true }, select: { email: true } });
  if (!users.length) return;
  await sendMail({ module: 'clients', to: users.map((u) => u.email).join(','), subject, html });
}

async function mailSuperAdmins(subject: string, html: string) {
  const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { email: true } });
  if (!admins.length) return;
  await sendMail({ module: 'clients', to: admins.map((a) => a.email).join(','), subject, html });
}

/* ───────────── Super Admin ───────────── */

/* GET /api/client-documents?clientId=&status= */
export const list = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const q = query(req);
  const where: any = {};
  if (q.clientId) where.clientId = String(q.clientId);
  if (STATUSES.includes(q.status)) where.status = q.status;
  const [data, grouped] = await Promise.all([
    prisma.clientDocumentRequest.findMany({ where, include: STAFF_INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.clientDocumentRequest.groupBy({
      by: ['status'], where: q.clientId ? { clientId: String(q.clientId) } : {}, _count: true,
    }),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of grouped) counts[g.status] = g._count;
  return json({ data, counts });
});

/* POST /api/client-documents  { clientId, title, description?, dueDate? } */
export const create = handler(async (req) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const raw = (await body(req)) || {};
    const title = optionalText(raw.title, 'title');
    if (!raw.clientId || typeof raw.clientId !== 'string' || !title) {
      return json({ error: 'clientId and title are required' }, 400);
    }
    const description = optionalText(raw.description, 'description');
    let dueDate: Date | null = null;
    if (raw.dueDate) {
      dueDate = new Date(raw.dueDate);
      if (isNaN(dueDate.getTime())) return json({ error: 'Invalid due date' }, 400);
    }
    const client = await prisma.client.findUnique({ where: { id: raw.clientId }, select: { id: true, companyName: true } });
    if (!client) return json({ error: 'Client not found' }, 404);

    const doc = await prisma.clientDocumentRequest.create({
      data: { clientId: client.id, title, description, dueDate, requestedById: user.id },
      include: STAFF_INCLUDE,
    });

    mailCompany(client.id, `Document requested: ${title}`,
      `<p>Hello,</p>
       <p>Al Khadim has requested the following document from ${escapeHtml(client.companyName)}:</p>
       <p><strong>${escapeHtml(title)}</strong>${description ? `<br/>${escapeHtml(description)}` : ''}</p>
       ${dueDate ? `<p>Please upload it by <strong>${escapeHtml(dueDate.toLocaleDateString('en-AE', { dateStyle: 'medium' }))}</strong>.</p>` : ''}
       <p><a href="${escapeHtml(`${WEB_URL}/company/documents`)}">Upload it in your company portal</a></p>
       <p>Regards,<br/>Al Khadim</p>`,
    ).catch((e: any) => console.error('[clientDocuments] request email failed:', e.message));

    return json(doc, 201);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* GET /api/client-documents/:id/download */
export const download = handler<{ id: string }>(async (req, { params }) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const doc = await prisma.clientDocumentRequest.findUnique({ where: { id: params.id } });
  if (!doc?.filePath) return json({ error: 'No file uploaded yet' }, 404);
  return fileResponse(doc.filePath, doc.title, { inline: wantsInline(req), mimeType: doc.mimeType });
});

/* POST /api/client-documents/:id/review  { action: 'APPROVE' | 'REJECT', note? } */
export const review = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const raw = (await body(req)) || {};
    if (raw.action !== 'APPROVE' && raw.action !== 'REJECT') return json({ error: 'action must be APPROVE or REJECT' }, 400);
    const note = optionalText(raw.note, 'note');
    if (raw.action === 'REJECT' && !note) return json({ error: 'Please tell the company why it was rejected.' }, 400);

    const doc = await prisma.clientDocumentRequest.findUnique({ where: { id: params.id }, include: { client: { select: { companyName: true } } } });
    if (!doc) return json({ error: 'Not found' }, 404);
    const status = raw.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    // Only an uploaded file can be reviewed; conditional so two reviewers can't both win.
    const { count } = await prisma.clientDocumentRequest.updateMany({
      where: { id: doc.id, status: 'UPLOADED' },
      data: { status, reviewedById: user.id, reviewedAt: new Date(), reviewNote: note },
    });
    if (!count) return json({ error: 'Only an uploaded document awaiting review can be approved or rejected.' }, 409);

    mailCompany(doc.clientId,
      status === 'APPROVED' ? `Document approved: ${doc.title}` : `Document needs re-upload: ${doc.title}`,
      `<p>Hello,</p>
       <p>Your document <strong>${escapeHtml(doc.title)}</strong> was ${status === 'APPROVED' ? '<strong>approved</strong>' : '<strong>not accepted</strong>. Please upload a corrected copy'}.</p>
       ${note ? `<p><strong>Note from Al Khadim:</strong> ${escapeHtml(note)}</p>` : ''}
       <p><a href="${escapeHtml(`${WEB_URL}/company/documents`)}">View your documents</a></p>
       <p>Regards,<br/>Al Khadim</p>`,
    ).catch((e: any) => console.error('[clientDocuments] review email failed:', e.message));

    return json(await prisma.clientDocumentRequest.findUnique({ where: { id: doc.id }, include: STAFF_INCLUDE }));
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* DELETE /api/client-documents/:id — cancels the request and drops any uploaded file */
export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requireStaff(req, 'SUPER_ADMIN');
  const doc = await prisma.clientDocumentRequest.findUnique({ where: { id: params.id } });
  if (!doc) return json({ error: 'Not found' }, 404);
  await prisma.clientDocumentRequest.delete({ where: { id: doc.id } });
  await removeFile(doc.filePath);
  return json({ message: 'Request deleted' });
});

/* GET /api/onboarding-documents — the Super Admin's checklist */
export const getOnboarding = handler(async (req) => {
  await requireStaff(req, 'SUPER_ADMIN');
  return json(await getChecklist());
});

/* PUT /api/onboarding-documents  { autoApply, items: [{ id?, title, description?, dueInDays? }] } */
export const saveOnboarding = handler(async (req) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  try {
    const checklist = normaliseChecklist(await body(req));
    await saveChecklist(checklist, user.id);
    return json(checklist);
  } catch (err: any) {
    return json({ error: err.message }, err.status || 400);
  }
});

/* POST /api/client-documents/apply-checklist  { clientId } — for clients added before the checklist */
export const applyOnboarding = handler(async (req) => {
  const user = await requireStaff(req, 'SUPER_ADMIN');
  const { clientId } = (await body(req)) || {};
  if (!clientId || typeof clientId !== 'string') return json({ error: 'clientId is required' }, 400);
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return json({ error: 'Client not found' }, 404);
  if (!(await getChecklist()).items.length) return json({ error: 'The onboarding checklist is empty. Add documents in Settings first.' }, 400);
  const created = await applyChecklist(client.id, user.id);
  return json({ created });
});

/* ───────────── Company portal ───────────── */

/* GET /api/client-auth/documents */
export const mineList = handler(async (req) => {
  const { client } = await requireApprovedClient(req);
  const data = await prisma.clientDocumentRequest.findMany({
    where: { clientId: client.id }, select: COMPANY_SELECT, orderBy: { createdAt: 'desc' },
  });
  return json(data);
});

/* POST /api/client-auth/documents/:id/upload  (multipart: file) */
export const mineUpload = handler<{ id: string }>(async (req, { params }) => {
  const { client, clientUser } = await requireApprovedClient(req);
  const { file } = await parseUpload(req, ['file']);
  if (!file) return json({ error: 'Please choose a file to upload' }, 400);

  const doc = await prisma.clientDocumentRequest.findUnique({ where: { id: params.id } });
  if (!doc || doc.clientId !== client.id) {
    await removeFile(file.path);
    return json({ error: 'Request not found' }, 404);
  }
  // Upload while requested or rejected; replace while still awaiting review.
  const { count } = await prisma.clientDocumentRequest.updateMany({
    where: { id: doc.id, status: { in: ['REQUESTED', 'REJECTED', 'UPLOADED'] } },
    data: {
      status: 'UPLOADED', filePath: file.path, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype,
      uploadedAt: new Date(), uploadedByClientUserId: clientUser.id, uploadedByName: clientUser.name,
      reviewedById: null, reviewedAt: null, reviewNote: null,
    },
  });
  if (!count) {
    await removeFile(file.path);
    return json({ error: 'This document has already been approved.' }, 409);
  }
  await removeFile(doc.filePath); // the previous (rejected or replaced) copy

  mailSuperAdmins(`Document uploaded: ${doc.title} (${client.companyName})`,
    `<p>${escapeHtml(clientUser.name)} at ${escapeHtml(client.companyName)} uploaded <strong>${escapeHtml(doc.title)}</strong>.</p>
     <p><a href="${escapeHtml(`${WEB_URL}/admin/crm/clients/${client.id}`)}">Review it in the admin panel</a></p>`,
  ).catch((e: any) => console.error('[clientDocuments] upload email failed:', e.message));

  return json(await prisma.clientDocumentRequest.findUnique({ where: { id: doc.id }, select: COMPANY_SELECT }));
});

/* GET /api/client-auth/documents/:id/download */
export const mineDownload = handler<{ id: string }>(async (req, { params }) => {
  const { client } = await requireApprovedClient(req);
  const doc = await prisma.clientDocumentRequest.findUnique({ where: { id: params.id } });
  if (!doc || doc.clientId !== client.id || !doc.filePath) return json({ error: 'File not found' }, 404);
  return fileResponse(doc.filePath, doc.title, { inline: wantsInline(req), mimeType: doc.mimeType });
});
