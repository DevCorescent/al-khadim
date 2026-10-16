'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Facebook, Globe, Instagram, Linkedin, Mail, MessageCircle, Minus, Music2, Phone, Plus, Twitter, Youtube } from 'lucide-react';
import { PBIcon } from '../icons';
import { RawHtml, clr, href, justify, media, n, usePB } from '../ui';
import type { ElProps } from './basic';

/* ─── Accordion ─────────────────────────────────────────────────────────── */

export function Accordion({ node, p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const [open, setOpen] = useState<number[]>(p.firstOpen ? [0] : []);
  const style = p.style || 'separated';
  const toggle = (i: number) => setOpen(o => (o.includes(i) ? o.filter(x => x !== i) : p.multiple ? [...o, i] : [i]));
  const active = clr(p.activeColor) || 'var(--pb-primary)';
  const schema = useMemo(() => p.faqSchema ? JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map(it => ({ '@type': 'Question', name: String(it.title || ''), acceptedAnswer: { '@type': 'Answer', text: String(it.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } })),
  }).replace(/</g, '\\u003c') : '', [p.faqSchema, items]);

  const itemStyle = (isOpen: boolean): React.CSSProperties =>
    style === 'separated' ? { background: '#fff', color: 'rgb(var(--hp-text))', borderRadius: 14, border: `1px solid ${isOpen ? active : 'var(--pb-line)'}`, boxShadow: isOpen ? '0 18px 40px -26px rgba(6,30,38,.35)' : undefined }
      : style === 'bordered' ? { borderBottom: '1px solid var(--pb-line)' }
        : style === 'filled' ? { background: isOpen ? 'color-mix(in srgb, rgb(var(--hp-primary)) 7%, transparent)' : 'var(--pb-faint)', borderRadius: 12 }
          : { borderBottom: '1px solid var(--pb-line)' };
  const Icon = ({ isOpen }: { isOpen: boolean }) => {
    if (p.iconType === 'chevron') return <span className="pb-acc-icon is-rot" style={{ color: isOpen ? active : undefined }}><ChevronDown size={20} /></span>;
    if (p.iconType === 'arrow') return <span className="pb-acc-icon" style={{ color: isOpen ? active : undefined, transform: isOpen ? 'rotate(90deg)' : undefined }}><ArrowRight size={18} /></span>;
    return (
      <span className="pb-acc-icon pb-ibox-icon pb-shape-circle" style={{ width: 30, height: 30, background: isOpen ? active : 'var(--pb-faint)', color: isOpen ? '#fff' : 'inherit' }}>
        {isOpen ? <Minus size={15} /> : <Plus size={15} />}
      </span>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: style === 'separated' || style === 'filled' ? 12 : 0, ...(style === 'bordered' ? { border: '1px solid var(--pb-line)', borderRadius: 14, overflow: 'hidden' } : {}) }}>
      {items.map((it, i) => {
        const isOpen = open.includes(i);
        const id = `pb-acc-${node.id}-${i}`;
        return (
          <div key={i} className={`pb-acc-item ${isOpen ? 'is-open' : ''} ${p.iconPos === 'left' ? 'pb-acc-left' : ''}`} style={{ ...itemStyle(isOpen), ...(style === 'bordered' && i === items.length - 1 ? { borderBottom: 0 } : {}) }}>
            <button type="button" className="pb-acc-head" aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(i)} style={{ color: isOpen ? active : undefined, padding: style === 'minimal' ? '1.1rem 0' : undefined }}>
              <span style={{ flex: 1 }}>{it.title}</span>
              <Icon isOpen={isOpen} />
            </button>
            <div className="pb-acc-body" id={id} role="region">
              <div>
                <RawHtml className="pb-prose pb-prose-md" style={{ padding: style === 'minimal' ? '0 0 1.2rem' : '0 1.25rem 1.25rem' }} html={String(it.content || '')} />
              </div>
            </div>
          </div>
        );
      })}
      {schema && <RawHtml as="script" type="application/ld+json" html={schema} />}
    </div>
  );
}

/* ─── Tabs ──────────────────────────────────────────────────────────────── */

export function Tabs({ node, p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const [i, setI] = useState(0);
  const cur = items[Math.min(i, items.length - 1)];
  const vertical = p.layout === 'vertical';
  return (
    <div className={`pb-tabs-${p.style || 'pills'} ${vertical ? 'pb-tabs-vertical' : ''}`} style={{ ['--pb-active' as any]: clr(p.activeColor) }}>
      <div style={{ display: vertical ? 'block' : 'flex', justifyContent: justify(p.align) }}>
        <div className="pb-tabs-nav" role="tablist">
          {items.map((t, k) => (
            <button key={k} type="button" role="tab" id={`pb-tab-${node.id}-${k}`} aria-selected={k === i} className={`pb-tab ${k === i ? 'is-active' : ''}`} onClick={() => setI(k)}
              onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setI((k + 1) % items.length); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setI((k - 1 + items.length) % items.length); }}>
              {t.icon && <PBIcon name={t.icon} size={16} />}{t.title}
            </button>
          ))}
        </div>
      </div>
      {cur && (
        <div key={i} className="pb-tab-panel" role="tabpanel" aria-labelledby={`pb-tab-${node.id}-${i}`} style={{ marginTop: vertical ? 0 : 28, display: cur.image ? 'grid' : 'block', gridTemplateColumns: cur.image ? 'repeat(auto-fit, minmax(260px, 1fr))' : undefined, gap: 32, alignItems: 'center' }}>
          <RawHtml className="pb-prose pb-prose-md" html={String(cur.content || '')} />
          {cur.image && <img src={media(cur.image)} alt="" loading="lazy" style={{ width: '100%', borderRadius: 'var(--hp-radius-card)', objectFit: 'cover', aspectRatio: '4/3' }} />}
        </div>
      )}
    </div>
  );
}

/* ─── Countdown ─────────────────────────────────────────────────────────── */

export function Countdown({ p }: ElProps) {
  const target = useMemo(() => (p.date ? new Date(p.date).getTime() : NaN), [p.date]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!Number.isFinite(target)) return <p className="pb-muted" style={{ textAlign: 'center', fontSize: 13 }}>Set an end date for the countdown</p>;
  const left = Math.max(0, target - (now ?? target));
  if (now != null && left <= 0) return <p style={{ textAlign: p.align || 'center', fontWeight: 600 }}>{p.expiredText}</p>;
  const parts = [
    p.showDays !== false && ['Days', Math.floor(left / 86_400_000)],
    p.showHours !== false && ['Hours', Math.floor(left / 3_600_000) % 24],
    p.showMinutes !== false && ['Minutes', Math.floor(left / 60_000) % 60],
    p.showSeconds !== false && ['Seconds', Math.floor(left / 1000) % 60],
  ].filter(Boolean) as [string, number][];
  const style = p.style || 'boxes';
  return (
    <div style={{ display: 'flex', gap: style === 'plain' ? 'clamp(14px, 4cqi, 28px)' : 'clamp(8px, 2cqi, 14px)', justifyContent: justify(p.align || 'center'), flexWrap: 'wrap' }}>
      {parts.map(([label, v]) => (
        <div key={label} style={{
          textAlign: 'center', minWidth: style === 'plain' ? 0 : 'min(92px, 21cqi)',
          ...(style === 'boxes' ? { padding: '18px 8px', borderRadius: 16, background: clr(p.boxBg) || 'var(--pb-faint)', border: '1px solid var(--pb-line)' } : {}),
          ...(style === 'circles' ? { width: 'min(104px, 21cqi)', height: 'min(104px, 21cqi)', borderRadius: 999, display: 'grid', placeContent: 'center', border: `2px solid ${clr(p.color) || 'rgb(var(--hp-primary))'}`, background: clr(p.boxBg) } : {}),
        }}>
          <div style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, fontSize: 'clamp(2rem, 4cqi, 2.8rem)', lineHeight: 1, letterSpacing: '-0.02em', color: clr(p.color) || 'var(--pb-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {now == null ? '--' : String(v).padStart(2, '0')}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.7 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Popup button ──────────────────────────────────────────────────────── */

export function ModalButton({ p }: ElProps) {
  const { openLightbox, editing } = usePB();
  return (
    <div style={{ display: 'flex', justifyContent: justify(p.align) }}>
      <button type="button" className={`pb-btn pb-btn-${p.variant || 'primary'} pb-btn-md`} onClick={() => !editing && openLightbox([{ html: String(p.content || ''), title: p.title, width: p.width }])}>
        {p.label || 'Open'}
      </button>
    </div>
  );
}

/* ─── Ticker ────────────────────────────────────────────────────────────── */

const TICK_SIZE: Record<string, React.CSSProperties> = {
  sm: { fontSize: '.85rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' },
  md: { fontSize: '1.1rem', fontWeight: 700 },
  lg: { fontSize: 'clamp(1.6rem, 3cqi, 2.4rem)', fontWeight: 800, fontFamily: 'var(--hp-font-heading)', letterSpacing: '-0.02em' },
  xl: { fontSize: 'clamp(2.6rem, 7cqi, 5.5rem)', fontWeight: 800, fontFamily: 'var(--hp-font-heading)', letterSpacing: '-0.03em', color: 'transparent', WebkitTextStroke: '1.5px currentColor' },
};

export function Ticker({ p }: ElProps) {
  const items = String(p.items || '').split('\n').map(s => s.trim()).filter(Boolean);
  const size = TICK_SIZE[p.size] || TICK_SIZE.md;
  if (!items.length) return null;
  const run = (
    <>
      {items.map((t, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 28, paddingRight: 28, whiteSpace: 'nowrap', ...size }}>
          {t}<span style={{ color: 'rgb(var(--hp-gold))', display: 'inline-flex', WebkitTextStroke: 0 }}><PBIcon name={p.separator} fallback="Sparkles" size={p.size === 'xl' ? 36 : p.size === 'lg' ? 24 : 16} /></span>
        </span>
      ))}
    </>
  );
  return (
    <div className={`pb-marquee ${p.reverse ? 'is-reverse' : ''} ${p.pauseOnHover ? 'is-pause' : ''}`} style={{ ['--speed' as any]: `${n(p.speed, 30)}s` }}>
      <div className="pb-marquee-track">{run}{run}</div>
    </div>
  );
}

/* ─── Social icons ──────────────────────────────────────────────────────── */

const NETWORKS: Record<string, { Icon: any; color: string; label: string }> = {
  linkedin: { Icon: Linkedin, color: '#0A66C2', label: 'LinkedIn' },
  instagram: { Icon: Instagram, color: '#E1306C', label: 'Instagram' },
  facebook: { Icon: Facebook, color: '#1877F2', label: 'Facebook' },
  x: { Icon: Twitter, color: '#111111', label: 'X' },
  youtube: { Icon: Youtube, color: '#FF0000', label: 'YouTube' },
  tiktok: { Icon: Music2, color: '#111111', label: 'TikTok' },
  whatsapp: { Icon: MessageCircle, color: '#25D366', label: 'WhatsApp' },
  email: { Icon: Mail, color: '#0F5468', label: 'Email' },
  phone: { Icon: Phone, color: '#0F5468', label: 'Phone' },
  website: { Icon: Globe, color: '#0F5468', label: 'Website' },
};

export function Social({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const size = n(p.size, 18);
  const box = Math.round(size * 2.2);
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: justify(p.align) }}>
      {items.map((it, i) => {
        const net = NETWORKS[it.network] || NETWORKS.website;
        const colors = p.colors || 'theme';
        const style: React.CSSProperties = p.shape === 'plain'
          ? { color: colors === 'brand' ? net.color : 'inherit' }
          : colors === 'brand' ? { background: net.color, color: '#fff' }
            : colors === 'mono' ? { background: 'var(--pb-faint)', color: 'inherit' }
              : colors === 'outline' ? { border: '1.5px solid var(--pb-line)', color: 'inherit' }
                : { background: 'color-mix(in srgb, rgb(var(--hp-primary)) 10%, transparent)', color: 'var(--pb-primary)' };
        const radius = p.shape === 'circle' ? 999 : p.shape === 'rounded' ? 10 : p.shape === 'square' ? 2 : 0;
        return (
          <a key={i} href={href(it.url)} target="_blank" rel="noopener noreferrer" aria-label={net.label}
            style={{ display: 'grid', placeItems: 'center', width: p.shape === 'plain' ? undefined : box, height: p.shape === 'plain' ? undefined : box, borderRadius: radius, transition: 'transform .25s, opacity .25s', ...style }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
            <net.Icon size={size} />
          </a>
        );
      })}
    </div>
  );
}

