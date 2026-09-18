// Ported from api/src/routes/documents.js
import { existsSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { DocumentType } from '@/generated/prisma/client';
import { requirePermission } from '../permissions';
import { HttpError, handler, json, query } from '../http';
import { absoluteUploadPath, parseUpload } from '../upload';
import { pickFields, toDate } from '../validate';

const TYPES = Object.values(DocumentType) as string[];
const FIELDS = ['type', 'title', 'employeeId', 'candidateId', 'notes', 'expiryDate'];

/** Disk path of a stored file, or null when it lies outside uploads/ (e.g. absolute paths saved by the Express API). */
function diskPath(stored: string): string | null {
  try {
    return absoluteUploadPath(stored);
  } catch {
    return null;
  }
}

export const list = handler(async (req) => {
  await requirePermission(req, 'documents', 'view');
  const { employeeId, candidateId, type } = query(req);
  const where: any = {};
  if (employeeId) where.employeeId = employeeId;
  if (candidateId) where.candidateId = candidateId;
  if (type) where.type = type;
  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      candidate: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return json(docs);
});

/** Whitelisted, validated document fields from the upload form. */
async function documentData(body: any) {
  const data: any = pickFields(body || {}, FIELDS);
  if (!data.title || !String(data.title).trim()) throw new HttpError(400, 'title is required');
  if (!TYPES.includes(data.type)) throw new HttpError(400, `type must be one of: ${TYPES.join(', ')}`);
  // The form's "None" option posts an empty id.
  data.employeeId = data.employeeId || null;
  data.candidateId = data.candidateId || null;
  data.expiryDate = toDate(data.expiryDate, 'expiryDate') ?? null;
  if (data.employeeId && !(await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { id: true } }))) {
    throw new HttpError(400, 'Employee not found');
  }
  if (data.candidateId && !(await prisma.candidate.findUnique({ where: { id: data.candidateId }, select: { id: true } }))) {
    throw new HttpError(400, 'Candidate not found');
  }
  return data;
}

export const create = handler(async (req) => {
  const user = await requirePermission(req, 'documents', 'upload');
  const { body, file } = await parseUpload(req, ['file']);
  if (!file) return json({ error: 'File is required' }, 400);
  try {
    const data: any = {
      ...(await documentData(body)),
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: user.name,
    };
    const doc = await prisma.document.create({ data });
    return json(doc, 201);
  } catch (err: any) {
    // Don't leave the stored file behind when the record isn't created.
    const abs = diskPath(file.path);
    if (abs && existsSync(abs)) unlinkSync(abs);
    if (err instanceof HttpError) throw err;
    return json({ error: err.message }, 400);
  }
});

export const download = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'view');
  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return json({ error: 'Document not found' }, 404);

  let data: Buffer;
  try {
    const abs = diskPath(doc.filePath);
    if (!abs) throw new Error('outside uploads/');
    data = await readFile(abs);
  } catch {
    // res.download() passed a 404 error on to the Express error handler
    // (its message exposed the server's disk path, so it isn't echoed here).
    throw new HttpError(404, 'File not found');
  }
  // The title rarely carries an extension; add the stored file's so the download opens.
  const ext = path.extname(doc.filePath);
  const title = doc.title || 'download';
  const name = ext && !title.toLowerCase().endsWith(ext.toLowerCase()) ? `${title}${ext}` : title;
  const asciiName = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Length': String(data.length),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});

export const remove = handler<{ id: string }>(async (req, { params }) => {
  await requirePermission(req, 'documents', 'delete');
  try {
    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return json({ error: 'Document not found' }, 404);
    const abs = diskPath(doc.filePath);
    if (abs && existsSync(abs)) unlinkSync(abs);
    await prisma.document.delete({ where: { id: params.id } });
    return json({ message: 'Document deleted' });
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

// Expiry alerts
export const expiring = handler(async (req) => {
  await requirePermission(req, 'documents', 'view');
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const docs = await prisma.document.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow, gte: new Date() } },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
  return json(docs);
});
