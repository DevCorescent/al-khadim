/**
 * File uploads, standing in for multer (api/src/middleware/upload.js and uploadCsv.js).
 *
 * Files are written to <project>/uploads/<images|documents|misc>/<uuid><ext>.
 * `UploadedFile.path` is the RELATIVE path (e.g. "uploads/images/abc.png"): that
 * is what gets stored in the DB, and the frontend links to `${API_URL}/${path}`,
 * which src/app/uploads/[...path]/route.ts serves. Use `absoluteUploadPath()`
 * to read a stored file back from disk.
 */
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { NextRequest } from 'next/server';
import { HttpError, body as readBody, formFields } from './http';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CSV_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const FOLDERS: Record<string, string> = {
  'image/jpeg': 'images',
  'image/png': 'images',
  'application/pdf': 'documents',
  'application/msword': 'documents',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
};

export interface UploadedFile {
  /** Relative path, e.g. "uploads/documents/<uuid>.pdf" — store this. */
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface CsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Resolves a stored relative upload path to an absolute disk path (refusing paths outside uploads/). */
export function absoluteUploadPath(storedPath: string): string {
  const rel = storedPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//, '');
  const abs = path.resolve(UPLOAD_ROOT, rel);
  if (abs !== UPLOAD_ROOT && !abs.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new HttpError(400, 'Invalid file path');
  }
  return abs;
}

async function saveFile(file: File): Promise<UploadedFile> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new HttpError(400, 'File type not allowed');
  if (file.size > MAX_FILE_SIZE) throw new HttpError(400, 'File too large');
  const folder = FOLDERS[file.type] || 'misc';
  const filename = `${randomUUID()}${path.extname(file.name)}`;
  await mkdir(path.join(UPLOAD_ROOT, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, folder, filename), Buffer.from(await file.arrayBuffer()));
  return {
    path: `uploads/${folder}/${filename}`,
    filename,
    originalname: file.name,
    mimetype: file.type,
    size: file.size,
  };
}

function isMultipart(req: NextRequest) {
  return (req.headers.get('content-type') || '').includes('multipart/form-data');
}

function splitForm(form: FormData) {
  const files: Record<string, File[]> = {};
  form.forEach((value, key) => {
    if (typeof value !== 'string' && (value.size > 0 || value.name)) (files[key] ||= []).push(value);
  });
  return { fields: formFields(form), files };
}

/**
 * Equivalent of `upload.single(field)` / `upload.fields([...])`.
 * Returns the text fields as `body` plus saved files shaped like multer's:
 * `file` for the first file of the first listed field, `files[field][]` for all.
 * Non-multipart requests fall back to the JSON body with no files.
 */
export async function parseUpload(req: NextRequest, fieldNames: string[]) {
  if (!isMultipart(req)) {
    return { body: await readBody(req), file: undefined as UploadedFile | undefined, files: {} as Record<string, UploadedFile[]> };
  }
  const { fields, files: raw } = splitForm(await req.formData());
  const files: Record<string, UploadedFile[]> = {};
  for (const name of fieldNames) {
    if (raw[name]?.length) files[name] = await Promise.all(raw[name].map(saveFile));
  }
  return { body: fields, file: files[fieldNames[0]]?.[0], files };
}

/** Equivalent of `uploadCsv.single(field)`: CSV kept in memory, never written to disk. */
export async function parseCsvUpload(req: NextRequest, fieldName: string) {
  if (!isMultipart(req)) return { body: await readBody(req), file: undefined as CsvFile | undefined };
  const { fields, files } = splitForm(await req.formData());
  const f = files[fieldName]?.[0];
  if (!f) return { body: fields, file: undefined };
  const okMime = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'];
  if (!f.name.toLowerCase().endsWith('.csv') && !okMime.includes(f.type)) {
    throw new HttpError(400, 'Please upload a .csv file');
  }
  if (f.size > MAX_CSV_SIZE) throw new HttpError(400, 'File too large');
  return {
    body: fields,
    file: { originalname: f.name, mimetype: f.type, size: f.size, buffer: Buffer.from(await f.arrayBuffer()) },
  };
}
