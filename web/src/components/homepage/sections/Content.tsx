'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Plus, Quote, Shield, Star } from 'lucide-react';
import { safeHref, type HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import {
  Container, Eyebrow, HpButton, Paragraphs, RichTitle, Section, SectionHeading, sectionTone,
} from '../primitives';
import { Icon } from '../icons';

const list = (v: any) => (Array.isArray(v) ? v : []);
const COLS: Record<string, string> = {
  '2': 'sm:grid-cols-2',
  '3': 'sm:grid-cols-2 lg:grid-cols-3',
  '4': 'sm:grid-cols-2 lg:grid-cols-4',
};

/** A card link when the item has a usable href, a plain block otherwise. */
function MaybeLink({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  const to = safeHref(href);
  return to ? <Link href={to} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

/* ─── Client logos ──────────────────────────────────────────────────────── */

export function Logos({ s }: { s: HomeSection }) {
  const items = list(s.items).filter((c: any) => c?.name || c?.logo);
  const tone = sectionTone(s);
  if (!items.length) return null;
  const tile = (c: any, i: number) => {
    const body = c.logo
      ? <img src={mediaUrl(c.logo)} alt={c.name || ''} loading="lazy" className={`max-h-10 w-auto object-contain transition ${s.grayscale ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''}`} />
      : <span className={`hp-heading text-lg font-semibold whitespace-nowrap transition-colors ${tone === 'dark' ? 'text-white/50 group-hover:text-white' : 'text-hp-text/40 group-hover:text-hp-text'}`}>{c.name}</span>;
    const cls = 'group shrink-0 flex items-center justify-center h-16 px-8';
    const to = safeHref(c.href);
    return to
      ? <a key={i} href={to} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
      : <div key={i} className={cls}>{body}</div>;
  };
  return (
    <Section s={s}>
      <Container>
        {s.title && <p className={`text-center text-xs font-bold uppercase tracking-[0.2em] mb-8 ${tone === 'dark' ? 'text-white/50' : 'text-hp-muted'}`}>{s.title}</p>}
        {s.display === 'grid' ? (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">{items.map(tile)}</div>
        ) : (
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
            <div className="flex w-max hover:[animation-play-state:paused]" style={{ animation: `hpMarquee ${Math.max(20, items.length * 5)}s linear infinite` }}>
              {[...items, ...items].map(tile)}
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}

/* ─── About / Text & image ──────────────────────────────────────────────── */

function MediaSplit({ s, children, badge }: { s: HomeSection; children: React.ReactNode; badge?: React.ReactNode }) {
  const image = mediaUrl(s.image);
  if (!image) return <Container><div className="max-w-3xl">{children}</div></Container>;
  const left = s.imagePosition !== 'right';
  return (
    <Container className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div className={`hp-reveal relative ${left ? '' : 'lg:order-2'}`}>
        <div aria-hidden className={`absolute -top-4 ${left ? '-left-4' : '-right-4'} w-28 h-28 rounded-hp-card bg-hp-gold/25`} />
        <div className="relative aspect-[4/3.4] rounded-[calc(var(--hp-radius-card)*1.4)] overflow-hidden shadow-xl">
          <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
        {badge}
      </div>
      <div className={`hp-reveal ${left ? '' : 'lg:order-1'}`}>{children}</div>
    </Container>
  );
}

export function About({ s }: { s: HomeSection }) {
  const muted = sectionTone(s) === 'dark' ? 'text-white/65' : 'text-hp-muted';
  const tone = sectionTone(s);
  const bullets = list(s.bullets).filter((b: any) => b?.text);
  const badge = (s.badgeValue || s.badgeLabel) ? (
    <div className="absolute -bottom-6 right-6 sm:right-10 bg-hp-primary text-white rounded-hp-card px-6 py-5 shadow-2xl max-w-[220px]">
      {s.badgeValue && <p className="hp-heading text-4xl font-semibold leading-none">{s.badgeValue}</p>}
      {s.badgeLabel && <p className="text-xs text-white/80 mt-2 leading-snug">{s.badgeLabel}</p>}
    </div>
  ) : null;
  return (
    <Section s={s}>
      <MediaSplit s={s} badge={badge}>
        {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
        {s.title && <h2 className="font-semibold leading-[1.12] mb-6" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.8rem)' }}><RichTitle text={s.title} /></h2>}
        {s.subtitle && <p className={`text-lg mb-5 ${muted}`}>{s.subtitle}</p>}
        <div className={`space-y-4 leading-relaxed ${muted}`}><Paragraphs text={s.body} /></div>
        {bullets.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3 mt-8">
            {bullets.map((b: any, i: number) => (
              <li key={i} className={`flex items-start gap-3 text-sm font-medium ${tone === 'dark' ? 'text-white' : 'text-hp-text'}`}>
                <span className="grid place-items-center w-5 h-5 mt-0.5 rounded-full bg-hp-primary text-white shrink-0"><Check size={12} strokeWidth={3} /></span>
                {b.text}
              </li>
            ))}
          </ul>
        )}
        {s.ctaLabel && <div className="mt-9"><HpButton href={s.ctaHref} label={s.ctaLabel} variant={tone === 'dark' ? 'gold' : 'primary'} /></div>}
      </MediaSplit>
    </Section>
  );
}

export const ContentBlock = About;

/* ─── Key figures ───────────────────────────────────────────────────────── */

function Counter({ value, animate }: { value: string; animate: boolean }) {
  const target = Number(String(value).replace(/,/g, ''));
  const numeric = Number.isFinite(target) && String(value).trim() !== '';
  // The real figure is rendered first (server HTML, no-JS, crawlers); it only
  // drops to zero and counts up once the browser can actually animate it.
  const [shown, setShown] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setShown(target);
    const el = ref.current;
    if (!numeric || !animate || !el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setShown(0);
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / 1600, 1);
        setShown(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); setShown(target); };
  }, [target, numeric, animate]);
  return <span ref={ref}>{numeric ? shown.toLocaleString('en-US') : value}</span>;
}

export function Stats({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const items = list(s.items).filter((x: any) => x?.label && String(x.value ?? '').trim());
  if (!items.length) return null;
  if (s.display === 'band') return <StatsBand s={s} items={items} />;
  const cols = items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} />
        <div className={`grid grid-cols-2 ${cols} ${items.length === 5 ? 'xl:grid-cols-5' : items.length >= 6 ? 'xl:grid-cols-6' : ''} gap-y-10`}>
          {items.map((x: any, i: number) => (
            <div key={i} className={`hp-reveal text-center px-4 ${i > 0 ? (tone === 'dark' ? 'lg:border-l lg:border-white/10' : 'lg:border-l lg:border-hp-text/10') : ''}`}>
              <p className={`hp-heading font-semibold leading-none ${tone === 'dark' ? 'text-white' : 'text-hp-primary'}`} style={{ fontSize: 'clamp(2.4rem, 4.5vw, 3.6rem)' }}>
                {x.prefix}<Counter value={String(x.value)} animate={s.animate !== false} />
                <span className="text-hp-gold">{x.suffix}</span>
              </p>
              <p className={`mt-3 text-sm font-semibold ${tone === 'dark' ? 'text-white' : 'text-hp-text'}`}>{x.label}</p>
              {x.description && <p className={`mt-1 text-xs ${tone === 'dark' ? 'text-white/50' : 'text-hp-muted'}`}>{x.description}</p>}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** A low skyline silhouette for the bottom of dark bands. */
function Skyline() {
  return (
    <svg aria-hidden viewBox="0 0 1200 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-14 text-white opacity-[0.05] pointer-events-none">
      <path fill="currentColor" d="M0 120V92h40V70h22v22h26V58h18v34h30V80h20V40h8V20h4v20h8v52h34V66h26v26h22V52h30v40h18V74h28v18h40V30l10-14 10 14v62h24V60h36v32h20V44h22v48h30V70h24v22h34V36h6V8h6v28h6v56h30V64h28v28h22V50h34v42h26V76h30v16h40V56h24v36h20V68h30v24h38V48h26v44h20V80h40v40z" />
    </svg>
  );
}

const BAND_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' };

function StatsBand({ s, items }: { s: HomeSection; items: any[] }) {
  const dark = sectionTone(s) === 'dark';
  return (
    <Section s={s}>
      <Skyline />
      <Container>
        {(s.eyebrow || s.title || s.subtitle) && <SectionHeading s={s} className="mb-10" />}
        <div className={`grid grid-cols-2 ${BAND_COLS[Math.min(6, Math.max(2, items.length))]} gap-x-4 gap-y-6`}>
          {items.map((x: any, i: number) => (
            <div key={i} className={`hp-reveal flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3.5 px-0 sm:px-2 lg:px-5 ${i === items.length - 1 && items.length % 2 ? 'col-span-2 lg:col-span-1' : ''} ${i > 0 ? (dark ? 'lg:border-l lg:border-white/10' : 'lg:border-l lg:border-hp-text/10') : ''}`}>
              <span className="text-hp-gold shrink-0"><Icon name={x.icon} fallback="Star" size={30} strokeWidth={1.3} /></span>
              <div className="min-w-0">
                <p className={`hp-heading font-semibold leading-tight ${dark ? 'text-white' : 'text-hp-text'} ${String(x.value).length > 12 ? 'text-[15px]' : 'text-[22px]'}`}>
                  {x.prefix}<Counter value={String(x.value)} animate={s.animate !== false} /><span className="text-hp-gold">{x.suffix}</span>
                </p>
                <p className={`text-[12px] mt-0.5 leading-snug ${dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ─── Services ──────────────────────────────────────────────────────────── */

export function Services({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.title);
  const style = s.cardStyle || 'outline';
  const action = s.ctaLabel ? <HpButton href={s.ctaHref} label={s.ctaLabel} variant="outline" /> : null;
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} action={s.align === 'center' ? null : action} />
        <div className={`grid grid-cols-1 ${COLS[s.columns] || COLS['4']} gap-5`}>
          {items.map((x: any, i: number) => (
            <MaybeLink key={i} href={x.href}
              className={`hp-reveal group relative flex flex-col overflow-hidden rounded-hp-card transition-all duration-300 hover:-translate-y-1 ${
                style === 'elevated'
                  ? (dark ? 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10' : 'bg-white shadow-[0_2px_20px_-6px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)]')
                  : (dark ? 'border border-white/10 hover:border-hp-gold/60' : 'bg-white border border-hp-text/10 hover:border-hp-primary/40 hover:shadow-xl')
              }`}>
              {style === 'image' && mediaUrl(x.image) && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={mediaUrl(x.image)} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="flex flex-col flex-1 p-6 lg:p-7">
                {!(style === 'image' && mediaUrl(x.image)) && (
                  <span className={`grid place-items-center w-12 h-12 rounded-xl mb-6 transition-colors ${dark ? 'bg-hp-gold/15 text-hp-gold' : 'bg-hp-primary/10 text-hp-primary group-hover:bg-hp-primary group-hover:text-white'}`}>
                    <Icon name={x.icon} size={22} strokeWidth={1.6} />
                  </span>
                )}
                <h3 className={`text-[17px] font-bold mb-2 ${dark ? 'text-white' : 'text-hp-text'}`}>{x.title}</h3>
                {x.description && <p className={`text-sm leading-relaxed flex-1 ${dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.description}</p>}
                {safeHref(x.href) && (
                  <span className={`mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold ${dark ? 'text-hp-gold' : 'text-hp-primary'}`}>
                    Learn more <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </div>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 bg-gradient-to-r from-hp-primary via-hp-gold to-hp-accent" />
            </MaybeLink>
          ))}
        </div>
        {s.align === 'center' && action && <div className="mt-12 text-center">{action}</div>}
      </Container>
    </Section>
  );
}

/* ─── Process ───────────────────────────────────────────────────────────── */

export function Process({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.title);
  const cols = items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} />
        <div className="relative">
          <div aria-hidden className={`hidden lg:block absolute top-8 left-[12%] right-[12%] border-t-2 border-dashed ${dark ? 'border-white/15' : 'border-hp-primary/20'}`} />
          <ol className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-10 lg:gap-8`}>
            {items.map((x: any, i: number) => (
              <li key={i} className="hp-reveal relative text-center" style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="relative inline-flex mb-6">
                  <span className={`grid place-items-center w-16 h-16 rounded-full ring-8 ${dark ? 'bg-hp-ink text-hp-gold ring-hp-ink border border-hp-gold/40' : 'bg-white text-hp-primary ring-white border border-hp-primary/25 shadow-lg'} relative z-10`}>
                    <Icon name={x.icon} size={26} strokeWidth={1.6} />
                  </span>
                  <span className="absolute -top-1 -right-2 z-20 grid place-items-center w-7 h-7 rounded-full bg-hp-accent text-white text-[11px] font-bold shadow">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className={`text-lg font-bold mb-2 ${dark ? 'text-white' : 'text-hp-text'}`}>{x.title}</h3>
                {x.description && <p className={`text-sm leading-relaxed max-w-xs mx-auto ${dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.description}</p>}
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}

/* ─── Industries ────────────────────────────────────────────────────────── */

export function Industries({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.label);
  const action = s.ctaLabel ? <HpButton href={s.ctaHref} label={s.ctaLabel} variant="outline" /> : null;
  const images = s.display === 'images';
  if (s.display === 'strip') {
    return (
      <Section s={s}>
        <Container>
          {s.title && <p className={`hp-reveal text-center text-[11px] sm:text-xs font-semibold uppercase tracking-[0.4em] mb-6 ${dark ? 'text-white/80' : 'text-hp-text'}`}>{s.title.replace(/\*/g, '')}</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none">
            {items.map((x: any, i: number) => (
              <MaybeLink key={i} href={x.href}
                className={`hp-reveal group flex flex-col items-center justify-start gap-2.5 px-2 py-3 text-center xl:border-l first:xl:border-l-0 ${dark ? 'border-white/10' : 'border-hp-text/10'}`}>
                <span className="text-hp-gold transition-transform duration-300 group-hover:-translate-y-1">
                  <Icon name={x.icon} size={28} strokeWidth={1.3} />
                </span>
                <span className={`text-[12px] font-medium leading-tight ${dark ? 'text-white/85 group-hover:text-hp-gold' : 'text-hp-text group-hover:text-hp-primary'} transition-colors`}>{x.label}</span>
              </MaybeLink>
            ))}
          </div>
          {action && <div className="mt-8 text-center">{action}</div>}
        </Container>
      </Section>
    );
  }
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} action={s.align === 'center' ? null : action} />
        <div className={`grid gap-4 ${images ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
          {items.map((x: any, i: number) => images ? (
            <MaybeLink key={i} href={x.href} className="hp-reveal group relative aspect-[4/5] rounded-hp-card overflow-hidden bg-hp-ink">
              {mediaUrl(x.image) && <img src={mediaUrl(x.image)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110" />}
              <div className="absolute inset-0 bg-gradient-to-t from-hp-ink via-hp-ink/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="grid place-items-center w-10 h-10 rounded-lg bg-hp-gold text-hp-ink mb-3"><Icon name={x.icon} size={18} /></span>
                <h3 className="text-white font-bold">{x.label}</h3>
                {x.description && <p className="text-white/65 text-xs mt-1">{x.description}</p>}
              </div>
            </MaybeLink>
          ) : (
            <MaybeLink key={i} href={x.href}
              className={`hp-reveal group flex flex-col gap-4 p-5 rounded-hp-card transition-all duration-300 hover:-translate-y-1 ${dark ? 'bg-white/5 ring-1 ring-white/10 hover:ring-hp-gold/50' : 'bg-white ring-1 ring-hp-text/[0.07] hover:ring-hp-primary/30 hover:shadow-xl'}`}>
              <span className={`grid place-items-center w-11 h-11 rounded-xl transition-colors ${dark ? 'bg-hp-gold/15 text-hp-gold' : 'bg-hp-sand text-hp-primary group-hover:bg-hp-primary group-hover:text-white'}`}>
                <Icon name={x.icon} size={20} strokeWidth={1.6} />
              </span>
              <div>
                <h3 className={`text-sm font-bold leading-snug ${dark ? 'text-white' : 'text-hp-text'}`}>{x.label}</h3>
                {x.description && <p className={`text-xs mt-1 leading-relaxed ${dark ? 'text-white/55' : 'text-hp-muted'}`}>{x.description}</p>}
              </div>
            </MaybeLink>
          ))}
        </div>
        {s.align === 'center' && action && <div className="mt-12 text-center">{action}</div>}
      </Container>
    </Section>
  );
}

/* ─── Why choose us ─────────────────────────────────────────────────────── */

export function Features({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.title);
  const image = mediaUrl(s.image);
  const card = (x: any, i: number) => (
    <div key={i} className={`hp-reveal group relative p-7 rounded-hp-card transition-all duration-300 ${dark ? 'bg-white/5 ring-1 ring-white/10 hover:bg-white/[0.08]' : 'bg-white ring-1 ring-hp-text/[0.07] hover:shadow-xl hover:ring-transparent'}`}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <span className={`grid place-items-center w-12 h-12 rounded-xl ${dark ? 'bg-hp-gold/15 text-hp-gold' : 'bg-hp-primary text-white'}`}>
          <Icon name={x.icon} size={22} strokeWidth={1.6} />
        </span>
        {x.stat && (
          <div className="text-right">
            <p className={`hp-heading text-2xl font-semibold ${dark ? 'text-hp-gold' : 'text-hp-primary'}`}>{x.stat}</p>
            {x.statLabel && <p className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-white/50' : 'text-hp-muted'}`}>{x.statLabel}</p>}
          </div>
        )}
      </div>
      <h3 className={`text-[17px] font-bold mb-2 ${dark ? 'text-white' : 'text-hp-text'}`}>{x.title}</h3>
      {x.description && <p className={`text-sm leading-relaxed ${dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.description}</p>}
    </div>
  );
  return (
    <Section s={s}>
      <Container>
        {image ? (
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-start">
            <div className="lg:sticky lg:top-32">
              <SectionHeading s={{ ...s, align: 'left' }} className="mb-8" />
              <div className="hp-reveal aspect-[4/3] lg:aspect-[4/5] rounded-[calc(var(--hp-radius-card)*1.4)] overflow-hidden shadow-xl">
                <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">{items.map(card)}</div>
          </div>
        ) : (
          <>
            <SectionHeading s={s} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{items.map(card)}</div>
          </>
        )}
      </Container>
    </Section>
  );
}

/* ─── Emirates coverage ─────────────────────────────────────────────────── */

export function Emirates({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.name);
  const metrics = list(s.metrics).filter((m: any) => m?.value && m?.label);
  return (
    <Section s={s}>
      <Container>
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <div>
            <SectionHeading s={{ ...s, align: 'left' }} className="mb-8" />
            {metrics.length > 0 && (
              <div className="hp-reveal grid grid-cols-2 gap-6 mb-9">
                {metrics.map((m: any, i: number) => (
                  <div key={i} className={`border-l-2 pl-4 ${dark ? 'border-hp-gold' : 'border-hp-primary'}`}>
                    <p className={`hp-heading text-3xl font-semibold ${dark ? 'text-white' : 'text-hp-text'}`}>{m.value}</p>
                    <p className={`text-xs mt-1 ${dark ? 'text-white/55' : 'text-hp-muted'}`}>{m.label}</p>
                  </div>
                ))}
              </div>
            )}
            {s.ctaLabel && <div className="hp-reveal"><HpButton href={s.ctaHref} label={s.ctaLabel} variant={dark ? 'gold' : 'primary'} /></div>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((x: any, i: number) => {
              const img = mediaUrl(x.image);
              return (
                <div key={i} className={`hp-reveal group relative overflow-hidden rounded-hp-card p-5 min-h-[132px] flex flex-col justify-end transition-all duration-300 ${
                  i === 0 ? 'sm:col-span-2 sm:min-h-[170px]' : ''} ${dark ? 'bg-white/[0.04] ring-1 ring-white/10 hover:ring-hp-gold/60' : 'bg-white ring-1 ring-hp-text/[0.07] hover:shadow-xl'}`}
                  style={{ transitionDelay: `${i * 60}ms` }}>
                  {img && (
                    <>
                      <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-hp-ink/90 via-hp-ink/40 to-transparent" />
                    </>
                  )}
                  {x.nameArabic && (
                    <p dir="rtl" lang="ar" className={`hp-arabic absolute top-4 right-5 text-2xl font-bold ${img ? 'text-white/30' : dark ? 'text-hp-gold/30' : 'text-hp-primary/15'} transition-colors group-hover:text-hp-gold/70`}>
                      {x.nameArabic}
                    </p>
                  )}
                  <div className="relative">
                    <p className={`font-bold ${img || dark ? 'text-white' : 'text-hp-text'}`}>{x.name}</p>
                    {x.description && <p className={`text-xs mt-0.5 ${img || dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ─── Testimonials ──────────────────────────────────────────────────────── */

const initials = (n: string) => String(n || '')
  .replace(/^(mr|mrs|ms|miss|dr|eng|sheikh|h\.?e)\.?\s+/i, '')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

export function Testimonials({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((t: any) => t?.quote && t?.author);
  if (!items.length) return null;
  const rated = items.filter((t: any) => Number(t.rating) > 0);
  const avg = rated.length ? (rated.reduce((a: number, t: any) => a + Number(t.rating), 0) / rated.length).toFixed(1) : null;
  const action = s.showRating !== false && avg ? (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map(i => <Star key={i} size={16} className="fill-hp-gold text-hp-gold" />)}</div>
      <span className={`hp-heading text-2xl font-semibold ${dark ? 'text-white' : 'text-hp-text'}`}>{avg}</span>
      <span className={`text-sm ${dark ? 'text-white/50' : 'text-hp-muted'}`}>/ {rated.length} {rated.length === 1 ? 'review' : 'reviews'}</span>
    </div>
  ) : null;
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} action={action} />
        <div className="flex lg:grid lg:grid-cols-3 gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 scrollbar-hide">
          {items.map((t: any, i: number) => (
            <figure key={i} className={`hp-reveal snap-start shrink-0 w-[85%] sm:w-[60%] lg:w-auto relative flex flex-col p-7 lg:p-8 rounded-hp-card ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-hp-text/[0.07] shadow-sm'}`}>
              <Quote aria-hidden size={40} className={`absolute top-6 right-6 ${dark ? 'text-hp-gold/20' : 'text-hp-primary/10'}`} />
              {Number(t.rating) > 0 && (
                <div className="flex gap-0.5 mb-4">{Array.from({ length: Number(t.rating) }).map((_, k) => <Star key={k} size={14} className="fill-hp-gold text-hp-gold" />)}</div>
              )}
              <blockquote className={`flex-1 text-[15px] leading-relaxed ${dark ? 'text-white/80' : 'text-hp-text/80'}`}>“{t.quote}”</blockquote>
              <figcaption className={`flex items-center gap-3 mt-6 pt-5 border-t ${dark ? 'border-white/10' : 'border-hp-text/[0.07]'}`}>
                {mediaUrl(t.photo)
                  ? <img src={mediaUrl(t.photo)} alt="" loading="lazy" className="w-11 h-11 rounded-full object-cover" />
                  : <span className="grid place-items-center w-11 h-11 rounded-full bg-hp-primary text-white text-sm font-bold">{initials(t.author)}</span>}
                <div>
                  <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-hp-text'}`}>{t.author}</p>
                  {(t.role || t.company) && <p className={`text-xs ${dark ? 'text-white/50' : 'text-hp-muted'}`}>{[t.role, t.company].filter(Boolean).join(' · ')}</p>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ─── Accreditations ────────────────────────────────────────────────────── */

export function Awards({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.title);
  if (!items.length) return null;
  return (
    <Section s={s}>
      <Container>
        <SectionHeading s={s} />
        <div className="flex flex-wrap justify-center gap-4">
          {items.map((x: any, i: number) => (
            <div key={i} className={`hp-reveal w-[calc(50%-0.5rem)] sm:w-56 flex flex-col items-center text-center p-6 rounded-hp-card ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-hp-text/[0.07]'}`}>
              {mediaUrl(x.image)
                ? <img src={mediaUrl(x.image)} alt="" loading="lazy" className="h-14 w-auto object-contain mb-4" />
                : <span className="grid place-items-center w-14 h-14 rounded-full bg-hp-gold/15 text-hp-gold mb-4 ring-1 ring-hp-gold/30"><Shield size={24} strokeWidth={1.6} /></span>}
              <p className={`text-sm font-bold leading-snug ${dark ? 'text-white' : 'text-hp-text'}`}>{x.title}</p>
              {x.issuer && <p className={`text-[11px] uppercase tracking-wider mt-1.5 ${dark ? 'text-white/50' : 'text-hp-muted'}`}>{x.issuer}</p>}
              {x.year && <p className="text-xs font-bold mt-1 text-hp-gold">{x.year}</p>}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ─── Leadership ────────────────────────────────────────────────────────── */

export function Leadership({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const image = mediaUrl(s.image);
  return (
    <Section s={s}>
      <Container className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-20 items-center">
        <div className="hp-reveal relative max-w-sm mx-auto lg:max-w-none w-full">
          <div aria-hidden className="absolute -inset-3 -translate-x-4 translate-y-4 rounded-[calc(var(--hp-radius-card)*1.5)] border-2 border-hp-gold/50" />
          <div className="relative aspect-[4/5] rounded-[calc(var(--hp-radius-card)*1.5)] overflow-hidden bg-hp-ink">
            {image
              ? <img src={image} alt={s.name || ''} loading="lazy" className="w-full h-full object-cover" />
              : (
                <div className="absolute inset-0 grid place-items-center" style={{ background: 'linear-gradient(150deg, rgb(var(--hp-primary-dark)), rgb(var(--hp-ink)))' }}>
                  <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.08]" />
                  <span className="relative hp-heading text-8xl font-semibold text-hp-gold/90">{initials(s.name)}</span>
                </div>
              )}
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-hp-ink/90 to-transparent">
              <p className="text-white font-bold">{s.name}</p>
              {s.role && <p className="text-white/65 text-xs mt-0.5">{s.role}</p>}
            </div>
          </div>
        </div>
        <div className="hp-reveal">
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <h2 className="font-semibold leading-[1.12] mb-8" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.8rem)' }}><RichTitle text={s.title} /></h2>}
          {s.quote && (
            <blockquote className={`relative pl-6 mb-8 border-l-[3px] border-hp-gold`}>
              <p className={`hp-heading text-xl md:text-2xl font-medium leading-relaxed ${dark ? 'text-white/90' : 'text-hp-text'}`}>“{s.quote}”</p>
            </blockquote>
          )}
          <div className={`space-y-4 leading-relaxed ${dark ? 'text-white/65' : 'text-hp-muted'}`}><Paragraphs text={s.body} /></div>
          {s.signature && <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-hp-gold">— {s.signature}</p>}
          {s.ctaLabel && <div className="mt-8"><HpButton href={s.ctaHref} label={s.ctaLabel} variant="outline" /></div>}
        </div>
      </Container>
    </Section>
  );
}

/* ─── CV upload ─────────────────────────────────────────────────────────── */

export function CvUpload({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const steps = list(s.steps).filter((x: any) => x?.title);
  const image = mediaUrl(s.image);
  return (
    <Section s={s}>
      <Container className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="hp-reveal">
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <h2 className="font-semibold leading-[1.12] mb-5" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.8rem)' }}><RichTitle text={s.title} /></h2>}
          {s.subtitle && <p className={`text-base md:text-lg leading-relaxed mb-9 ${dark ? 'text-white/70' : 'text-hp-muted'}`}>{s.subtitle}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <HpButton href={s.cta1Href} label={s.cta1Label} variant={dark ? 'gold' : 'primary'} />
            <HpButton href={s.cta2Href} label={s.cta2Label} variant="outline" arrow={false} />
          </div>
          {s.note && <p className={`flex items-center gap-2 text-xs mt-6 ${dark ? 'text-white/50' : 'text-hp-muted'}`}><Shield size={14} /> {s.note}</p>}
        </div>
        <div className="hp-reveal relative">
          {image ? (
            <div className="aspect-[4/3] rounded-[calc(var(--hp-radius-card)*1.4)] overflow-hidden shadow-xl mb-5">
              <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
          ) : null}
          <ol className="grid sm:grid-cols-2 gap-4">
            {steps.map((x: any, i: number) => (
              <li key={i} className={`relative p-6 rounded-hp-card ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-hp-text/[0.07] shadow-sm'}`}>
                <span className="absolute top-5 right-5 hp-heading text-3xl font-semibold text-hp-gold/30">{String(i + 1).padStart(2, '0')}</span>
                <span className={`grid place-items-center w-11 h-11 rounded-xl mb-4 ${dark ? 'bg-hp-gold/15 text-hp-gold' : 'bg-hp-primary/10 text-hp-primary'}`}><Icon name={x.icon} size={20} /></span>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-hp-text'}`}>{x.title}</p>
                {x.description && <p className={`text-xs mt-1 leading-relaxed ${dark ? 'text-white/55' : 'text-hp-muted'}`}>{x.description}</p>}
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────────── */

export function Faq({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const items = list(s.items).filter((x: any) => x?.question);
  const [open, setOpen] = useState(0);
  if (!items.length) return null;
  const panel = s.panelTitle || s.panelText || s.ctaLabel;
  return (
    <Section s={s}>
      <Container className={`grid gap-12 ${panel ? 'lg:grid-cols-[0.8fr_1.2fr]' : ''}`}>
        <div>
          <SectionHeading s={{ ...s, align: panel ? 'left' : s.align }} className="mb-8" />
          {panel && (
            <div className="hp-reveal hidden lg:block p-7 rounded-hp-card text-white relative overflow-hidden" style={{ background: 'linear-gradient(140deg, rgb(var(--hp-primary)), rgb(var(--hp-primary-dark)))' }}>
              <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.08]" />
              <div className="relative">
                {s.panelTitle && <p className="hp-heading text-2xl font-semibold mb-2">{s.panelTitle}</p>}
                {s.panelText && <p className="text-white/75 text-sm mb-6">{s.panelText}</p>}
                <HpButton href={s.ctaHref} label={s.ctaLabel} variant="light" />
              </div>
            </div>
          )}
        </div>
        <div className={`divide-y ${dark ? 'divide-white/10 border-y border-white/10' : 'divide-hp-text/10 border-y border-hp-text/10'}`}>
          {items.map((x: any, i: number) => {
            const isOpen = open === i;
            return (
              <div key={i} className="hp-reveal">
                <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left">
                  <span className={`text-base md:text-lg font-semibold ${dark ? 'text-white' : 'text-hp-text'}`}>{x.question}</span>
                  <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 transition-colors ${isOpen ? 'bg-hp-primary text-white' : dark ? 'bg-white/10 text-white' : 'bg-hp-sand text-hp-text'}`}>
                    {isOpen ? <Minus size={15} /> : <Plus size={15} />}
                  </span>
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <p className={`pb-6 pr-12 leading-relaxed ${dark ? 'text-white/65' : 'text-hp-muted'}`}>{x.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {panel && (
          <div className="lg:hidden text-center">
            <HpButton href={s.ctaHref} label={s.ctaLabel} variant="primary" />
          </div>
        )}
      </Container>
    </Section>
  );
}

/* ─── Closing CTA ───────────────────────────────────────────────────────── */

export function Cta({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const dark = tone === 'dark';
  const trust = list(s.trustItems).filter((x: any) => x?.text);
  return (
    <Section s={s}>
      <Container>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="hp-reveal relative overflow-hidden rounded-[calc(var(--hp-radius-card)*1.4)] bg-white p-8 md:p-12">
            <div aria-hidden className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-hp-sand" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-hp-primary mb-4">{s.employerEyebrow}</p>
              <h3 className="hp-heading text-2xl md:text-[2rem] leading-tight font-semibold text-hp-text mb-4">{s.employerTitle}</h3>
              <p className="text-hp-muted text-sm leading-relaxed mb-8 max-w-md">{s.employerText}</p>
              <HpButton href={s.employerCtaHref} label={s.employerCtaLabel} variant="dark" />
            </div>
          </div>
          <div className="hp-reveal relative overflow-hidden rounded-[calc(var(--hp-radius-card)*1.4)] p-8 md:p-12 text-white" style={{ background: 'linear-gradient(140deg, rgb(var(--hp-primary)), rgb(var(--hp-primary-dark)))' }}>
            <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.08]" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-hp-gold mb-4">{s.seekerEyebrow}</p>
              <h3 className="hp-heading text-2xl md:text-[2rem] leading-tight font-semibold mb-4">{s.seekerTitle}</h3>
              <p className="text-white/75 text-sm leading-relaxed mb-8 max-w-md">{s.seekerText}</p>
              <HpButton href={s.seekerCtaHref} label={s.seekerCtaLabel} variant="light" />
            </div>
          </div>
        </div>
        {trust.length > 0 && (
          <ul className={`mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm ${dark ? 'text-white/70' : 'text-hp-muted'}`}>
            {trust.map((t: any, i: number) => (
              <li key={i} className="flex items-center gap-2"><Check size={15} className="text-hp-gold" strokeWidth={3} /> {t.text}</li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}

/* ─── Banner ────────────────────────────────────────────────────────────── */

export function Banner({ s }: { s: HomeSection }) {
  const tone = sectionTone(s);
  const center = s.align === 'center';
  return (
    <Section s={s}>
      <Container className={`hp-reveal flex flex-col ${center ? 'items-center text-center' : 'lg:flex-row lg:items-center lg:justify-between'} gap-8`}>
        <div className={center ? 'max-w-3xl' : 'max-w-2xl'}>
          {s.eyebrow && <Eyebrow center={center}>{s.eyebrow}</Eyebrow>}
          {s.title && <h2 className="font-semibold leading-[1.12]" style={{ fontSize: 'clamp(1.9rem, 3.6vw, 3rem)' }}><RichTitle text={s.title} /></h2>}
          {s.subtitle && <p className={`mt-4 text-lg ${tone === 'dark' ? 'text-white/70' : 'text-hp-muted'}`}>{s.subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <HpButton href={s.cta1Href} label={s.cta1Label} variant={tone === 'dark' ? 'gold' : 'primary'} />
          <HpButton href={s.cta2Href} label={s.cta2Label} variant="outline" arrow={false} />
        </div>
      </Container>
    </Section>
  );
}

