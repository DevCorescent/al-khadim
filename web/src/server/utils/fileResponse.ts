/**
 * Serving stored uploads back to the browser.
 *
 * Two things every download site needs and kept getting wrong:
 *
 *  - The download name comes from a human title ("CV - Jane Doe", "Passport
 *    copy") which carries no file extension, so the browser saved an
 *    extensionless file and the OS guessed at its type (usually text). The
 *    stored file's real extension is appended when the title lacks one.
 *  - `Content-Type` must come from the stored file, not the title, or a PDF
 *    arrives as application/octet-stream and cannot be previewed.
 *
 * `inline` serves the same bytes for viewing in the browser instead of
 * downloading, which is what a document preview needs.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { absoluteUploadPath } from '../upload';
import { json } from '../http';

export const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

/** Types a browser can render itself; anything else is always sent as a download. */
const VIEWABLE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain']);

export const isViewableType = (mime?: string | null) => !!mime && VIEWABLE.has(mime);

/**
 * Download name for a stored file: the human title plus the stored file's
 * extension when the title doesn't already end in it.
 */
export function downloadName(title: string | null | undefined, storedPath: string): string {
  const base = path.basename(String(title || '').trim()) || 'download';
  const ext = path.extname(storedPath);
  if (!ext) return base;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

/** RFC 6266 / 5987 Content-Disposition, with an ASCII fallback for non-ASCII names. */
export function contentDisposition(filename: string, inline = false): string {
  const type = inline ? 'inline' : 'attachment';
  const ascii = filename.replace(/[^\x20-\x7e]/g, '?').replace(/(["\\])/g, '\\$1');
  let header = `${type}; filename="${ascii}"`;
  if (ascii !== filename) {
    const encoded = encodeURIComponent(filename).replace(
      /['()*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    header += `; filename*=UTF-8''${encoded}`;
  }
  return header;
}

interface FileResponseOptions {
  /** Render in the browser instead of downloading. Ignored for types a browser can't display. */
  inline?: boolean;
  /** Stored mime type, preferred over the extension lookup when present. */
  mimeType?: string | null;
}

/**
 * Reads a stored upload and returns it with a correct type, a correct download
 * name, and 404 when the file is missing from disk. Replaces the hand-rolled
 * `res.download` equivalents that were duplicated across controllers.
 */
export async function fileResponse(
  storedPath: string,
  title: string | null | undefined,
  { inline = false, mimeType }: FileResponseOptions = {},
) {
  const abs = absoluteUploadPath(storedPath);
  let data: Buffer;
  try {
    data = await readFile(abs);
  } catch (err: any) {
    return json({ error: err?.code === 'ENOENT' ? 'File not found' : err?.message || 'File not found' }, 404);
  }

  const ext = path.extname(abs).toLowerCase();
  const type = mimeType || MIME_BY_EXT[ext] || 'application/octet-stream';
  const name = downloadName(title, abs);
  // Only offer inline for things the browser can actually render.
  const asInline = inline && isViewableType(type);

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'Content-Disposition': contentDisposition(name, asInline),
      // The bytes are private to this share/candidate — never let a proxy keep them.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** True when the request asked for an inline preview (`?inline=1`). */
export function wantsInline(req: { nextUrl: URL }): boolean {
  const v = req.nextUrl.searchParams.get('inline');
  return v === '1' || v === 'true';
}
