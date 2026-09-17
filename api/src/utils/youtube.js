/** Extract a YouTube video ID from any common URL shape:
 * watch?v=, youtu.be/, /shorts/, /embed/. Returns null if not a valid-looking
 * YouTube URL/ID (11-char base64url id). */
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Bare 11-char video id
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null;

  let id = null;
  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0];
  } else if (parsed.pathname.startsWith('/watch')) {
    id = parsed.searchParams.get('v');
  } else if (parsed.pathname.startsWith('/shorts/')) {
    id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
  } else if (parsed.pathname.startsWith('/embed/')) {
    id = parsed.pathname.split('/embed/')[1]?.split('/')[0];
  }

  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function isValidYouTubeUrl(url) {
  return !!extractYouTubeId(url);
}

module.exports = { extractYouTubeId, isValidYouTubeUrl };
