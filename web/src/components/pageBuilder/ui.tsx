'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { safeHref } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { color } from '@/lib/pageBuilder/css';
import { PBIcon } from './icons';

/* ─── Renderer context ──────────────────────────────────────────────────── */

export interface InlineEdit { id: string; key: string }

export interface PBContextValue {
  editing: boolean;
  slug?: string;
  pageId?: string;
  /** Editor only: the element whose text is being edited on the canvas. */
  inline?: InlineEdit | null;
  onInlineCommit?: (id: string, key: string, value: string) => void;
  openLightbox: (items: LightboxItem[], index?: number) => void;
}

export const PBContext = createContext<PBContextValue>({ editing: false, openLightbox: () => {} });
export const usePB = () => useContext(PBContext);

/* ─── Raw HTML ──────────────────────────────────────────────────────────── */

/**
 * Renders stored (server-sanitised) HTML. The {__html} object is memoised:
 * React re-writes innerHTML whenever that object is new, which would reset
 * images/iframes and the caret on every render.
 */
export function RawHtml({ html, as: Tag = 'div', ...rest }: { html: string; as?: any; type?: string } & React.HTMLAttributes<HTMLElement>) {
  const inner = useMemo(() => ({ __html: html }), [html]);
  return <Tag {...rest} dangerouslySetInnerHTML={inner} />;
}

/* ─── Small helpers ─────────────────────────────────────────────────────── */

/** Safe link target, or undefined (renders a non-navigating anchor) when empty/unsafe. */
export const href = (v?: string) => safeHref(v) || undefined;
export const media = (v?: string) => mediaUrl(v);
export const clr = (v?: string) => color(v) || undefined;
export const justify = (a?: string) => (a === 'center' ? 'center' : a === 'right' ? 'flex-end' : a === 'justify' ? 'space-between' : 'flex-start');
export const n = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function colsVars(p: any, prefix = 'cols', gap?: number): React.CSSProperties {
  return {
    ['--c-d' as any]: n(p[prefix], 3) || 3,
    ['--c-t' as any]: n(p[`${prefix}Tablet`], 2) || 2,
    ['--c-m' as any]: n(p[`${prefix}Mobile`], 1) || 1,
    ...(gap != null ? { ['--g' as any]: `${gap}px` } : {}),
  };
}

/** Text with *highlighted* words and kept line breaks. */
export function Highlight({ text, cls = 'pb-hl-color' }: { text?: string; cls?: string }) {
  const lines = String(text ?? '').split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, i) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 2
              ? <span key={i} className={cls}>{part.slice(1, -1)}</span>
              : <span key={i}>{part}</span>,
          )}
        </span>
      ))}
    </>
  );
}

export function Eyebrow({ text, style = 'line', center }: { text?: string; style?: string; center?: boolean }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', justifyContent: center ? 'center' : undefined }}>
      <span className={`pb-eyebrow ${style === 'line' ? 'pb-eyebrow-line' : style === 'pill' ? 'pb-eyebrow-pill' : ''}`}>{text}</span>
    </div>
  );
}

export interface ButtonItem { label?: string; href?: string; variant?: string; icon?: string; iconPos?: string; newTab?: boolean; bg?: string; fg?: string; hoverBg?: string }

export function PBButton({ b, size = 'md', shape }: { b: ButtonItem; size?: string; shape?: string }) {
  if (!b?.label) return null;
  const url = href(b.href);
  const radius = shape === 'square' ? '4px' : shape === 'rounded' ? '12px' : shape === 'pill' ? '999px' : undefined;
  const style: React.CSSProperties = {
    ...(radius ? { ['--pb-btn-radius' as any]: radius } : {}),
    ...(b.variant === 'custom' ? { ['--b-bg' as any]: clr(b.bg), ['--b-fg' as any]: clr(b.fg), ['--b-hbg' as any]: clr(b.hoverBg) } : {}),
  };
  const icon = b.icon ? <PBIcon name={b.icon} size={size === 'sm' ? 14 : 16} /> : null;
  const external = /^https?:/i.test(url || '');
  return (
    <a href={url} className={`pb-btn pb-btn-${b.variant || 'primary'} pb-btn-${size}`} style={style}
      {...(b.newTab || external ? { target: b.newTab ? '_blank' : undefined, rel: 'noopener noreferrer' } : {})}>
      {b.iconPos === 'left' && icon}
      <span>{b.label}</span>
      {b.iconPos !== 'left' && icon}
    </a>
  );
}

export function Buttons({ items, size, align, shape, fullWidth, stack = true, fx = 'lift', style }: {
  items?: ButtonItem[]; size?: string; align?: string; shape?: string; fullWidth?: boolean; stack?: boolean; fx?: string; style?: React.CSSProperties;
}) {
  const list = (items || []).filter(b => b?.label);
  if (!list.length) return null;
  return (
    <div className={`pb-btns pb-fx-${fx} ${fullWidth ? 'pb-btns-full' : ''} ${stack ? 'pb-btns-stack' : ''}`} style={{ justifyContent: justify(align), ...style }}>
      {list.map((b, i) => <PBButton key={i} b={b} size={size} shape={shape} />)}
    </div>
  );
}

/** Icon in an optional shape: soft tint, solid, outline or gradient. */
export function IconBadge({ name, size = 24, shape = 'rounded', look = 'soft', color: c, bg, className = '' }: {
  name?: string; size?: number; shape?: string; look?: string; color?: string; bg?: string; className?: string;
}) {
  const fg = clr(c);
  if (!shape || shape === 'none') return <span className={className} style={{ color: fg || 'var(--pb-primary)', display: 'inline-flex' }}><PBIcon name={name} fallback="Sparkles" size={size} /></span>;
  const base = clr(bg);
  const box = Math.round(size * 2.1);
  const style: React.CSSProperties = { width: box, height: box };
  if (look === 'solid') Object.assign(style, { background: base || 'var(--pb-primary)', color: fg || '#fff' });
  else if (look === 'outline') Object.assign(style, { border: `1.5px solid ${base || fg || 'var(--pb-primary)'}`, color: fg || 'var(--pb-primary)' });
  else if (look === 'gradient') Object.assign(style, { background: `linear-gradient(135deg, ${base || 'rgb(var(--hp-primary))'}, rgb(var(--hp-accent)))`, color: fg || '#fff', boxShadow: '0 12px 24px -12px rgb(var(--hp-primary) / .7)' });
  else Object.assign(style, { background: base || 'color-mix(in srgb, rgb(var(--hp-primary)) 11%, transparent)', color: fg || 'var(--pb-primary)' });
  return <span className={`pb-ibox-icon pb-shape-${shape} ${className}`} style={style}><PBIcon name={name} fallback="Sparkles" size={size} /></span>;
}

/** Element-level failure isolation: one broken element must not blank the page. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/* ─── Lightbox ──────────────────────────────────────────────────────────── */

export interface LightboxItem { src?: string; caption?: string; video?: string; html?: string; title?: string; width?: string }

export function Lightbox({ items, index, onClose }: { items: LightboxItem[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const go = useCallback((d: number) => setI(x => (x + d + items.length) % items.length), [items.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);
  const it = items[i];
  if (!it) return null;
  return createPortal(
    <div className="pb-lightbox" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {it.html != null ? (
        <div className="pb-modal" style={{ ['--mw' as any]: it.width === 'sm' ? '460px' : it.width === 'lg' ? '920px' : '640px' }}>
          <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}><X size={20} /></button>
          {it.title && <h3 className="pb-h pb-h-md" style={{ marginBottom: '1rem', paddingRight: '2rem' }}>{it.title}</h3>}
          <RawHtml className="pb-prose pb-prose-md" html={it.html} />
        </div>
      ) : it.video ? (
        /\.(mp4|webm|ogg)(\?|$)/i.test(it.video)
          ? <video src={it.video} controls autoPlay playsInline />
          : <iframe src={it.video} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Video" />
      ) : (
        <img src={media(it.src)} alt={it.caption || ''} />
      )}
      <button type="button" className="pb-lightbox-btn" style={{ top: 18, right: 18 }} onClick={onClose} aria-label="Close"><X size={20} /></button>
      {items.length > 1 && (
        <>
          <button type="button" className="pb-lightbox-btn" style={{ left: 18, top: '50%' }} onClick={() => go(-1)} aria-label="Previous"><ChevronLeft size={22} /></button>
          <button type="button" className="pb-lightbox-btn" style={{ right: 18, top: '50%' }} onClick={() => go(1)} aria-label="Next"><ChevronRight size={22} /></button>
        </>
      )}
      {it.caption && <p className="pb-lightbox-cap">{it.caption}{items.length > 1 ? ` · ${i + 1} / ${items.length}` : ''}</p>}
    </div>,
    document.body,
  );
}

/* ─── Video URLs ────────────────────────────────────────────────────────── */

export function embedUrl(raw?: string, opts: { autoplay?: boolean; loop?: boolean; controls?: boolean; mute?: boolean; background?: boolean } = {}): { kind: 'youtube' | 'vimeo' | 'file' | 'none'; src: string } {
  const url = String(raw || '').trim();
  if (!url) return { kind: 'none', src: '' };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (opts.autoplay || opts.background) q.set('autoplay', '1');
    if (opts.mute || opts.autoplay || opts.background) q.set('mute', '1');
    if (opts.loop || opts.background) { q.set('loop', '1'); q.set('playlist', yt[1]); }
    if (opts.controls === false || opts.background) q.set('controls', '0');
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?${q}` };
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) {
    const q = new URLSearchParams({ dnt: '1' });
    if (opts.autoplay || opts.background) { q.set('autoplay', '1'); q.set('muted', '1'); }
    if (opts.loop || opts.background) q.set('loop', '1');
    if (opts.background) q.set('background', '1');
    return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vm[1]}?${q}` };
  }
  const safe = href(url);
  return !safe ? { kind: 'none', src: '' } : { kind: 'file', src: media(safe) };
}
