/**
 * Normalises a stored media URL for use in the browser.
 *
 * Image uploads used to be saved with the absolute URL of whichever host
 * performed the upload (`http://localhost:3000/uploads/...`), so a row written
 * on a dev machine points at that machine forever — the image silently breaks
 * on every other origin. New uploads are stored root-relative, but existing
 * rows still hold absolute values, so anything aimed at our own /uploads path
 * is reduced to a path here. Genuinely external URLs (Unsplash, a CDN) and
 * data URIs are returned untouched.
 */
export function mediaUrl(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('/') || value.startsWith('data:')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith('/uploads/')) return `${parsed.pathname}${parsed.search}`;
    } catch {
      // Unparseable — hand it back and let the <img> onError fallback deal with it.
    }
  }
  return value;
}
