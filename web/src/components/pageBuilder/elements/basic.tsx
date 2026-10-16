'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Sparkles, Star, X, XCircle } from 'lucide-react';
import type { PBNode } from '@/lib/pageBuilder/types';
import { PBIcon } from '../icons';
import { Buttons, Eyebrow, Highlight, IconBadge, RawHtml, clr, href, justify, media, n, usePB } from '../ui';

export type ElProps = { node: PBNode; p: Record<string, any> };

const textAlign = (a?: string) => (a === 'center' || a === 'right' || a === 'justify' ? a : 'left') as React.CSSProperties['textAlign'];

/* ─── Inline editing (editor canvas only) ───────────────────────────────── */

/**
 * Renders a contentEditable region while the element is being edited inline.
 * Plain mode keeps text (headings: *asterisks* and line breaks); rich mode keeps HTML.
 */
function InlineEditable({ id, field, initial, rich, className, style, tag: Tag = 'div' }: {
  id: string; field: string; initial: string; rich?: boolean; className?: string; style?: React.CSSProperties; tag?: any;
}) {
  const { onInlineCommit } = usePB();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (rich) el.innerHTML = initial; else el.innerText = initial;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    onInlineCommit?.(id, field, rich ? el.innerHTML : el.innerText.replace(/\n{3,}/g, '\n\n').replace(/\n$/, ''));
  };
  return (
    <Tag ref={ref} className={`${className || ''} pb-inline-editing`} style={{ ...style, outline: 'none', cursor: 'text' }}
      contentEditable suppressContentEditableWarning data-pb-inline
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        if (!rich && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        e.stopPropagation();
      }}
      onPaste={(e: React.ClipboardEvent) => {
        // Paste as plain text so no foreign markup sneaks in.
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }} />
  );
}

/* ─── Heading ───────────────────────────────────────────────────────────── */

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'];

export function Heading({ node, p }: ElProps) {
  const { inline } = usePB();
  const Tag = (HEADING_TAGS.includes(p.tag) ? p.tag : 'h2') as any;
  const size = p.size === 'custom' ? '' : `pb-h-${p.size || 'xl'}`;
  const style: React.CSSProperties = {
    textAlign: textAlign(p.align),
    color: clr(p.color),
    ...(p.highlightColor ? { ['--pb-hl' as any]: clr(p.highlightColor) } : {}),
  };
  const cls = `pb-h ${size} ${p.gradientText ? 'pb-grad-text' : ''}`;
  const editing = inline?.id === node.id && inline.key === 'text';
  const body = <Highlight text={p.text} cls={`pb-hl-${p.highlight || 'color'}`} />;
  const url = href(p.href);
  return (
    <>
      <Eyebrow text={p.eyebrow} style={p.eyebrowStyle} center={p.align === 'center'} />
      {editing
        ? <InlineEditable id={node.id} field="text" initial={String(p.text ?? '')} tag={Tag} className={cls} style={style} />
        : <Tag className={cls} style={style}>{url ? <a href={url}>{body}</a> : body}</Tag>}
    </>
  );
}

/* ─── Rich text ─────────────────────────────────────────────────────────── */

export function Text({ node, p }: ElProps) {
  const { inline } = usePB();
  const cls = `pb-prose pb-prose-${p.size || 'md'} ${p.columns === '2' ? 'pb-cols-2' : p.columns === '3' ? 'pb-cols-3' : ''} ${p.dropCap ? 'pb-dropcap' : ''}`;
  const style: React.CSSProperties = {
    textAlign: textAlign(p.align),
    ...(p.color ? { ['--pb-text-color' as any]: clr(p.color) } : {}),
    ...(p.linkColor ? { ['--pb-link' as any]: clr(p.linkColor) } : {}),
  };
  if (inline?.id === node.id && inline.key === 'html') return <InlineEditable id={node.id} field="html" initial={String(p.html ?? '')} rich className={cls} style={style} />;
  return <RawHtml className={cls} style={style} html={String(p.html ?? '')} />;
}

/* ─── Buttons ───────────────────────────────────────────────────────────── */

export function ButtonsEl({ p }: ElProps) {
  return <Buttons items={p.items} size={p.size} align={p.align} shape={p.shape} fullWidth={p.fullWidth} stack={p.stackMobile} fx={p.hoverFx} />;
}

/* ─── Icon ──────────────────────────────────────────────────────────────── */

export function IconEl({ p }: ElProps) {
  const badge = <IconBadge name={p.icon} size={n(p.size, 40)} shape={p.shape} look={p.look} color={p.color} bg={p.bg} />;
  const url = href(p.href);
  return <div style={{ display: 'flex', justifyContent: justify(p.align) }}>{url ? <a href={url} aria-label={p.icon}>{badge}</a> : badge}</div>;
}

/* ─── Divider ───────────────────────────────────────────────────────────── */

export function Divider({ p }: ElProps) {
  const c = clr(p.color) || 'var(--pb-line)';
  const w = n(p.weight, 1);
  const lineStyle: React.CSSProperties = p.style === 'gradient'
    ? { height: w, background: `linear-gradient(90deg, transparent, ${clr(p.color) || 'rgb(var(--hp-gold))'}, transparent)` }
    : p.style === 'flag'
      ? { height: Math.max(3, w), background: 'linear-gradient(90deg,#C8102E 0 18%,#00732F 18% 45%,#fff 45% 72%,#000 72%)', borderRadius: 4 }
      : { borderTop: `${w}px ${p.style === 'double' ? 'double' : p.style || 'solid'} ${c}`, ...(p.style === 'double' ? { borderTopWidth: Math.max(3, w * 3) } : {}) };
  const line = <div style={{ flex: 1, ...lineStyle }} />;
  const mid = p.label || p.icon || p.style === 'ornament';
  return (
    <div style={{ display: 'flex', justifyContent: justify(p.align) }}>
      <div style={{ width: `${n(p.width, 100)}%`, display: 'flex', alignItems: 'center', gap: 14 }}>
        {line}
        {mid && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: clr(p.color) || 'var(--pb-gold)', fontSize: '.8rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            {p.style === 'ornament' && !p.icon && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /><circle cx="12" cy="12" r="2.2" /></svg>}
            {p.icon && <PBIcon name={p.icon} size={18} />}
            {p.label}
          </span>
        )}
        {mid && line}
      </div>
    </div>
  );
}

export function Spacer() {
  return <div aria-hidden style={{ height: '100%' }} />;
}

/* ─── Icon list ─────────────────────────────────────────────────────────── */

export function IconList({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const size = n(p.iconSize, 18);
  const layout = p.layout || 'vertical';
  const wrap: React.CSSProperties = layout === 'inline'
    ? { display: 'flex', flexWrap: 'wrap', columnGap: n(p.gap, 12) * 2, rowGap: n(p.gap, 12) }
    : layout === 'grid2'
      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 24, rowGap: n(p.gap, 12) }
      : { display: 'flex', flexDirection: 'column', gap: n(p.gap, 12) };
  return (
    <ul style={{ ...wrap, listStyle: 'none', margin: 0, padding: 0, color: clr(p.color) }}>
      {items.map((it, i) => {
        const ic = it.icon || p.icon || 'CheckCircle2';
        const iconEl = p.iconStyle === 'circle'
          ? <IconBadge name={ic} size={Math.max(12, size - 2)} shape="circle" look="soft" color={p.iconColor} />
          : <span style={{ color: clr(p.iconColor) || 'var(--pb-primary)', display: 'inline-flex', marginTop: 2 }}><PBIcon name={ic} size={size} /></span>;
        const content = <span style={{ lineHeight: 1.55 }}>{it.text}</span>;
        const url = href(it.href);
        return (
          <li key={i} style={{ display: 'flex', alignItems: p.iconStyle === 'circle' ? 'center' : 'flex-start', gap: 12, ...(p.divider && layout === 'vertical' && i > 0 ? { borderTop: '1px solid var(--pb-line)', paddingTop: n(p.gap, 12) } : {}) }}>
            {iconEl}
            {url ? <a href={url} style={{ color: 'inherit', textDecoration: 'none' }}>{content}</a> : content}
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Quote ─────────────────────────────────────────────────────────────── */

export function QuoteEl({ p }: ElProps) {
  const center = p.align === 'center';
  const person = (p.cite || p.photo) && (
    <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: center ? 'center' : undefined, marginTop: 18 }}>
      {p.photo && <img src={media(p.photo)} alt="" style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }} />}
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: '.95rem' }}>{p.cite}</span>
        {p.role && <span className="pb-muted" style={{ fontSize: '.85rem' }}>{p.role}</span>}
      </span>
    </figcaption>
  );
  const q = <p style={{ margin: 0, fontFamily: 'var(--hp-font-heading)', fontSize: p.style === 'big' ? 'clamp(1.3rem, 2.4cqi, 1.75rem)' : '1.15rem', lineHeight: 1.5, fontWeight: 500, letterSpacing: '-0.01em' }}>{p.quote}</p>;
  if (p.style === 'bar') return <figure style={{ margin: 0, borderLeft: '3px solid var(--pb-gold)', paddingLeft: 22, textAlign: center ? 'center' : 'left' }}>{q}{person}</figure>;
  if (p.style === 'card') return <figure className="pb-card pb-card-shadow" style={{ margin: 0, textAlign: center ? 'center' : 'left' }}><span style={{ color: 'var(--pb-gold)', fontSize: 48, lineHeight: 0.6, fontFamily: 'Georgia, serif' }}>“</span>{q}{person}</figure>;
  return (
    <figure style={{ margin: 0, textAlign: center ? 'center' : 'left' }}>
      <svg width="44" height="34" viewBox="0 0 44 34" style={{ color: 'var(--pb-gold)', marginBottom: 14, display: center ? 'inline-block' : 'block' }} fill="currentColor"><path d="M0 34V20C0 8.6 6 1.9 17.6 0l1.8 4.6C12.5 6.6 9.6 10.4 9.4 16H18v18H0zm25.6 0V20C25.6 8.6 31.6 1.9 43.2 0L45 4.6c-6.9 2-9.8 5.8-10 11.4h8.6v18H25.6z" /></svg>
      {q}{person}
    </figure>
  );
}

/* ─── Notice ────────────────────────────────────────────────────────────── */

const ALERTS: Record<string, { bg: string; fg: string; Icon: any }> = {
  info: { bg: '#EFF6FF', fg: '#1D4ED8', Icon: Info },
  success: { bg: '#ECFDF3', fg: '#047857', Icon: CheckCircle2 },
  warning: { bg: '#FFFBEB', fg: '#B45309', Icon: AlertTriangle },
  error: { bg: '#FEF2F2', fg: '#B91C1C', Icon: XCircle },
  brand: { bg: 'color-mix(in srgb, rgb(var(--hp-primary)) 9%, white)', fg: 'rgb(var(--hp-primary))', Icon: Sparkles },
};

export function Alert({ p }: ElProps) {
  const [open, setOpen] = useState(true);
  const { editing } = usePB();
  if (!open && !editing) return null;
  const a = ALERTS[p.kind] || ALERTS.info;
  return (
    <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: a.bg, color: '#1f2937', borderRadius: 14, padding: '14px 16px', border: `1px solid color-mix(in srgb, ${a.fg} 22%, transparent)` }}>
      {p.showIcon && <span style={{ color: a.fg, marginTop: 1 }}><a.Icon size={18} /></span>}
      <div style={{ flex: 1, fontSize: '.92rem', lineHeight: 1.55 }}>
        {p.title && <strong style={{ display: 'block', color: a.fg, marginBottom: 2 }}>{p.title}</strong>}
        {p.text}
      </div>
      {p.dismissible && <button type="button" aria-label="Dismiss" onClick={() => setOpen(false)} style={{ background: 'none', border: 0, color: '#6b7280', cursor: 'pointer' }}><X size={16} /></button>}
    </div>
  );
}

/* ─── Rating ────────────────────────────────────────────────────────────── */

export function Rating({ p }: ElProps) {
  const max = Math.max(1, Math.min(10, n(p.max, 5)));
  const value = Math.max(0, Math.min(max, n(p.value, 5)));
  const size = n(p.size, 20);
  const c = clr(p.color) || '#F5B301';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: justify(p.align), flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', gap: 2 }} aria-label={`${value} out of ${max}`}>
        {Array.from({ length: max }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
              <Star size={size} style={{ color: 'color-mix(in srgb, currentColor 18%, transparent)', position: 'absolute' }} fill="currentColor" strokeWidth={0} />
              <span style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, overflow: 'hidden' }}><Star size={size} style={{ color: c }} fill="currentColor" strokeWidth={0} /></span>
            </span>
          );
        })}
      </span>
      {p.label && <span className="pb-muted" style={{ fontSize: '.9rem', fontWeight: 500 }}>{p.label}</span>}
    </div>
  );
}

/* ─── Table ─────────────────────────────────────────────────────────────── */

function cell(v: string) {
  const t = v.trim();
  if (t === '✓' || t.toLowerCase() === 'yes') return <CheckCircle2 size={18} style={{ color: '#059669', display: 'inline' }} />;
  if (t === '✗' || t === '×' || t.toLowerCase() === 'no') return <XCircle size={18} style={{ color: '#cbd5e1', display: 'inline' }} />;
  return t;
}

export function TableEl({ p }: ElProps) {
  const rows = String(p.data || '').split('\n').filter(r => r.trim()).map(r => r.split('|'));
  if (!rows.length) return null;
  const [head, ...body] = rows;
  const hs = p.headerStyle === 'dark' ? { background: 'rgb(var(--hp-ink))', color: '#fff' } : p.headerStyle === 'light' ? { background: 'var(--pb-faint)' } : { background: 'rgb(var(--hp-primary))', color: '#fff' };
  const bd = p.bordered ? '1px solid var(--pb-line)' : undefined;
  return (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--pb-line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.92rem', minWidth: 480 }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...hs, textAlign: i ? 'center' : 'left', padding: '14px 16px', fontWeight: 700, border: bd }}>{h.trim()}</th>)}</tr></thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} style={{ background: p.striped && ri % 2 ? 'var(--pb-faint)' : undefined, borderTop: '1px solid var(--pb-line)' }}>
              {r.map((c, ci) => <td key={ci} style={{ padding: '12px 16px', textAlign: ci ? 'center' : 'left', fontWeight: ci === 0 && p.firstColBold ? 600 : 400, border: bd }}>{cell(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
