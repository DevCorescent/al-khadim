/**
 * Saving and previewing files fetched through an authenticated axios call.
 *
 * Portal downloads go through axios (they need a Bearer token), so the browser
 * never sees the response headers itself and both the type and the filename
 * have to be carried over by hand:
 *
 *  - `new Blob([res.data])` with no `type` produces a typeless blob, so the
 *    saved file has no MIME type no matter what the server sent.
 *  - `a.download = title` uses a human title with no extension, so the file
 *    lands as "CV - Jane Doe" and the OS treats it as plain text.
 *
 * Both are read off the response here instead.
 */
import type { AxiosResponse } from 'axios';

/** Reads the server's filename from Content-Disposition, preferring the RFC 5987 form. */
export function filenameFromResponse(res: AxiosResponse, fallback = 'download'): string {
  const header = String(res.headers?.['content-disposition'] ?? '');

  const star = /filename\*=(?:UTF-8|utf-8)''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through to the plain form */
    }
  }

  const plain = /filename="([^"]*)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  const name = plain?.[1]?.trim().replace(/\\(["\\])/g, '$1');
  return name || fallback;
}

export function mimeFromResponse(res: AxiosResponse): string {
  return String(res.headers?.['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
}

/** Blob carrying the response's real content type, so previews and saves behave. */
export function blobFromResponse(res: AxiosResponse): Blob {
  return new Blob([res.data], { type: mimeFromResponse(res) });
}

/**
 * Saves the response as a file, named as the server intended (extension included).
 * `fallback` is only used when the server sent no Content-Disposition.
 */
export function saveResponseAsFile(res: AxiosResponse, fallback = 'download'): void {
  const url = URL.createObjectURL(blobFromResponse(res));
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFromResponse(res, fallback);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Types a browser renders natively; anything else has to be downloaded. */
const VIEWABLE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'];

export const isViewableMime = (mime?: string | null) => !!mime && VIEWABLE.includes(mime.split(';')[0].trim());

/**
 * Object URL for previewing a fetched file in an <iframe>/<img>. The caller owns
 * the URL and must call `URL.revokeObjectURL` when the preview closes, otherwise
 * the blob is held for the lifetime of the document.
 */
export function previewUrlFromResponse(res: AxiosResponse): string {
  return URL.createObjectURL(blobFromResponse(res));
}
