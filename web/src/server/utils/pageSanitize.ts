/**
 * Server-side cleaning of page-builder documents. Everything a page renders as
 * HTML (rich text, accordion/tab content, custom HTML) is sanitised here before
 * it is stored, and URL props are stripped of script schemes — the renderer can
 * then trust stored content.
 */
import sanitizeHtml from 'sanitize-html';
import { ELEMENT_BY_TYPE } from '@/lib/pageBuilder/elements';
import { countNodes, normalizeDoc } from '@/lib/pageBuilder/doc';
import type { PBNode, PageDoc } from '@/lib/pageBuilder/types';
import { HttpError } from '../http';

export const MAX_DOC_BYTES = 3 * 1024 * 1024;
const MAX_NODES = 4000;

const SAFE_STYLE = {
  '*': {
    color: [/^[#\w(),.%\s-]+$/],
    'background-color': [/^[#\w(),.%\s-]+$/],
    'text-align': [/^(left|right|center|justify)$/],
    'font-weight': [/^(normal|bold|[1-9]00)$/],
    'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
    'text-decoration': [/^[\w\s-]+$/],
    'font-style': [/^(normal|italic)$/],
  },
};

/** Rich text: formatting, lists, links, images, tables. */
const RICH: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'blockquote',
    'mark', 'span', 'code', 'pre', 'hr', 'img', 'sub', 'sup', 'small', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    '*': ['style', 'class'],
    td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
  },
  allowedStyles: SAFE_STYLE,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attribs) => ({
      tagName: 'a',
      attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs,
    }),
  },
};

/** Custom HTML / embeds: broader markup and https iframes, still no scripts, handlers or forms. */
const EMBED: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags, 'img', 'iframe', 'video', 'audio', 'source', 'picture', 'figure', 'figcaption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'span', 'div',
    'button', 'details', 'summary', 'mark', 'small', 'sub', 'sup', 'hr', 'br', 'del', 'ins', 'kbd', 'time', 'address',
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title', 'role', 'aria-*', 'data-*', 'lang', 'dir'],
    a: ['href', 'target', 'rel', 'name'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'title', 'scrolling'],
    video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'width', 'height', 'preload'],
    audio: ['src', 'controls', 'loop', 'preload'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    time: ['datetime'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'], details: ['open'],
    button: ['type'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { iframe: ['https'], img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  allowIframeRelativeUrls: false,
  // Inline styles are kept for layout, minus anything that can load or run code.
  parseStyleAttributes: false,
  transformTags: {
    '*': (tag, attribs) => {
      if (attribs.style && /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*(javascript|data:text)|behavior\s*:|-moz-binding|@import/i.test(attribs.style)) {
        const { style, ...rest } = attribs;
        return { tagName: tag, attribs: rest };
      }
      return { tagName: tag, attribs };
    },
    button: (tag, attribs) => ({ tagName: 'button', attribs: { ...attribs, type: 'button' } }),
  },
};

export const cleanRichHtml = (html: unknown) => sanitizeHtml(String(html ?? '').slice(0, 200_000), RICH);
export const cleanEmbedHtml = (html: unknown) => sanitizeHtml(String(html ?? '').slice(0, 200_000), EMBED);

const UNSAFE_URL = /^\s*(javascript|vbscript|data(?!:image\/(png|jpe?g|gif|webp|avif);))\s*:/i;

function cleanUrl(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return UNSAFE_URL.test(s) ? '' : s.slice(0, 4000);
}

/** CSS can't contain markup; drop tags (and anything that tries to close the <style> element). */
function cleanCss(css: unknown, max: number): string {
  return String(css ?? '').slice(0, max).replace(/<\/?\s*[a-z!][^>]*>?/gi, '').replace(/</g, '');
}

/** Applies `fn` to `props[key]`, or to `props[list][i][key]` for a dotted "list.key". */
function applyPath(props: Record<string, any>, path: string, fn: (v: unknown) => unknown) {
  const [a, b] = path.split('.');
  if (!b) { if (a in props) props[a] = fn(props[a]); return; }
  if (Array.isArray(props[a])) props[a] = props[a].map((it: any) => (it && typeof it === 'object' ? { ...it, [b]: fn(it[b]) } : it));
}

function cleanNode(n: PBNode) {
  const def = ELEMENT_BY_TYPE[n.type];
  if (def) {
    const props = { ...n.props };
    for (const path of def.html || []) applyPath(props, path, n.type === 'html' ? cleanEmbedHtml : cleanRichHtml);
    for (const path of def.links || []) applyPath(props, path, cleanUrl);
    n.props = props;
  }
  if (n.adv) {
    const a = n.adv;
    n.adv = {
      ...a,
      cssId: a.cssId ? String(a.cssId).replace(/[^\w-]/g, '').slice(0, 60) : undefined,
      cssClass: a.cssClass ? String(a.cssClass).replace(/[^\w\s-]/g, '').slice(0, 200) : undefined,
      customCss: a.customCss ? cleanCss(a.customCss, 20_000) : undefined,
      label: a.label ? String(a.label).slice(0, 80) : undefined,
      ariaLabel: a.ariaLabel ? String(a.ariaLabel).slice(0, 200) : undefined,
    };
  }
  n.children?.forEach(cleanNode);
}

/** Normalises and sanitises a document; throws 400/413 for oversize input. */
export function sanitizePageDoc(raw: unknown): PageDoc {
  const size = Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf8');
  if (size > MAX_DOC_BYTES) throw new HttpError(413, 'This page is too large to save. Remove some content or use smaller embedded images.');
  const doc = normalizeDoc(raw);
  if (countNodes(doc.sections) > MAX_NODES) throw new HttpError(400, `Pages can hold up to ${MAX_NODES} elements`);
  doc.sections.forEach(cleanNode);
  doc.settings.customCss = cleanCss(doc.settings.customCss, 50_000);
  doc.settings.contentWidth = Math.max(640, Math.min(2400, Number(doc.settings.contentWidth) || 1240));
  doc.seo = {
    title: String(doc.seo.title || '').slice(0, 160),
    description: String(doc.seo.description || '').slice(0, 400),
    keywords: String(doc.seo.keywords || '').slice(0, 400),
    ogImage: String(cleanUrl(doc.seo.ogImage) || '').slice(0, 2000),
    noindex: !!doc.seo.noindex,
    canonical: String(cleanUrl(doc.seo.canonical) || '').slice(0, 2000),
  };
  return doc;
}
