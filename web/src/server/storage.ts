/**
 * Where uploaded files live: Cloudflare R2 when R2_* is configured, otherwise
 * the local uploads/ folder. Every upload read, write and delete goes through
 * here, so the rest of the app only deals with the stored relative path
 * ("uploads/documents/<uuid>.pdf") — which is also the R2 object key, so the
 * database looks the same either way.
 *
 * With R2 on, a file missing from the bucket is still read from local disk:
 * files uploaded before the switch keep working until they are copied over
 * (scripts/migrate-uploads-to-r2.mjs).
 */
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { absoluteUploadPath } from './upload';

let _client: S3Client | null = null;

/** Bucket name; R2_BUCKET_NAME is accepted too (the name Cloudflare's docs use). */
const bucket = () => process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;

/** R2 is used only when all four settings are present. */
export function r2Enabled(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && bucket());
}

function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
  }
  return _client;
}

/** Validates a stored path (400 outside uploads/) and returns its object key, "uploads/…". */
export function uploadKey(storedPath: string): string {
  const abs = absoluteUploadPath(storedPath);
  const rel = path.relative(path.join(process.cwd(), 'uploads'), abs).split(path.sep).join('/');
  return `uploads/${rel}`;
}

const notFound = () => Object.assign(new Error('File not found'), { code: 'ENOENT' });
const isMissing = (err: any) => err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;

/** Saves a new upload under its stored path. */
export async function putUpload(storedPath: string, data: Buffer, contentType: string): Promise<void> {
  if (r2Enabled()) {
    await client().send(new PutObjectCommand({ Bucket: bucket(), Key: uploadKey(storedPath), Body: data, ContentType: contentType }));
    return;
  }
  const abs = absoluteUploadPath(storedPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
}

/** Reads an upload. Throws an error with code 'ENOENT' when it does not exist anywhere. */
export async function readUpload(storedPath: string): Promise<Buffer> {
  if (r2Enabled()) {
    try {
      const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: uploadKey(storedPath) }));
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (err: any) {
      if (!isMissing(err)) throw err;
      // Not in the bucket yet: fall through to a pre-R2 local copy.
    }
  }
  try {
    return await readFile(absoluteUploadPath(storedPath));
  } catch (err: any) {
    if (err?.code === 'ENOENT') throw notFound();
    throw err;
  }
}

/** Deletes an upload wherever it is. Best effort: never throws. */
export async function deleteUpload(storedPath: string | null | undefined): Promise<void> {
  if (!storedPath) return;
  try {
    if (r2Enabled()) {
      await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: uploadKey(storedPath) })).catch(() => {});
    }
    await unlink(absoluteUploadPath(storedPath)).catch(() => {});
  } catch { /* invalid path: nothing to delete */ }
}

/**
 * Runs `fn` with a real file path for code that needs one (CV text extraction).
 * Locally that is the file itself; with R2 it is a temporary download, removed afterwards.
 */
export async function withLocalCopy<T>(storedPath: string, fn: (absPath: string) => Promise<T>): Promise<T> {
  if (!r2Enabled()) return fn(absoluteUploadPath(storedPath));
  const tmp = path.join(os.tmpdir(), `ak-${randomUUID()}${path.extname(storedPath)}`);
  await writeFile(tmp, await readUpload(storedPath));
  try {
    return await fn(tmp);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
