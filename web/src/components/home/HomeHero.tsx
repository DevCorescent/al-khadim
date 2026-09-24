'use client';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Upload, CornerDownLeft, ArrowUpRight, ArrowRight, Briefcase } from 'lucide-react';
import { useSiteConfig } from '@/lib/siteConfig';
import { mediaUrl } from '@/lib/mediaUrl';

/**
 * These were the "Popular:" chips under the search. They now live inside the
 * suggestion panel, which removes a whole row from the hero without losing the
 * links to the services page.
 */
const serviceLinks = [
  { label: 'Placement Services', hint: 'Permanent placements',      href: '/services#placement' },
  { label: 'Recruitment',        hint: 'End-to-end hiring',         href: '/services#recruitment' },
  { label: 'Outsourcing',        hint: 'Managed teams & payroll',   href: '/services#outsourcing' },
  { label: 'Consultancy',        hint: 'HR & workforce advisory',   href: '/services#consultancy' },
];

interface Suggestion { label: string; hint: string; }

/** A row in the suggestion panel. `kind` decides the icon and what Enter does. */
type PanelRow =
  | { kind: 'suggestion'; label: string; hint: string }
  | { kind: 'service';    label: string; hint: string; href: string }
  | { kind: 'query';      label: string; hint: string };

const workSuggestions: Suggestion[] = [
  { label: 'Software Engineer', hint: 'Technology' },
  { label: 'HR Manager',        hint: 'Human resources' },
  { label: 'Civil Engineer',    hint: 'Construction' },
  { label: 'Financial Analyst', hint: 'Finance & accounting' },
];
const hireSuggestions: Suggestion[] = [
  { label: 'Executive Search',  hint: 'Senior & C-suite hiring' },
  { label: 'Bulk Hiring',       hint: 'High-volume recruitment' },
  { label: 'Contract Staffing', hint: 'Temporary & project teams' },
  { label: 'Visa Assistance',   hint: 'UAE permits & PRO services' },
];

/** Shipped default, and the last resort when a configured image cannot load. */
const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=85';

/** Stops used when a configured gradient can't be understood. */
const DEFAULT_GRADIENT = '#0f172a, #1e3a5f';

/** Tailwind shade suffixes, in the order the hex values below are listed. */
const SHADE_ORDER = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const TAILWIND_FAMILIES: Record<string, string[]> = {
  slate:   ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'],
  gray:    ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#030712'],
  zinc:    ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b', '#09090b'],
  neutral: ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#404040', '#262626', '#171717', '#0a0a0a'],
  stone:   ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524', '#1c1917', '#0c0a09'],
  blue:    ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
  indigo:  ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'],
  sky:     ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49'],
};

function tailwindColor(token: string): string | null {
  const m = token.match(/^(?:from|via|to)-([a-z]+)-(\d+)$/);
  if (!m) return null;
  const family = TAILWIND_FAMILIES[m[1]];
  const at = SHADE_ORDER.indexOf(Number(m[2]));
  return family && at !== -1 ? family[at] : null;
}

/**
 * The Site Editor's gradient field has historically held Tailwind class names
 * ("from-slate-900 to-slate-700"), which interpolate into
 * `linear-gradient(135deg, …)` as nonsense — an invalid value, so the hero
 * rendered with no background at all. Class names are translated to their hex
 * values, a plain CSS stop list passes through untouched, and anything else
 * falls back to a sensible dark gradient instead of blanking.
 */
export function gradientCss(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return DEFAULT_GRADIENT;
  if (!/(^|\s)(from|via|to)-/.test(raw)) return raw;
  const stops = raw.split(/\s+/).map(tailwindColor).filter(Boolean) as string[];
  return stops.length >= 2 ? stops.join(', ') : DEFAULT_GRADIENT;
}

/** Marks the part of a suggestion the query actually matched. */
function highlight(label: string, query: string) {
  const q = query.trim();
  if (!q) return label;
  const at = label.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark className="bg-transparent text-primary-500 font-bold">{label.slice(at, at + q.length)}</mark>
      {label.slice(at + q.length)}
    </>
  );
}

export default function HomeHero() {
  const [tab, setTab]         = useState<'hire' | 'work'>('hire');
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive]   = useState(-1);
  /** Image sources that failed to load, so each is only attempted once. */
  const [failedBg, setFailedBg] = useState<string[]>([]);
  const boxRef                = useRef<HTMLDivElement>(null);
  const fieldRef              = useRef<HTMLDivElement>(null);
  /**
   * The hero is `overflow-hidden` (it has to be — the headline reveal and the
   * cover image both rely on it), which used to cut the suggestion panel off
   * at the section boundary. A fixed-position panel is laid out against the
   * viewport instead, so no ancestor's overflow can clip it, and it is sized
   * to the room actually left on screen.
   */
  const [panelBox, setPanelBox] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const listId                = useId();
  const router                = useRouter();
  const hero                  = useSiteConfig(s => s.hero);

  // Measured on focus (so the panel never paints in the wrong place for a
  // frame) and kept current while it is open.
  const measureField = () => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 10;
    setPanelBox({
      left: r.left,
      top: r.bottom + gap,
      width: r.width,
      // 520 clears the tallest the panel gets (header + 4 suggestions + the
      // free-text row ≈ 400px). The old 360 cap sat just under that, which
      // sliced the last row in half and read as it fading out.
      maxHeight: Math.max(180, Math.min(520, window.innerHeight - r.bottom - gap - 16)),
    });
  };

  useEffect(() => {
    if (!focused) return;
    const onScrollOrResize = () => measureField();
    window.addEventListener('resize', onScrollOrResize);
    // Capture phase: the hero itself does not scroll, but an ancestor might.
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [focused]);

  // Clicking a suggestion used to race a 160ms blur timer. Closing on a
  // pointer-down outside the search box instead keeps clicks reliable and
  // leaves the panel open while the page scrolls.
  useEffect(() => {
    if (!focused) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [focused]);

  if (hero && !hero.enabled) return null;

  const headline    = hero?.headline    || "Connecting UAE's Best Talent\nwith Top Employers";
  const subheadline = hero?.subheadline || 'Hire expert professionals or find your next career move — trusted by 36+ leading UAE organisations since 2017.';
  const cta1Label   = hero?.cta1Label   || 'Hire Talent';
  const cta1Href    = hero?.cta1Href    || '/enquiry';
  const cta2Label   = hero?.cta2Label   || 'Find Jobs';
  const cta2Href    = hero?.cta2Href    || '/careers';
  const showSearch  = hero?.showSearch  !== false;
  const bgType      = hero?.bgType      || 'image';
  const bgColor     = hero?.bgColor     || '#0f172a';
  const overlayOpacity = hero?.overlayOpacity ?? 0.65;

  // The configured image first, then the shipped default. An upload whose file
  // is no longer on disk (a 404) therefore degrades to the default instead of
  // leaving the hero as a bare overlay.
  const configuredBg = mediaUrl(hero?.bgImage) || DEFAULT_HERO_IMAGE;
  const bgCandidates = configuredBg === DEFAULT_HERO_IMAGE ? [configuredBg] : [configuredBg, DEFAULT_HERO_IMAGE];
  const bgImage      = bgCandidates.find(src => !failedBg.includes(src)) ?? null;

  const showAnnouncement    = hero?.showAnnouncement;
  const announcementText    = hero?.announcementText    || '';
  const announcementLink    = hero?.announcementLink    || '/enquiry';
  const announcementLinkText = hero?.announcementLinkText || 'Learn more';

  const suggestions = tab === 'work' ? workSuggestions : hireSuggestions;
  const needle = query.trim().toLowerCase();
  const matches = (label: string, hint: string) =>
    !needle || label.toLowerCase().includes(needle) || hint.toLowerCase().includes(needle);

  // One flat list of rows, so arrow-key navigation spans all three groups
  // without the index arithmetic having to know about the grouping.
  const rows: PanelRow[] = [
    ...suggestions.filter(s => matches(s.label, s.hint))
      .map((s): PanelRow => ({ kind: 'suggestion', label: s.label, hint: s.hint })),
    // Services are a hire-side concern; the work tab offers the resume upload.
    ...(tab === 'hire'
      ? serviceLinks.filter(s => matches(s.label, s.hint))
        .map((s): PanelRow => ({ kind: 'service', label: s.label, hint: s.hint, href: s.href }))
      : []),
    // With a query typed there is always a free-text row, so the panel no
    // longer disappears the moment nothing matches.
    ...(needle
      ? [{
          kind: 'query' as const,
          label: query.trim(),
          hint: tab === 'work' ? 'Browse matching jobs' : 'Send us an enquiry',
        }]
      : []),
  ];
  const showPanel = focused && rows.length > 0;
  const rowCount  = rows.length;

  function handleSubmit(e?: React.FormEvent, overrideQuery?: string) {
    e?.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (tab === 'work') {
      router.push(q ? `/careers?q=${encodeURIComponent(q)}` : '/careers');
    } else {
      router.push(q ? `/enquiry?service=${encodeURIComponent(q)}` : '/enquiry');
    }
    setFocused(false);
    setActive(-1);
  }

  /** A service row navigates; the others run the search. */
  function activateRow(row: PanelRow) {
    if (row.kind === 'service') {
      setFocused(false);
      setActive(-1);
      router.push(row.href);
      return;
    }
    handleSubmit(undefined, row.kind === 'suggestion' ? row.label : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showPanel || rowCount === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(prev => (prev + step + rowCount) % rowCount);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = active >= 0 ? rows[active] : undefined;
      if (row) activateRow(row); else handleSubmit();
      return;
    }
    if (e.key === 'Escape') {
      // First Escape dismisses the panel, a second clears what was typed.
      if (showPanel) { setFocused(false); setActive(-1); } else { setQuery(''); }
      return;
    }
    if (e.key === 'Tab') setFocused(false);
  }

  // Background: always paint a base colour, so an image that is still loading,
  // missing or blocked leaves a deliberate dark surface rather than whatever
  // the page happens to sit on.
  const bgStyle: React.CSSProperties =
    bgType === 'gradient' ? { background: `linear-gradient(135deg, ${gradientCss(hero?.bgGradient)})` }
    : bgType === 'image'  ? { background: `linear-gradient(135deg, ${bgColor} 0%, #1e293b 100%)` }
    :                       { background: bgColor };

  return (
    <section
      className="relative w-full overflow-hidden"
      // Capped: at full 100vh on a tall monitor the content island floats in
      // the middle with dead space above and below it.
      style={{ height: 'min(100vh, 820px)', minHeight: 620, ...bgStyle }}
    >
      {/* Background */}
      {bgType === 'image' && bgImage && (
        <img
          key={bgImage}
          src={bgImage}
          alt=""
          fetchPriority="high"
          onError={() => setFailedBg(prev => (prev.includes(bgImage) ? prev : [...prev, bgImage]))}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      )}
      {bgType === 'image' && (
        <>
          {/* Horizontal, not a flat wash: dark where the text sits, clearing
              towards the photo. A uniform 65% greyed the whole image out and
              flattened the right half. overlayOpacity still sets the strength. */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg,`
                + ` rgba(0,0,0,${overlayOpacity}) 0%,`
                + ` rgba(0,0,0,${+(overlayOpacity * 0.9).toFixed(3)}) 34%,`
                + ` rgba(0,0,0,${+(overlayOpacity * 0.45).toFixed(3)}) 66%,`
                + ` rgba(0,0,0,${+(overlayOpacity * 0.28).toFixed(3)}) 100%)`,
            }}
          />
          {/* Keeps the stats strip legible over a bright part of the photo. */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" />
        </>
      )}
      {bgType === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-black/10" />
      )}


      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-10 lg:px-16 xl:px-24 max-w-4xl">
        <h1 className="mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          {headline.split('\n').map((line: string, i: number) => (
            <span
              key={i}
              className="block overflow-hidden"
              style={{ animation: `heroLineUp 0.8s cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${i * 0.15}s` }}
            >
              <span
                className="block font-semibold text-white"
                style={{
                  fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
                  lineHeight: 1.12,
                  letterSpacing: '-0.01em',
                  fontStyle: i === 1 ? 'italic' : 'normal',
                  animation: `heroLineFade 0.8s ease both`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>
        <style>{`
          @keyframes heroLineUp {
            from { transform: translateY(110%); }
            to   { transform: translateY(0); }
          }
          @keyframes heroLineFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes heroPanelIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.985); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-panel { animation: none !important; }
          }
        `}</style>
        <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-9 max-w-lg">
          {subheadline}
        </p>

        {/* The CTA pair used to sit here, asking hire-or-work a second time
            right above the toggle that already asks it. It now appears only
            when the search is switched off, so the configured links stay
            reachable and the hero keeps an action. */}
        {!showSearch && (
          <div className="flex flex-wrap gap-3">
            <Link href={cta1Href}
              className="bg-primary-400 hover:bg-primary-500 text-white font-bold px-6 py-3 transition-all duration-200 shadow-lg"
              style={{ borderRadius: 'var(--radius-btn, 9999px)' }}>
              {cta1Label}
            </Link>
            <Link href={cta2Href}
              className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white font-bold px-6 py-3 transition-all duration-200"
              style={{ borderRadius: 'var(--radius-btn, 9999px)' }}>
              {cta2Label}
            </Link>
          </div>
        )}

        {/* Search */}
        {showSearch && (
          <>
            {/* Tab toggle */}
            <div className="inline-flex bg-white/12 backdrop-blur-sm border border-white/25 rounded-full p-1 mb-3 w-fit">
              {(['hire', 'work'] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); setQuery(''); setFocused(false); setActive(-1); }}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-white/80 hover:text-white'}`}>
                  {t === 'hire' ? 'I want to hire' : 'I want to work'}
                </button>
              ))}
            </div>

            <div ref={boxRef} className="relative max-w-xl mb-5">
              <form onSubmit={handleSubmit}>
                <div ref={fieldRef} className={`flex items-center bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${focused ? 'ring-2 ring-primary-400/50 shadow-primary-400/20' : ''}`}>
                  <div className="pl-4 text-gray-400 shrink-0"><Search size={17} /></div>
                  <input type="text" value={query}
                    onChange={e => { setQuery(e.target.value); setActive(-1); }}
                    onFocus={() => { measureField(); setFocused(true); }}
                    onKeyDown={handleKeyDown}
                    placeholder={tab === 'hire' ? 'Search for talent, services…' : 'Search for jobs, opportunities…'}
                    className="flex-1 px-3 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showPanel}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); setActive(-1); }} aria-label="Clear search"
                      className="px-2 text-gray-400 hover:text-gray-600 transition-colors shrink-0"><X size={14} /></button>
                  )}
                  <button type="submit" className="bg-primary-400 hover:bg-primary-500 active:bg-primary-600 text-white text-sm font-bold px-5 sm:px-6 py-3.5 transition-colors shrink-0">Search</button>
                </div>
              </form>

              {showPanel && panelBox && (
                <div
                  id={listId}
                  role="listbox"
                  aria-label={tab === 'work' ? 'Popular roles' : 'Popular services'}
                  className="hero-panel fixed flex flex-col bg-white rounded-2xl ring-1 ring-black/5 overflow-hidden z-40 origin-top"
                  style={{
                    left: panelBox.left,
                    top: panelBox.top,
                    width: panelBox.width,
                    maxHeight: panelBox.maxHeight,
                    animation: 'heroPanelIn 0.16s cubic-bezier(0.22,1,0.36,1) both',
                    boxShadow: '0 24px 56px -12px rgba(15,23,42,0.45), 0 4px 12px -4px rgba(15,23,42,0.18)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
                      {needle
                        ? `${rowCount - 1} ${rowCount - 1 === 1 ? 'match' : 'matches'}`
                        // "Requests" on the hire tab, because the second group
                        // below is the services pages — both said "services".
                        : tab === 'work' ? 'Popular roles' : 'Popular requests'}
                    </p>
                    <p className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-300 font-medium">
                      <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-400 font-sans">↑↓</kbd>
                      <span>navigate</span>
                      <kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-400 font-sans">↵</kbd>
                      <span>select</span>
                    </p>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-1.5">
                    {rows.map((row, i) => {
                      const on = active === i;
                      const Icon = row.kind === 'service' ? Briefcase : row.kind === 'query' ? ArrowUpRight : Search;
                      // A label only where the group changes, so the three
                      // kinds read apart without three separate lists.
                      const groupLabel = i > 0 && rows[i - 1].kind !== row.kind
                        ? (row.kind === 'service' ? 'Browse services' : 'Search')
                        : null;
                      return (
                        <Fragment key={`${row.kind}-${row.label}`}>
                          {groupLabel && (
                            <p className="px-3 pt-2.5 pb-1 mt-1 border-t border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
                              {groupLabel}
                            </p>
                          )}
                          <button
                            id={`${listId}-opt-${i}`}
                            type="button"
                            role="option"
                            aria-selected={on}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => activateRow(row)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${on ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                          >
                            <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 transition-colors ${on ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                              <Icon size={14} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm text-gray-800 truncate ${row.kind === 'query' ? '' : 'font-semibold'}`}>
                                {row.kind === 'query'
                                  ? <>Search for <span className="font-bold">“{row.label}”</span></>
                                  : highlight(row.label, query)}
                              </span>
                              <span className="block text-[11px] text-gray-400 truncate">{row.hint}</span>
                            </span>
                            <CornerDownLeft size={14} className={`shrink-0 text-primary-400 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* One contextual action rather than the old pair: the toggle
                  above already picked a side, so only that side is offered. */}
              <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
                <span className="text-white/40 text-xs">or</span>
                <Link href={tab === 'hire' ? cta1Href : cta2Href}
                  className="inline-flex items-center gap-2 text-white/85 text-sm font-semibold border border-white/25 rounded-full px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all">
                  {tab === 'hire' ? cta1Label : cta2Label} <ArrowRight size={14} />
                </Link>
                {tab === 'work' && (
                  <Link href="/candidate/register"
                    className="inline-flex items-center gap-2 text-white/85 text-sm font-semibold border border-white/25 rounded-full px-4 py-2 hover:bg-white/10 hover:border-white/40 hover:text-white transition-all">
                    <Upload size={14} /> Upload your Resume
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom stats strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/35 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 lg:px-16 py-4 flex items-center gap-8 sm:gap-12 overflow-x-auto scrollbar-hide">
          {[
            { value: '1,800+', label: 'Candidates in database' },
            { value: '531+',   label: 'Jobs fulfilled' },
            { value: '36+',    label: 'Enterprise clients' },
            { value: '7+',     label: 'Years of excellence' },
          ].map(({ value, label }) => (
            <div key={label} className="flex items-center gap-2.5 shrink-0">
              <p className="text-white font-bold text-lg sm:text-xl tracking-tight">{value}</p>
              <p className="text-white/45 text-[11px] leading-tight max-w-[80px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
