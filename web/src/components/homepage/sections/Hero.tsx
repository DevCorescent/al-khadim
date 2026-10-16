'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, ArrowUpRight, Check } from 'lucide-react';
import type { HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { HpButton, RichTitle, ToneProvider } from '../primitives';
import { Icon } from '../icons';
import HeroSlider from './HeroSlider';

const HEIGHTS: Record<string, string> = {
  auto:   '',
  tall:   'lg:min-h-[760px]',
  screen: 'lg:min-h-screen',
};

const STAT_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

type Suggestion = { label: string; hint?: string };

function HeroSearch({ s, dark }: { s: HomeSection; dark: boolean }) {
  const [tab, setTab] = useState<'hire' | 'work'>('hire');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const pool: Suggestion[] = (tab === 'hire' ? s.hireSuggestions : s.workSuggestions) || [];
  const needle = query.trim().toLowerCase();
  const rows = [
    ...pool.filter(p => p?.label && (!needle || `${p.label} ${p.hint || ''}`.toLowerCase().includes(needle))),
    ...(needle ? [{ label: query.trim(), hint: tab === 'work' ? 'Search all jobs' : 'Send us an enquiry', free: true }] : []),
  ] as (Suggestion & { free?: boolean })[];

  function go(q: string) {
    const v = q.trim();
    router.push(tab === 'work'
      ? (v ? `/careers?q=${encodeURIComponent(v)}` : '/careers')
      : (v ? `/enquiry?service=${encodeURIComponent(v)}` : '/enquiry'));
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      setOpen(true);
      setActive(a => (a + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active >= 0 && rows[active] ? rows[active].label : query);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-2xl">
      <div className={`inline-flex p-1 mb-3 rounded-full border ${dark ? 'bg-white/10 border-white/20 backdrop-blur' : 'bg-white border-hp-text/10 shadow-sm'}`}>
        {(['hire', 'work'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => { setTab(t); setQuery(''); setActive(-1); }}
            className={`px-4 sm:px-5 py-2 rounded-full text-[13px] font-semibold transition-all ${tab === t
              ? 'bg-hp-gold text-hp-ink shadow'
              : dark ? 'text-white/80 hover:text-white' : 'text-hp-muted hover:text-hp-text'}`}>
            {t === 'hire' ? (s.hireTabLabel || 'I want to hire') : (s.workTabLabel || 'I want to work')}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); go(query); }}
        className={`flex items-center bg-white rounded-hp-card p-1.5 shadow-2xl shadow-black/25 ring-1 transition ${open ? 'ring-hp-gold' : 'ring-black/5'}`}>
        <Search size={18} className="ml-3 text-hp-muted shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(-1); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={tab === 'hire' ? s.hirePlaceholder : s.workPlaceholder}
          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-[15px] text-hp-text placeholder:text-hp-muted/70 focus:outline-none"
          role="combobox" aria-expanded={open && rows.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        <button type="submit" className="shrink-0 bg-hp-primary hover:bg-hp-primary-dark text-white text-sm font-semibold px-5 sm:px-7 py-3 rounded-hp-btn transition-colors">
          {s.searchButton || 'Search'}
        </button>
      </form>

      {open && rows.length > 0 && (
        <div id={listId} role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-hp-card shadow-2xl shadow-black/30 ring-1 ring-black/5 p-1.5 text-left"
          style={{ animation: 'hpFadeUp .18s ease both' }}>
          {rows.map((r, i) => (
            <button key={`${r.label}-${i}`} id={`${listId}-${i}`} type="button" role="option" aria-selected={active === i}
              onMouseEnter={() => setActive(i)} onClick={() => go(r.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active === i ? 'bg-hp-sand' : 'hover:bg-hp-sand/60'}`}>
              <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${active === i ? 'bg-hp-primary text-white' : 'bg-hp-sand text-hp-primary'}`}>
                {r.free ? <ArrowUpRight size={14} /> : <Search size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-hp-text truncate">{r.free ? <>Search for “{r.label}”</> : r.label}</span>
                {r.hint && <span className="block text-[11px] text-hp-muted truncate">{r.hint}</span>}
              </span>
              <CornerDownLeft size={14} className={`text-hp-primary transition-opacity ${active === i ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrustPoints({ s, dark, center }: { s: HomeSection; dark: boolean; center?: boolean }) {
  const pts = (s.trustPoints || []).filter((p: any) => p?.text);
  if (!pts.length) return null;
  return (
    <ul className={`flex flex-wrap gap-x-6 gap-y-2 mt-7 ${center ? 'justify-center' : ''}`}>
      {pts.map((p: any, i: number) => (
        <li key={i} className={`flex items-center gap-2 text-sm ${dark ? 'text-white/80' : 'text-hp-muted'}`}>
          <span className="grid place-items-center w-5 h-5 rounded-full bg-hp-gold/20 text-hp-gold"><Check size={12} strokeWidth={3} /></span>
          {p.text}
        </li>
      ))}
    </ul>
  );
}

function FloatingCard({ s, className = '' }: { s: HomeSection; className?: string }) {
  if (!s.cardEnabled || (!s.cardTitle && !s.cardText)) return null;
  return (
    <div className={`flex items-center gap-4 bg-white/95 backdrop-blur rounded-hp-card p-4 pr-6 shadow-2xl shadow-black/25 ${className}`}
      style={{ animation: 'hpFadeUp .8s .4s ease both' }}>
      <span className="grid place-items-center w-12 h-12 rounded-xl bg-hp-primary text-white shrink-0">
        <Icon name={s.cardIcon} size={22} />
      </span>
      <div className="min-w-0">
        {s.cardTitle && <p className="text-sm font-bold text-hp-text">{s.cardTitle}</p>}
        {s.cardText && <p className="text-xs text-hp-muted mt-0.5">{s.cardText}</p>}
      </div>
    </div>
  );
}

function StatsStrip({ s, dark }: { s: HomeSection; dark: boolean }) {
  const stats = (s.stats || []).filter((x: any) => x?.value && x?.label);
  if (!stats.length) return null;
  return (
    <div className={`grid grid-cols-2 ${STAT_COLS[Math.min(stats.length, 4)]} gap-px rounded-hp-card overflow-hidden mt-10 ${dark ? 'bg-white/10' : 'bg-hp-text/10'}`}>
      {stats.map((x: any, i: number) => (
        <div key={i} className={`px-5 py-4 ${dark ? 'bg-hp-ink/50 backdrop-blur' : 'bg-white'}`}>
          <p className={`hp-heading text-2xl sm:text-3xl font-semibold ${dark ? 'text-white' : 'text-hp-text'}`}>{x.value}</p>
          <p className={`text-xs mt-1 ${dark ? 'text-white/60' : 'text-hp-muted'}`}>{x.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function Hero({ s }: { s: HomeSection }) {
  const [imgFailed, setImgFailed] = useState(false);
  const image = imgFailed ? '' : mediaUrl(s.image);
  const layout = s.layout || 'image';
  const overlay = Math.min(100, Math.max(0, Number(s.overlayOpacity ?? 75))) / 100;
  const height = HEIGHTS[s.height] ?? HEIGHTS.tall;

  const text = (dark: boolean, center = false) => (
    <ToneProvider value={dark ? 'dark' : 'light'}>
      {s.eyebrow && (
        <p className={`inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 mb-6 text-[11px] sm:text-xs font-semibold tracking-wide ${dark ? 'bg-white/10 text-white/90 ring-1 ring-white/15 backdrop-blur' : 'bg-white text-hp-text ring-1 ring-hp-text/10 shadow-sm'}`}
          style={{ animation: 'hpFadeUp .6s ease both' }}>
          <span className="inline-flex h-5 w-8 rounded-full overflow-hidden ring-1 ring-black/10" aria-hidden>
            <span className="w-2 bg-[#C8102E]" />
            <span className="flex-1 flex flex-col"><span className="flex-1 bg-[#00732F]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-black" /></span>
          </span>
          {s.eyebrow}
        </p>
      )}
      <h1 className={`font-semibold leading-[1.05] ${dark ? 'text-white' : 'text-hp-text hp-on-light'}`}
        style={{ fontSize: 'clamp(2.5rem, 6vw, 4.6rem)', animation: 'hpFadeUp .7s .1s ease both' }}>
        <RichTitle text={s.headline} />
      </h1>
      {s.subheadline && (
        <p className={`mt-6 text-base sm:text-lg leading-relaxed max-w-2xl ${center ? 'mx-auto' : ''} ${dark ? 'text-white/75' : 'text-hp-muted'}`}
          style={{ animation: 'hpFadeUp .7s .2s ease both' }}>
          {s.subheadline}
        </p>
      )}
      <div className={`mt-9 ${center ? 'flex flex-col items-center' : ''}`} style={{ animation: 'hpFadeUp .7s .3s ease both' }}>
        {s.showSearch ? (
          <HeroSearch s={s} dark={dark} />
        ) : (
          <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
            <HpButton href={s.cta1Href} label={s.cta1Label} variant="gold" />
            <HpButton href={s.cta2Href} label={s.cta2Label} variant="outline" arrow={false} />
          </div>
        )}
        {s.showSearch && (s.cta1Label || s.cta2Label) && (
          <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm ${center ? 'justify-center' : ''}`}>
            <span className={dark ? 'text-white/50' : 'text-hp-muted'}>or</span>
            <HpButton href={s.cta1Href} label={s.cta1Label} variant="ghost" />
            <HpButton href={s.cta2Href} label={s.cta2Label} variant="ghost" />
          </div>
        )}
      </div>
      <TrustPoints s={s} dark={dark} center={center} />
    </ToneProvider>
  );

  const stripe = s.showFlagStripe && <div aria-hidden className="hp-flag-stripe absolute bottom-0 inset-x-0 h-1 z-10" />;

  if (layout === 'slider') return <HeroSlider s={s} />;
  if (layout === 'showcase') return <Showcase s={s} image={image} onImgError={() => setImgFailed(true)} />;

  if (layout === 'split') {
    return (
      <section data-hp-section={s.id} id={s.anchor || undefined}
        className={`relative z-10 bg-hp-sand pt-32 md:pt-40 lg:pt-48 pb-16 lg:pb-24 ${height} flex items-center`}>
        <div aria-hidden className="absolute inset-0 hp-pattern-dark opacity-[0.035] pointer-events-none" />
        <div className="relative w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            {text(false)}
            <StatsStrip s={s} dark={false} />
          </div>
          {image && (
            <div className="relative hidden sm:block">
              <div aria-hidden className="absolute -inset-3 translate-x-6 translate-y-6 rounded-[calc(var(--hp-radius-card)*1.5)] border-2 border-hp-gold/50" />
              <div className="relative aspect-[4/5] lg:aspect-[5/6] rounded-[calc(var(--hp-radius-card)*1.5)] overflow-hidden shadow-2xl">
                <img src={image} alt={s.imageAlt || ''} onError={() => setImgFailed(true)} fetchPriority="high" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-hp-ink/50 via-transparent" />
              </div>
              <FloatingCard s={s} className="absolute -left-8 bottom-10 max-w-xs" />
            </div>
          )}
        </div>
        {stripe}
      </section>
    );
  }

  const center = layout === 'centered';
  const oc = s.overlayColor || '#06140D';
  return (
    <section data-hp-section={s.id} id={s.anchor || undefined}
      className={`relative z-10 bg-hp-ink pt-36 md:pt-44 lg:pt-52 pb-16 lg:pb-24 ${height} flex items-center`}>
      <div className="absolute inset-0 overflow-hidden">
        {image && <img src={image} alt={s.imageAlt || ''} onError={() => setImgFailed(true)} fetchPriority="high" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{
          background: center
            ? `linear-gradient(180deg, ${rgba(oc, overlay * 0.85)} 0%, ${rgba(oc, overlay)} 100%)`
            : `linear-gradient(90deg, ${rgba(oc, overlay)} 0%, ${rgba(oc, overlay * 0.92)} 40%, ${rgba(oc, overlay * 0.45)} 75%, ${rgba(oc, overlay * 0.3)} 100%)`,
        }} />
        <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.05]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-hp-ink/70 to-transparent" />
      </div>
      <div className={`relative w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 ${center ? 'text-center' : ''}`}>
        <div className={center ? 'max-w-4xl mx-auto' : 'max-w-3xl'}>
          {text(true, center)}
        </div>
        <StatsStrip s={s} dark />
      </div>
      {!center && <FloatingCard s={s} className="hidden xl:flex absolute right-10 bottom-24 max-w-xs" />}
      {stripe}
    </section>
  );
}

/** A hex colour at the given 0–1 opacity; anything unparseable falls back to near-black. */
function rgba(hex: string, o: number) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '06140d';
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, o)).toFixed(3)})`;
}

/**
 * Light hero: oversized uppercase headline and trust badges on the left, an
 * arched image on the right framed by a night-coloured Arabic tagline panel.
 */
function Showcase({ s, image, onImgError }: { s: HomeSection; image: string; onImgError: () => void }) {
  const badges = (s.trustPoints || []).filter((p: any) => p?.text);
  const panelLines = String(s.panelText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const showPanel = s.showPanel && (s.arabicTagline || panelLines.length > 0);
  const arch = { borderRadius: '50% 50% 20px 20px / 28% 28% 20px 20px' };
  const panel = showPanel && (
    <div className="relative overflow-hidden bg-hp-ink text-center px-4 lg:px-5 pt-8 pb-6 shadow-2xl ring-1 ring-hp-gold/40"
      style={{ borderRadius: '50% 50% 16px 16px / 22% 22% 16px 16px' }}>
      <div aria-hidden className="absolute inset-0 hp-pattern opacity-[0.07]" />
      <div aria-hidden className="absolute inset-2 border border-hp-gold/30 pointer-events-none" style={{ borderRadius: '50% 50% 12px 12px / 21% 21% 12px 12px' }} />
      <div className="relative">
        {s.arabicTagline && (
          <p dir="rtl" lang="ar" className="hp-arabic text-hp-gold font-bold leading-snug" style={{ fontSize: 'clamp(1.2rem, 1.8vw, 1.65rem)' }}>{s.arabicTagline}</p>
        )}
        {s.arabicTagline && panelLines.length > 0 && <span aria-hidden className="block w-8 h-px bg-hp-gold/50 mx-auto my-3" />}
        {panelLines.map((l, i) => (
          <p key={i} className="text-white/75 text-[9.5px] xl:text-[10.5px] font-semibold uppercase tracking-[0.2em] xl:tracking-[0.28em] leading-[1.9]">{l}</p>
        ))}
      </div>
    </div>
  );

  return (
    <section data-hp-section={s.id} id={s.anchor || undefined}
      className="relative z-10 bg-hp-sand pt-[116px] md:pt-[160px] lg:pt-[176px] pb-16 lg:pb-24 overflow-hidden">
      <div aria-hidden className="absolute inset-0 hp-pattern-dark opacity-[0.035] pointer-events-none" />
      <div aria-hidden className="absolute -right-40 -top-40 w-[640px] h-[640px] rounded-full bg-hp-gold/10 blur-3xl pointer-events-none" />
      <div className="relative max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 xl:gap-16 items-center">
        <div className="pt-4 lg:pt-0">
          {s.eyebrow && (
            <p className="flex items-center gap-3 text-[10.5px] sm:text-[11.5px] font-semibold uppercase tracking-[0.32em] text-hp-text/70 mb-4 lg:mb-5"
              style={{ animation: 'hpFadeUp .6s ease both' }}>
              <span aria-hidden className="w-8 h-[2px] bg-hp-gold" />{s.eyebrow}
            </p>
          )}
          <h1 className="hp-gold-marks font-bold uppercase text-hp-text leading-[0.98] tracking-[-0.005em]"
            style={{ fontSize: 'clamp(2.25rem, 4.3vw, 4.1rem)', animation: 'hpFadeUp .7s .1s ease both' }}>
            <RichTitle text={s.headline} />
          </h1>
          {s.subheadline && (
            <p className="mt-5 text-[14.5px] lg:text-[15px] leading-relaxed text-hp-muted max-w-[34rem]" style={{ animation: 'hpFadeUp .7s .2s ease both' }}>
              {s.subheadline}
            </p>
          )}
          <div className="mt-7" style={{ animation: 'hpFadeUp .7s .3s ease both' }}>
            {s.showSearch ? <HeroSearch s={s} dark={false} /> : (
              <ToneProvider value="light">
                <div className="flex flex-col sm:flex-row gap-3">
                  <HpButton href={s.cta1Href} label={s.cta1Label} variant="gold" className="!rounded-full !px-6 !py-3 !text-[13.5px]" />
                  <HpButton href={s.cta2Href} label={s.cta2Label} variant="outline" className="!rounded-full !px-6 !py-3 !text-[13.5px] bg-white/60" />
                </div>
              </ToneProvider>
            )}
          </div>
          {badges.length > 0 && (
            <ul className={`mt-8 grid grid-cols-2 ${badges.length >= 4 ? 'sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4' : badges.length === 3 ? 'sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3' : ''} gap-y-4 sm:max-lg:divide-x xl:divide-x divide-hp-text/10`} style={{ animation: 'hpFadeUp .7s .4s ease both' }}>
              {badges.map((b: any, i: number) => (
                <li key={i} className="flex items-center gap-2.5 sm:max-lg:px-3 sm:max-lg:first:pl-0 xl:px-4 xl:first:pl-0">
                  <span className="grid place-items-center w-8 h-8 rounded-full ring-1 ring-hp-gold/50 text-hp-gold bg-white/70 shrink-0">
                    <Icon name={b.icon} fallback="BadgeCheck" size={15} strokeWidth={1.7} />
                  </span>
                  <span className="text-[12px] font-semibold leading-tight text-hp-text">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative" style={{ animation: 'hpFadeUp .8s .2s ease both' }}>
          <div className={`relative ${showPanel ? 'sm:mr-[20%] lg:mr-[22%]' : ''}`}>
            <div aria-hidden className="absolute -inset-3 sm:-inset-4 border-2 border-hp-gold/60" style={arch} />
            <div aria-hidden className="absolute -inset-1.5 sm:-inset-2 border border-hp-gold/30" style={arch} />
            <div className="relative aspect-[4/3.6] sm:aspect-[4/3.3] lg:aspect-[4/3.9] xl:aspect-[4/3.5] overflow-hidden shadow-2xl bg-hp-ink" style={arch}>
              {image && <img src={image} alt={s.imageAlt || ''} onError={onImgError} fetchPriority="high" className="absolute inset-0 w-full h-full object-cover" />}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-hp-ink/40 via-transparent to-transparent" />
            </div>
          </div>
          {panel && (
            <>
              <div className="hidden sm:block absolute right-0 top-[16%] w-[34%] lg:w-[36%] xl:w-[33%]">{panel}</div>
              <div className="sm:hidden mt-6">{panel}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
