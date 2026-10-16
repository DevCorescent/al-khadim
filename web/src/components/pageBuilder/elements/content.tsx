'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Linkedin, Mail, Minus, Star } from 'lucide-react';
import { PBIcon } from '../icons';
import { Buttons, Eyebrow, Highlight, IconBadge, PBButton, clr, colsVars, href, justify, media, n, usePB } from '../ui';
import type { ElProps } from './basic';

const ratio = (a?: string) => (a && a !== 'auto' ? a : undefined);

/* ─── Count-up ──────────────────────────────────────────────────────────── */

/** Animates a number the first time it scrolls into view. Non-numeric values render as-is. */
export function CountUp({ value, duration = 2, separator = true }: { value: string; duration?: number; separator?: boolean }) {
  const { editing } = usePB();
  const raw = String(value ?? '');
  const target = Number(raw.replace(/,/g, ''));
  const numeric = raw !== '' && Number.isFinite(target);
  const decimals = numeric ? (raw.split('.')[1]?.length || 0) : 0;
  const [shown, setShown] = useState(numeric && !editing && duration > 0 ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!numeric) return;
    if (editing || duration <= 0 || typeof IntersectionObserver === 'undefined') { setShown(target); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - start) / (duration * 1000));
        setShown(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [numeric, target, duration, editing]);
  if (!numeric) return <span>{raw}</span>;
  const fixed = shown.toFixed(decimals);
  const out = separator ? Number(fixed).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : fixed;
  // Keep a 4-digit year like 2017 free of separators.
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{/^(19|20)\d\d$/.test(raw) ? Math.round(shown) : out}</span>;
}

/* ─── Icon box ──────────────────────────────────────────────────────────── */

export function IconBox({ p }: ElProps) {
  const layout = p.layout || 'top';
  const center = layout === 'top' && p.align === 'center';
  const Title = (['h3', 'h4', 'h5', 'p'].includes(p.titleTag) ? p.titleTag : 'h3') as any;
  const icon = <IconBadge name={p.icon} size={n(p.iconSize, 24)} shape={p.shape} look={p.look} color={p.iconColor} bg={p.iconBg} />;
  const url = href(p.href);
  const title = p.title && <Title className="pb-h pb-h-sm" style={{ margin: 0 }}>{p.title}</Title>;
  const body = (
    <>
      {p.text && <p className="pb-muted" style={{ margin: '8px 0 0', lineHeight: 1.65, fontSize: '.95rem' }}>{p.text}</p>}
      {p.linkLabel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontWeight: 600, fontSize: '.9rem', color: 'var(--pb-primary)' }}>{p.linkLabel}<ArrowRight size={15} /></span>}
    </>
  );
  const inner = layout === 'left' ? (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>{icon}<div style={{ minWidth: 0 }}>{title}{body}</div></div>
  ) : layout === 'inline' ? (
    <div><div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 4 }}>{icon}{title}</div>{body}</div>
  ) : (
    <div style={{ textAlign: center ? 'center' : 'left', display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
      <div style={{ marginBottom: 18 }}>{icon}</div>{title}{body}
    </div>
  );
  const card = (
    <div className={`pb-card pb-card-${p.card || 'none'} pb-hover-${p.hoverFx || 'none'}`} style={{ overflow: 'hidden' }}>
      {p.number && <span aria-hidden style={{ position: 'absolute', top: 10, right: 18, fontFamily: 'var(--hp-font-heading)', fontWeight: 800, fontSize: 56, lineHeight: 1, opacity: 0.07 }}>{p.number}</span>}
      {p.badge && <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--pb-gold)', color: 'rgb(var(--hp-ink))' }}>{p.badge}</span>}
      {inner}
    </div>
  );
  return url ? <a href={url} style={{ color: 'inherit', textDecoration: 'none', display: 'block', height: '100%' }}>{card}</a> : card;
}

/* ─── Feature grid ──────────────────────────────────────────────────────── */

export function FeatureGrid({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  return (
    <div className="pb-grid" style={colsVars(p, 'cols', n(p.gap, 20))}>
      {items.map((it, i) => (
        <IconBox key={i} node={{ id: '', type: 'iconBox', props: {} }} p={{
          icon: it.icon, title: it.title, text: it.text, href: it.href, linkLabel: it.href ? 'Learn more' : '',
          layout: p.layout, align: p.align, card: p.card, shape: p.shape, look: 'soft', iconSize: 22, hoverFx: 'lift',
          number: p.numbered ? String(i + 1).padStart(2, '0') : '',
        }} />
      ))}
    </div>
  );
}

/* ─── Image card ────────────────────────────────────────────────────────── */

export function ImageBox({ p }: ElProps) {
  const url = href(p.href);
  const img = media(p.image);
  const ar = ratio(p.aspect) || '4/3';
  const layout = p.layout || 'stacked';
  const Wrap = ({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
    url ? <a href={url} className={className} style={{ color: 'inherit', textDecoration: 'none', display: 'block', height: '100%', ...style }}>{children}</a> : <div className={className} style={{ height: '100%', ...style }}>{children}</div>;
  const picture = (
    <div className={`pb-img-wrap ${p.zoom ? 'pb-img-fx-zoom' : ''}`} style={{ aspectRatio: layout === 'side' ? undefined : ar, height: layout === 'side' ? '100%' : undefined, minHeight: layout === 'side' ? 220 : undefined, borderRadius: 0 }}>
      {img ? <img src={img} alt={p.title || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', position: layout === 'side' ? 'absolute' : undefined, inset: 0 }} /> : <div style={{ position: 'absolute', inset: 0, background: 'var(--pb-faint)' }} />}
    </div>
  );
  const text = (dark = false) => (
    <>
      {p.tag && <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: dark ? 'rgb(var(--hp-gold))' : 'var(--pb-primary)', marginBottom: 8 }}>{p.tag}</span>}
      {p.title && <h3 className="pb-h pb-h-md" style={{ color: dark ? '#fff' : undefined }}>{p.title}</h3>}
      {p.text && <p style={{ margin: '8px 0 0', lineHeight: 1.6, fontSize: '.93rem', color: dark ? 'rgba(255,255,255,.8)' : 'var(--pb-soft)' }}>{p.text}</p>}
      {p.btnLabel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontWeight: 600, fontSize: '.9rem', color: dark ? '#fff' : 'var(--pb-primary)' }}>{p.btnLabel}<ArrowRight size={15} /></span>}
    </>
  );
  if (layout === 'overlay' || layout === 'reveal') {
    return (
      <Wrap className={`pb-card pb-imgbox-${layout} pb-hover-lift`} style={{ overflow: 'hidden', position: 'relative', aspectRatio: ar, height: 'auto' }}>
        <div style={{ position: 'absolute', inset: 0 }}>{picture}</div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(4,16,20,.85))' }} />
        <div className="pb-imgbox-text" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24 }}>{text(true)}</div>
      </Wrap>
    );
  }
  if (layout === 'side') {
    return (
      <Wrap className={`pb-card pb-card-${p.card || 'shadow'} pb-hover-lift`} style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '42% 1fr' }}>
        <div style={{ position: 'relative' }}>{picture}</div>
        <div style={{ padding: 24, alignSelf: 'center' }}>{text()}</div>
      </Wrap>
    );
  }
  return (
    <Wrap className={`pb-card pb-card-${p.card || 'shadow'} pb-hover-lift`} style={{ padding: 0, overflow: 'hidden' }}>
      {picture}
      <div style={{ padding: p.card === 'none' ? '18px 0 0' : 24 }}>{text()}</div>
    </Wrap>
  );
}

/* ─── Counter & stats ───────────────────────────────────────────────────── */

const NUM_SIZE: Record<string, string> = { md: 'clamp(2rem, 3.6cqi, 2.6rem)', lg: 'clamp(2.4rem, 4.6cqi, 3.4rem)', xl: 'clamp(3rem, 6cqi, 4.6rem)' };

export function Counter({ p }: ElProps) {
  const center = p.align === 'center';
  return (
    <div style={{ textAlign: p.align || 'center', display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : p.align === 'right' ? 'flex-end' : 'flex-start' }}>
      {p.icon && <div style={{ marginBottom: 12 }}><IconBadge name={p.icon} size={22} shape="rounded" /></div>}
      <div style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontSize: NUM_SIZE[p.size] || NUM_SIZE.lg, color: clr(p.color) || 'var(--pb-primary)' }}>
        {p.prefix}<CountUp value={p.number} duration={n(p.duration, 2)} separator={p.separator !== false} />{p.suffix}
      </div>
      {p.label && <div style={{ marginTop: 10, fontWeight: 600, fontSize: '.95rem' }}>{p.label}</div>}
      {p.text && <p className="pb-muted" style={{ margin: '6px 0 0', fontSize: '.88rem', lineHeight: 1.55, maxWidth: 280 }}>{p.text}</p>}
    </div>
  );
}

export function Stats({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const style = p.style || 'plain';
  const dark = style === 'dark';
  return (
    <div className={`pb-grid pb-stats-${style}`} style={{ ...colsVars(p, 'cols', style === 'cards' ? 16 : 0), ...(dark ? { background: 'rgb(var(--hp-ink))', color: '#fff', borderRadius: 24, padding: '8px 0' } : {}) }}>
      {items.map((it, i) => (
        <div key={i} className={style === 'cards' ? 'pb-card pb-card-bordered' : ''} style={{ textAlign: p.align || 'center', padding: style === 'cards' ? 24 : '18px 20px', ...(style === 'divided' || dark ? { borderLeft: i ? '1px solid var(--pb-line)' : undefined } : {}) }}>
          {it.icon && <div style={{ marginBottom: 10, display: 'flex', justifyContent: justify(p.align || 'center') }}><IconBadge name={it.icon} size={20} shape="rounded" /></div>}
          <div style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontSize: 'clamp(2.1rem, 4cqi, 3rem)', color: clr(p.color) || (dark ? 'rgb(var(--hp-gold))' : 'var(--pb-primary)') }}>
            <CountUp value={it.number} />{it.suffix}
          </div>
          <div className="pb-muted" style={{ marginTop: 8, fontSize: '.9rem', fontWeight: 500 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Progress ──────────────────────────────────────────────────────────── */

export function Progress({ p }: ElProps) {
  const { editing } = usePB();
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(editing);
  useEffect(() => {
    if (editing || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [editing]);
  const h = n(p.height, 8);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((it, i) => {
        const v = Math.max(0, Math.min(100, n(it.value, 0)));
        const c = clr(it.color) || 'var(--pb-primary)';
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem', fontWeight: 600, marginBottom: 8 }}>
              <span>{it.label}</span>{p.showValue && <span className="pb-muted">{v}%</span>}
            </div>
            <div style={{ height: h, background: 'var(--pb-faint)', borderRadius: p.rounded ? 999 : 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: on ? `${v}%` : 0, background: c, borderRadius: 'inherit', transition: `width 1.4s cubic-bezier(.22,.8,.24,1) ${i * 120}ms`,
                ...(p.striped ? { backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.22) 25%, transparent 25% 50%, rgba(255,255,255,.22) 50% 75%, transparent 75%)', backgroundSize: '20px 20px', animation: 'pb-stripes 1s linear infinite' } : {}),
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Steps / timeline ──────────────────────────────────────────────────── */

export function Steps({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const accent = clr(p.accent) || 'rgb(var(--hp-primary))';
  const marker = (it: any, i: number, size = 52) => {
    if (p.marker === 'icon') return <span className="pb-ibox-icon pb-shape-circle" style={{ width: size, height: size, background: accent, color: '#fff', boxShadow: `0 0 0 6px color-mix(in srgb, ${accent} 14%, transparent)` }}><PBIcon name={it.icon} fallback="Sparkles" size={size * 0.42} /></span>;
    if (p.marker === 'dot') return <span style={{ width: 16, height: 16, borderRadius: 999, background: accent, boxShadow: `0 0 0 5px color-mix(in srgb, ${accent} 18%, transparent)`, display: 'block', flexShrink: 0 }} />;
    return <span className="pb-ibox-icon pb-shape-circle" style={{ width: size, height: size, background: '#fff', color: accent, border: `2px solid ${accent}`, fontWeight: 800, fontFamily: 'var(--hp-font-heading)', fontSize: size * 0.36 }}>{String(i + 1).padStart(2, '0')}</span>;
  };
  const text = (it: any, align: 'left' | 'center' | 'right' = 'left') => (
    <div style={{ textAlign: align }}>
      {it.date && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--pb-gold)', marginBottom: 6 }}>{it.date}</div>}
      <h3 className="pb-h pb-h-sm">{it.title}</h3>
      {it.text && <p className="pb-muted" style={{ margin: '6px 0 0', fontSize: '.93rem', lineHeight: 1.6 }}>{it.text}</p>}
    </div>
  );
  const layout = p.layout || 'horizontal';
  if (layout === 'cards') {
    return (
      <div className="pb-grid" style={{ ['--c-d' as any]: Math.min(4, items.length || 1), ['--c-t' as any]: 2, ['--c-m' as any]: 1, ['--g' as any]: '20px' }}>
        {items.map((it, i) => (
          <div key={i} className="pb-card pb-card-bordered pb-hover-lift">
            <div style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, fontSize: 44, lineHeight: 1, color: accent, opacity: 0.2, marginBottom: 14 }}>{String(i + 1).padStart(2, '0')}</div>
            {text(it)}
          </div>
        ))}
      </div>
    );
  }
  if (layout === 'horizontal') {
    return (
      <div className="pb-grid pb-steps-h" style={{ ['--c-d' as any]: Math.min(5, items.length || 1), ['--c-t' as any]: Math.min(3, items.length || 1), ['--c-m' as any]: 1, ['--g' as any]: '28px', position: 'relative' }}>
        {items.map((it, i) => (
          <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {i < items.length - 1 && <span aria-hidden className="pb-step-line" style={{ position: 'absolute', top: 26, left: 'calc(50% + 34px)', right: 'calc(-50% + 34px - 28px)', borderTop: `2px dashed color-mix(in srgb, ${accent} 35%, transparent)` }} />}
            <div style={{ marginBottom: 18 }}>{marker(it, i)}</div>
            {text(it, 'center')}
          </div>
        ))}
      </div>
    );
  }
  const alt = layout === 'alternating';
  return (
    <div className={`pb-timeline ${alt ? 'is-alt' : ''}`} style={{ position: 'relative', ['--acc' as any]: accent }}>
      <span aria-hidden className="pb-tl-line" style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: `color-mix(in srgb, ${accent} 22%, transparent)` }} />
      {items.map((it, i) => (
        <div key={i} className={`pb-tl-item ${alt && i % 2 ? 'is-right' : ''}`} style={{ position: 'relative', paddingBottom: i < items.length - 1 ? 36 : 0 }}>
          <span className="pb-tl-marker" style={{ position: 'absolute', top: 0 }}>{marker(it, i, 40)}</span>
          <div className="pb-tl-body">{text(it)}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Team ──────────────────────────────────────────────────────────────── */

export function Team({ p }: ElProps) {
  const members: any[] = Array.isArray(p.members) ? p.members : [];
  const style = p.style || 'card';
  const ar = ratio(p.aspect) || '3/4';
  const socials = (m: any, light = false) => (m.linkedin || m.email) && (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: style === 'circle' ? 'center' : undefined }}>
      {m.linkedin && <a href={href(m.linkedin)} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`} className="pb-ibox-icon pb-shape-circle" style={{ width: 32, height: 32, background: light ? 'rgba(255,255,255,.15)' : 'var(--pb-faint)', color: light ? '#fff' : 'var(--pb-primary)' }}><Linkedin size={14} /></a>}
      {m.email && <a href={`mailto:${String(m.email).replace(/[^\w@.+-]/g, '')}`} aria-label={`Email ${m.name}`} className="pb-ibox-icon pb-shape-circle" style={{ width: 32, height: 32, background: light ? 'rgba(255,255,255,.15)' : 'var(--pb-faint)', color: light ? '#fff' : 'var(--pb-primary)' }}><Mail size={14} /></a>}
    </div>
  );
  return (
    <div className="pb-grid" style={colsVars(p, 'cols', 24)}>
      {members.map((m, i) => {
        const photo = media(m.photo);
        if (style === 'circle') {
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ width: 150, height: 150, margin: '0 auto 16px', borderRadius: 999, overflow: 'hidden', boxShadow: '0 0 0 6px rgb(var(--hp-sand)), 0 0 0 7px var(--pb-line)' }}>
                {photo && <img src={photo} alt={m.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <h3 className="pb-h pb-h-sm">{m.name}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--pb-primary)', fontSize: '.88rem', fontWeight: 600 }}>{m.role}</p>
              {m.bio && <p className="pb-muted" style={{ margin: '8px 0 0', fontSize: '.88rem', lineHeight: 1.55 }}>{m.bio}</p>}
              {socials(m)}
            </div>
          );
        }
        if (style === 'overlay') {
          return (
            <div key={i} className="pb-card pb-img-fx-zoom" style={{ position: 'relative', overflow: 'hidden', aspectRatio: ar }}>
              {photo && <img src={photo} alt={m.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .8s' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(4,16,20,.88))' }} />
              <div style={{ position: 'absolute', left: 20, right: 20, bottom: 20, color: '#fff' }}>
                <h3 className="pb-h pb-h-sm" style={{ color: '#fff' }}>{m.name}</h3>
                <p style={{ margin: '4px 0 0', color: 'rgb(var(--hp-gold))', fontSize: '.85rem', fontWeight: 600 }}>{m.role}</p>
                {socials(m, true)}
              </div>
            </div>
          );
        }
        return (
          <div key={i} className={style === 'card' ? 'pb-card pb-card-shadow pb-hover-lift' : ''} style={style === 'card' ? { padding: 0, overflow: 'hidden' } : undefined}>
            <div className="pb-img-wrap pb-img-fx-zoom" style={{ aspectRatio: ar, borderRadius: style === 'minimal' ? 'var(--hp-radius-card)' : 0, background: 'var(--pb-faint)' }}>
              {photo && <img src={photo} alt={m.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ padding: style === 'card' ? '18px 20px 22px' : '14px 0 0' }}>
              <h3 className="pb-h pb-h-sm">{m.name}</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--pb-primary)', fontSize: '.88rem', fontWeight: 600 }}>{m.role}</p>
              {m.bio && <p className="pb-muted" style={{ margin: '8px 0 0', fontSize: '.88rem', lineHeight: 1.55 }}>{m.bio}</p>}
              {socials(m)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Testimonials ──────────────────────────────────────────────────────── */

function Stars({ value }: { value: number }) {
  if (!value) return null;
  return <div style={{ display: 'flex', gap: 2, color: '#F5B301', marginBottom: 14 }}>{Array.from({ length: Math.min(5, value) }).map((_, i) => <Star key={i} size={15} fill="currentColor" strokeWidth={0} />)}</div>;
}

export function Testimonials({ p }: ElProps) {
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const style = p.style || 'card';
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const layout = p.layout || 'grid';
  useEffect(() => {
    if (layout !== 'slider' || !p.autoplay || paused || items.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [layout, p.autoplay, paused, items.length]);

  const cardCls = style === 'card' ? 'pb-card pb-card-shadow' : style === 'bordered' ? 'pb-card pb-card-bordered' : style === 'dark' ? 'pb-card pb-card-dark' : '';
  const card = (t: any, k: number, big = false) => (
    <figure key={k} className={cardCls} style={{ margin: 0, display: 'flex', flexDirection: 'column', height: layout === 'masonry' ? undefined : '100%', padding: style === 'minimal' ? 0 : undefined, textAlign: big ? 'center' : 'left', alignItems: big ? 'center' : undefined }}>
      <Stars value={n(t.rating, 0)} />
      <blockquote style={{ margin: 0, flex: 1, fontSize: big ? 'clamp(1.15rem, 2.2cqi, 1.5rem)' : '1rem', lineHeight: 1.65, fontFamily: big ? 'var(--hp-font-heading)' : undefined, fontWeight: big ? 500 : 400 }}>“{t.quote}”</blockquote>
      <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        {t.photo
          ? <img src={media(t.photo)} alt="" style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover' }} />
          : <span className="pb-ibox-icon pb-shape-circle" style={{ width: 44, height: 44, background: 'color-mix(in srgb, rgb(var(--hp-primary)) 12%, transparent)', color: 'var(--pb-primary)', fontWeight: 700 }}>{String(t.name || '?').slice(0, 1)}</span>}
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: '.93rem' }}>{t.name}</span>
          {t.role && <span style={{ fontSize: '.83rem', opacity: 0.7 }}>{t.role}</span>}
        </span>
      </figcaption>
    </figure>
  );

  if (layout === 'slider') {
    if (!items.length) return null;
    return (
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: 'relative', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'grid' }}>
          {items.map((t, k) => (
            <div key={k} style={{ gridArea: '1 / 1', transition: 'opacity .6s, transform .6s', opacity: k === i ? 1 : 0, transform: k === i ? 'none' : 'translateY(10px)', pointerEvents: k === i ? undefined : 'none' }} aria-hidden={k !== i}>
              {card(t, k, true)}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 24 }}>
            <button type="button" onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous" className="pb-ibox-icon pb-shape-circle" style={{ width: 40, height: 40, border: '1px solid var(--pb-line)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
            <div className="pb-dots pb-dots-dark" style={{ position: 'static' }}>{items.map((_, k) => <button key={k} type="button" className={`pb-dot ${k === i ? 'is-active' : ''}`} onClick={() => setI(k)} aria-label={`Testimonial ${k + 1}`} />)}</div>
            <button type="button" onClick={() => setI((i + 1) % items.length)} aria-label="Next" className="pb-ibox-icon pb-shape-circle" style={{ width: 40, height: 40, border: '1px solid var(--pb-line)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}><ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    );
  }
  return <div className={layout === 'masonry' ? 'pb-masonry' : 'pb-grid'} style={colsVars(p, 'cols', 20)}>{items.map((t, k) => card(t, k))}</div>;
}

/* ─── Pricing ───────────────────────────────────────────────────────────── */

export function Pricing({ p }: ElProps) {
  const plans: any[] = Array.isArray(p.plans) ? p.plans : [];
  const flat = p.style === 'flat';
  return (
    <div className="pb-grid" style={{ ...colsVars(p, 'cols', flat ? 0 : 20), alignItems: 'stretch' }}>
      {plans.map((pl, i) => {
        const feat = !!pl.featured;
        const lines = String(pl.features || '').split('\n').map(s => s.trim()).filter(Boolean);
        return (
          <div key={i} className={flat ? '' : 'pb-card pb-hover-lift'} style={{
            position: 'relative', display: 'flex', flexDirection: 'column', padding: 32,
            ...(feat
              ? { background: 'linear-gradient(160deg, rgb(var(--hp-primary)), rgb(var(--hp-primary-dark)) 60%, rgb(var(--hp-ink)))', color: '#fff', boxShadow: '0 40px 80px -40px rgb(var(--hp-primary) / .8)', transform: flat ? undefined : 'translateY(-8px)' }
              : { background: flat ? 'transparent' : '#fff', color: 'rgb(var(--hp-text))', border: '1px solid var(--pb-line)' }),
            ...(flat ? { borderRadius: 0, borderLeft: i ? undefined : '1px solid var(--pb-line)' } : {}),
          }}>
            {pl.badge && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, background: 'rgb(var(--hp-gold))', color: 'rgb(var(--hp-ink))', whiteSpace: 'nowrap' }}>{pl.badge}</span>}
            <h3 className="pb-h pb-h-sm" style={{ color: 'inherit' }}>{pl.name}</h3>
            {pl.description && <p style={{ margin: '6px 0 0', fontSize: '.9rem', opacity: 0.75, lineHeight: 1.55 }}>{pl.description}</p>}
            <div style={{ margin: '22px 0', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              {p.currency && /\d/.test(pl.price || '') && <span style={{ fontWeight: 700, fontSize: '.95rem', opacity: 0.8 }}>{p.currency}</span>}
              <span style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, fontSize: 'clamp(2.2rem, 4cqi, 2.9rem)', letterSpacing: '-0.03em', lineHeight: 1 }}>{pl.price}</span>
              {pl.period && <span style={{ opacity: 0.7, fontSize: '.9rem' }}>{pl.period}</span>}
            </div>
            <ul style={{ listStyle: 'none', margin: '0 0 26px', padding: 0, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
              {lines.map((l, k) => {
                const off = l.startsWith('-');
                return (
                  <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '.92rem', opacity: off ? 0.5 : 1, textDecoration: off ? 'line-through' : undefined }}>
                    <span style={{ marginTop: 2, color: feat ? 'rgb(var(--hp-gold))' : 'var(--pb-primary)' }}>{off ? <Minus size={16} /> : <Check size={16} strokeWidth={2.6} />}</span>
                    {off ? l.slice(1).trim() : l}
                  </li>
                );
              })}
            </ul>
            {pl.btnLabel && <PBButton b={{ label: pl.btnLabel, href: pl.btnHref, variant: feat ? 'gold' : 'outline' }} size="md" />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Call to action ────────────────────────────────────────────────────── */

export function Cta({ p }: ElProps) {
  const look = p.look || 'brand';
  const dark = ['brand', 'dark', 'image'].includes(look);
  const bg: React.CSSProperties =
    look === 'brand' ? { background: 'linear-gradient(120deg, rgb(var(--hp-primary)), rgb(var(--hp-primary-dark)) 55%, rgb(var(--hp-ink)))' }
      : look === 'dark' ? { background: 'rgb(var(--hp-ink))' }
        : look === 'gold' ? { background: 'linear-gradient(120deg, rgb(var(--hp-gold)), color-mix(in srgb, rgb(var(--hp-gold)) 70%, white))' }
          : look === 'light' ? { background: 'rgb(var(--hp-sand))' }
            : look === 'image' ? { background: `linear-gradient(90deg, rgba(4,16,20,.88), rgba(4,16,20,.55)), center/cover url("${media(p.image)}")` }
              : {};
  const inline = p.layout !== 'stacked';
  const pad = look === 'none' ? 0 : 'clamp(28px, 5cqi, 56px)';
  return (
    <div className="pb-cta" style={{ ...bg, position: 'relative', overflow: 'hidden', borderRadius: 'inherit', color: dark ? '#fff' : 'rgb(var(--hp-text))', padding: pad }}>
      {p.pattern && look !== 'none' && <div aria-hidden className="pb-pattern-arabesque" style={{ position: 'absolute', inset: 0, opacity: 0.35, maskImage: 'linear-gradient(90deg, transparent 30%, #000)' }} />}
      <div className={inline ? 'pb-cta-inline' : ''} style={{ position: 'relative', display: 'flex', flexDirection: inline ? 'row' : 'column', alignItems: inline ? 'center' : 'center', justifyContent: 'space-between', gap: 28, textAlign: inline ? 'left' : 'center', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: inline ? 680 : 760, flex: inline ? '1 1 420px' : undefined }}>
          {p.eyebrow && <span className="pb-eyebrow pb-eyebrow-line" style={{ color: look === 'gold' ? 'rgb(var(--hp-ink))' : undefined }}>{p.eyebrow}</span>}
          {p.title && <h2 className="pb-h pb-h-lg" style={{ color: 'inherit' }}><Highlight text={p.title} cls={dark ? 'pb-hl-gold' : 'pb-hl-color'} /></h2>}
          {p.text && <p style={{ margin: '12px 0 0', fontSize: '1.05rem', lineHeight: 1.6, opacity: 0.82 }}>{p.text}</p>}
        </div>
        <Buttons items={p.buttons} size="lg" align={inline ? 'right' : 'center'} />
      </div>
    </div>
  );
}

/* ─── Hero banner ───────────────────────────────────────────────────────── */

export function Hero({ p }: ElProps) {
  const ov = n(p.overlay, 60) / 100;
  const overlay =
    p.overlayStyle === 'left' ? `linear-gradient(90deg, rgba(4,16,20,${Math.min(0.97, ov + 0.25)}) 0%, rgba(4,16,20,${ov * 0.75}) 50%, rgba(4,16,20,${ov * 0.25}) 100%)`
      : p.overlayStyle === 'bottom' ? `linear-gradient(180deg, rgba(4,16,20,${ov * 0.35}) 0%, rgba(4,16,20,${Math.min(0.97, ov + 0.2)}) 100%)`
        : p.overlayStyle === 'brand' ? `linear-gradient(120deg, rgb(var(--hp-primary-dark) / ${Math.min(0.97, ov + 0.15)}), rgb(var(--hp-ink) / ${ov}))`
          : `rgba(4,16,20,${ov})`;
  const center = p.align === 'center';
  const img = media(p.image), mimg = media(p.imageMobile) || img;
  return (
    <div className="pb-hero" style={{ position: 'relative', minHeight: n(p.height, 620), ['--hm' as any]: `${Math.min(n(p.height, 620), 560)}px`, display: 'flex', alignItems: 'center', overflow: 'hidden', borderRadius: 'inherit', color: '#fff', background: 'rgb(var(--hp-ink))' }}>
      <picture style={{ position: 'absolute', inset: 0 }}>
        {mimg !== img && <source media="(max-width: 767px)" srcSet={mimg} />}
        {img && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} fetchPriority="high" />}
      </picture>
      <div style={{ position: 'absolute', inset: 0, background: overlay }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 1240, margin: '0 auto', padding: 'clamp(110px, 12cqi, 150px) clamp(16px, 4cqi, 48px) clamp(56px, 8cqi, 96px)', display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
        <div style={{ maxWidth: 780 }}>
          <Eyebrow text={p.eyebrow} style="pill" center={center} />
          <h1 className="pb-h pb-h-display" style={{ color: '#fff' }}><Highlight text={p.title} cls="pb-hl-gold" /></h1>
          {p.text && <p style={{ margin: '20px 0 0', fontSize: 'clamp(1.02rem, 1.6cqi, 1.22rem)', lineHeight: 1.65, color: 'rgba(255,255,255,.8)', maxWidth: 620, marginInline: center ? 'auto' : undefined }}>{p.text}</p>}
          <Buttons items={p.buttons} size="lg" align={center ? 'center' : 'left'} style={{ marginTop: 32 }} />
          {Array.isArray(p.badges) && p.badges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginTop: 34, justifyContent: center ? 'center' : undefined }}>
              {p.badges.map((b: any, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.88rem', fontWeight: 600, color: 'rgba(255,255,255,.88)' }}>
                  <PBIcon name={b.icon} fallback="BadgeCheck" size={17} style={{ color: 'rgb(var(--hp-gold))' }} />{b.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {p.scrollHint && <span aria-hidden style={{ position: 'absolute', bottom: 22, left: '50%', marginLeft: -11, width: 22, height: 36, borderRadius: 999, border: '2px solid rgba(255,255,255,.55)' }}><span style={{ position: 'absolute', left: '50%', top: 7, width: 4, height: 8, marginLeft: -2, borderRadius: 4, background: '#fff', animation: 'pb-bob 1.6s ease-in-out infinite' }} /></span>}
    </div>
  );
}
