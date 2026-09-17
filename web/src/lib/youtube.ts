/** Extract a YouTube video ID from any common URL shape:
 * watch?v=, youtu.be/, /shorts/, /embed/, or a bare 11-char id. */
export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;

  let id: string | null = null;
  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0];
  } else if (parsed.pathname.startsWith('/watch')) {
    id = parsed.searchParams.get('v');
  } else if (parsed.pathname.startsWith('/shorts/')) {
    id = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || null;
  } else if (parsed.pathname.startsWith('/embed/')) {
    id = parsed.pathname.split('/embed/')[1]?.split('/')[0] || null;
  }

  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export function isValidYouTubeUrl(url?: string | null): boolean {
  return !!extractYouTubeId(url);
}

export function getYouTubeEmbedUrl(url?: string | null): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYouTubeThumbnail(url?: string | null): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
