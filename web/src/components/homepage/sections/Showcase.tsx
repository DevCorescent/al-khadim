'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { safeHref, type HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { Container, Section } from '../primitives';
import { Icon } from '../icons';

const list = (v: any) => (Array.isArray(v) ? v : []);

/* ─── Services strip ────────────────────────────────────────────────────── */

const XL_COLS: Record<number, string> = {
  4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 7: 'xl:grid-cols-7', 8: 'xl:grid-cols-8',
  9: 'xl:grid-cols-9', 10: 'xl:grid-cols-10', 11: 'xl:grid-cols-11', 12: 'xl:grid-cols-12',
};

/**
 * Compact tiles in one white card. On phones the row scrolls sideways; from
 * tablet up it becomes a grid, one row on wide screens.
 */
export function ServiceStrip({ s }: { s: HomeSection }) {
  const items = list(s.items).filter((x: any) => x?.title);
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);

  // Phones: which card is at the start of the track, for the dots.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const step = card.offsetWidth + 12;
    setPage(Math.min(items.length - 1, Math.round(el.scrollLeft / step)));
  }, [items.length]);

  const scrollTo = useCallback((i: number) => {
    const el = trackRef.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: 'smooth' });
  }, []);

  // Gentle auto-advance on phones; stops for good once the visitor touches it.
  useEffect(() => {
    if (held || items.length < 3) return;
    const el = trackRef.current;
    if (!el || getComputedStyle(el).display === 'none') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (!el.offsetParent) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      scrollTo(atEnd ? 0 : page + 1);
    }, 3800);
    return () => clearInterval(t);
  }, [held, items.length, page, scrollTo]);

  if (!items.length) return null;
  const xl = XL_COLS[Math.min(12, Math.max(4, items.length))];
  const md = items.length % 4 === 0 ? 'md:grid-cols-4' : items.length % 3 === 0 && items.length <= 9 ? 'md:grid-cols-3' : 'md:grid-cols-5';

  const tileBody = (x: any, to: string) => (
    <>
      <span className="grid place-items-center w-11 h-11 md:w-10 md:h-10 rounded-xl bg-hp-primary/[0.07] md:bg-transparent text-hp-primary group-hover:bg-hp-primary group-hover:text-white transition-colors">
        <Icon name={x.icon} size={23} strokeWidth={1.5} />
      </span>
      <span className="mt-3 md:mt-2.5 text-[13px] md:text-[12.5px] font-semibold leading-tight text-hp-text">{x.title}</span>
      {x.description && <span className="mt-1 text-[11.5px] md:text-[11px] leading-snug text-hp-muted line-clamp-3">{x.description}</span>}
      {to && (
        <span className="mt-auto pt-3">
          <span className="grid place-items-center w-7 h-7 md:w-6 md:h-6 rounded-full ring-1 ring-hp-text/15 text-hp-text group-hover:bg-hp-gold group-hover:ring-hp-gold group-hover:text-hp-ink transition-colors">
            <ArrowRight size={12} />
          </span>
        </span>
      )}
    </>
  );
  const tile = (x: any, i: number, cls: string) => {
    const to = safeHref(x.href);
    return to
      ? <Link key={i} href={to} className={cls}>{tileBody(x, to)}</Link>
      : <div key={i} className={cls}>{tileBody(x, to)}</div>;
  };

  return (
    <Section s={s} visible className={`z-20 ${s.overlap ? '!pt-0' : ''}`}>
      {/* Phones: an edge-to-edge swipe slider of separate cards */}
      <div className={`md:hidden ${s.overlap ? '-mt-8' : ''}`}>
        <div ref={trackRef} onScroll={onScroll} onTouchStart={() => setHeld(true)} onPointerDown={() => setHeld(true)}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide px-5 sm:px-8 scroll-px-5 sm:scroll-px-8 pb-3">
          {items.map((x: any, i: number) => tile(x, i,
            'group snap-start shrink-0 w-[44%] sm:w-[30%] min-h-[188px] flex flex-col items-center text-center px-3 pt-5 pb-4 rounded-hp-card bg-white ring-1 ring-hp-gold/15 shadow-[0_12px_30px_-18px_rgba(6,30,38,0.35)] active:scale-[0.98] transition'))}
          <span aria-hidden className="shrink-0 w-2" />
        </div>
        {items.length > 2 && (
          <div className="flex justify-center gap-1.5 mt-3" aria-hidden>
            {items.map((_: any, i: number) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === page ? 'w-5 bg-hp-primary' : 'w-1.5 bg-hp-text/15'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Tablets and up: one card, one row on wide screens */}
      <Container className="hidden md:block">
        <div className={`relative bg-white rounded-hp-card shadow-[0_20px_50px_-24px_rgba(6,30,38,0.35)] ring-1 ring-hp-gold/15 ${s.overlap ? '-mt-14' : ''}`}>
          <div className={`grid ${md} ${xl} divide-x divide-hp-text/[0.06]`}>
            {items.map((x: any, i: number) => tile(x, i,
              'group flex flex-col items-center text-center px-2.5 py-5 hover:bg-hp-sand/50 transition-colors first:rounded-l-[inherit] last:rounded-r-[inherit]'))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ─── Global hiring ─────────────────────────────────────────────────────── */

function Flag({ code }: { code?: string }) {
  const c = String(code || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(c)) return null;
  return (
    <img src={`https://flagcdn.com/w40/${c}.png`} srcSet={`https://flagcdn.com/w80/${c}.png 2x`} alt="" loading="lazy"
      className="w-6 h-auto rounded-[2px] shadow ring-1 ring-black/10" />
  );
}

/** One row on wide screens: every country tile plus a wider closing card. */
const WIDE_ROW: Record<number, string> = {
  2: 'xl:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.6fr)]',
  3: 'xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]',
  4: 'xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]',
  5: 'xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.6fr)]',
  6: 'xl:grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.6fr)]',
  7: 'xl:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.6fr)]',
  8: 'xl:grid-cols-[repeat(8,minmax(0,1fr))_minmax(0,1.6fr)]',
};

/** A small line-drawn globe in the theme colours. */
function Globe() {
  return (
    <svg viewBox="0 0 120 120" className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0" aria-hidden>
      <defs>
        <radialGradient id="hpGlobe" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgb(var(--hp-sand))" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="url(#hpGlobe)" stroke="rgb(var(--hp-gold))" strokeWidth="1.5" />
      <g fill="none" stroke="rgb(var(--hp-primary))" strokeOpacity="0.45" strokeWidth="1">
        <ellipse cx="60" cy="60" rx="22" ry="54" />
        <ellipse cx="60" cy="60" rx="42" ry="54" />
        <line x1="60" y1="6" x2="60" y2="114" />
        <ellipse cx="60" cy="60" rx="54" ry="18" />
        <path d="M10 38h100M10 82h100" />
      </g>
      <g fill="rgb(var(--hp-gold))">
        <circle cx="74" cy="52" r="3" /><circle cx="40" cy="44" r="2" /><circle cx="86" cy="76" r="2" /><circle cx="50" cy="80" r="2" />
      </g>
      <path d="M40 44 Q57 30 74 52 Q82 64 86 76" fill="none" stroke="rgb(var(--hp-gold))" strokeWidth="1.2" strokeDasharray="3 3" />
    </svg>
  );
}

export function GlobalHiring({ s }: { s: HomeSection }) {
  const items = list(s.items).filter((x: any) => x?.name);
  const cardHref = safeHref(s.cardHref);
  const cardImg = mediaUrl(s.cardImage);
  if (!items.length && !s.cardTitle) return null;

  const tile = (x: any, i: number) => {
    const img = mediaUrl(x.image);
    const to = safeHref(x.href);
    const body = (
      <>
        {img
          ? <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          : <div className="absolute inset-0" style={{ background: 'linear-gradient(150deg, rgb(var(--hp-primary-dark)), rgb(var(--hp-ink)))' }}><div className="absolute inset-0 hp-pattern opacity-[0.1]" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-hp-ink/85 via-hp-ink/10 to-transparent" />
        <div className="absolute top-2.5 left-2.5"><Flag code={x.code} /></div>
        <p className="absolute bottom-2.5 left-3 right-3 text-white text-[13px] font-semibold truncate">{x.name}</p>
      </>
    );
    const cls = 'hp-reveal group relative aspect-[4/3] rounded-[calc(var(--hp-radius-card)*0.75)] overflow-hidden bg-hp-ink';
    return to ? <Link key={i} href={to} className={cls}>{body}</Link> : <div key={i} className={cls}>{body}</div>;
  };

  return (
    <Section s={s}>
      <Container className="grid lg:grid-cols-[minmax(0,300px)_1fr] gap-6 lg:gap-10 items-center">
        <div className="hp-reveal flex items-center gap-5">
          <Globe />
          <div>
            {s.title && <h2 className="text-[15px] sm:text-base font-bold uppercase tracking-[0.12em] text-hp-text leading-tight" style={{ fontFamily: 'var(--hp-font-body)' }}>{s.title}</h2>}
            {s.subtitle && <p className="mt-1.5 text-sm font-medium" style={{ color: 'color-mix(in srgb, rgb(var(--hp-gold)) 80%, #000)' }}>{s.subtitle}</p>}
          </div>
        </div>
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${WIDE_ROW[Math.min(items.length, 8)] || ''} gap-3`}>
          {items.slice(0, 8).map(tile)}
          {s.cardTitle && (() => {
            const body = (
              <>
                {cardImg && <img src={cardImg} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-r from-hp-ink/60 via-hp-ink/80 to-hp-ink" />
                <div className="relative h-full flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="text-white text-[14px] font-semibold leading-tight">{s.cardTitle}</p>
                    {s.cardText && <p className="text-white/65 text-xs mt-1">{s.cardText}</p>}
                  </div>
                  {cardHref && (
                    <span className="grid place-items-center w-8 h-8 rounded-full ring-1 ring-hp-gold text-hp-gold group-hover:bg-hp-gold group-hover:text-hp-ink transition-colors shrink-0">
                      <ArrowRight size={16} />
                    </span>
                  )}
                </div>
              </>
            );
            const cls = 'hp-reveal group relative col-span-2 sm:col-span-3 xl:col-span-1 min-h-[96px] rounded-[calc(var(--hp-radius-card)*0.75)] overflow-hidden bg-hp-ink';
            return cardHref ? <Link href={cardHref} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
          })()}
        </div>
      </Container>
    </Section>
  );
}
