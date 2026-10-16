'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pause, Play } from 'lucide-react';
import type { HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';
import { HpButton, RichTitle, ToneProvider } from '../primitives';
import { Icon } from '../icons';

const clamp = (n: any, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

const FOCUS: Record<string, string> = { center: 'center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' };

const HEIGHTS: Record<string, string> = {
  auto:   'min-h-[600px] lg:min-h-[680px]',
  tall:   'min-h-[max(640px,88svh)] lg:min-h-[max(720px,86svh)]',
  screen: 'min-h-[max(640px,100svh)]',
};

function rgba(hex: string, o: number) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '06140d';
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, o)).toFixed(3)})`;
}

/**
 * Full-bleed background slider. Every slide carries its own desktop / mobile
 * image, text and buttons. Auto-advance is driven by the progress indicator's
 * CSS animation, so pausing (hover, the pause button, a hidden tab) freezes the
 * bar and the timer together — and with reduced motion, where animations are
 * switched off globally, the slider simply stays put until the visitor moves it.
 */
export default function HeroSlider({ s }: { s: HomeSection }) {
  const slides = (Array.isArray(s.slides) ? s.slides : []).filter((x: any) => x && (x.imageDesktop || x.imageMobile || x.headline));
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, true>>({});
  /** How many times each slide has been shown — alternates the Ken Burns keyframes so the zoom restarts. */
  const [gens, setGens] = useState<Record<number, number>>({});
  const touchX = useRef<number | null>(null);

  const transition = s.transition || 'fade';
  const textAnim = s.textAnimation || 'fadeUp';
  const dur = clamp(s.transitionMs, 300, 2500, 1200);
  const interval = clamp(s.interval, 3, 15, 7) * 1000;
  const autoplay = s.autoplay !== false && count > 1;
  const playing = autoplay && !userPaused && !(s.pauseOnHover !== false && hovered);
  const overlay = clamp(s.overlayOpacity, 0, 100, 70) / 100;
  const oc = s.overlayColor || '#06140D';

  // Keep the index valid while slides are added or removed in the builder.
  useEffect(() => { if (active >= count) setActive(0); }, [active, count]);

  const go = useCallback((to: number, d?: 1 | -1) => {
    if (count < 2) return;
    const target = ((to % count) + count) % count;
    if (target === active) return;
    setPrev(active);
    setDir(d ?? (target > active ? 1 : -1));
    setGens(g => ({ ...g, [target]: (g[target] || 0) + 1 }));
    setActive(target);
  }, [count, active]);
  const next = useCallback(() => go(active + 1, 1), [go, active]);

  // Builder preview: show (and hold) the slide being edited.
  useEffect(() => {
    const onSlide = (e: Event) => { go(Number((e as CustomEvent).detail) || 0); setUserPaused(true); };
    window.addEventListener('hp-slide', onSlide);
    return () => window.removeEventListener('hp-slide', onSlide);
  }, [go]);
  const back = useCallback(() => go(active - 1, -1), [go, active]);

  if (!count) return null;
  const cur = Math.min(active, count - 1);

  const bgStyle = (i: number): React.CSSProperties => {
    const isActive = i === cur;
    if (transition === 'slide') {
      const isPrev = i === prev;
      const x = isActive ? 0 : isPrev ? -dir * 100 : dir * 100;
      return {
        transform: `translate3d(${x}%,0,0)`,
        transition: isActive || isPrev ? `transform ${dur}ms cubic-bezier(.65,0,.35,1)` : 'none',
        zIndex: isActive ? 2 : isPrev ? 1 : 0,
      };
    }
    return {
      opacity: isActive ? 1 : 0,
      transition: `opacity ${dur}ms cubic-bezier(.4,0,.2,1)`,
      zIndex: isActive ? 2 : i === prev ? 1 : 0,
    };
  };

  const imgStyle = (i: number, x: any): React.CSSProperties => {
    const isActive = i === cur;
    const st: any = { '--fp-d': FOCUS[x.focus] || 'center', '--fp-m': FOCUS[x.mobileFocus] || FOCUS[x.focus] || 'center' };
    if (transition === 'zoom') {
      st.transform = isActive ? 'scale(1)' : 'scale(1.08)';
      st.transition = `transform ${Math.round(dur * 1.8)}ms cubic-bezier(.22,1,.36,1)`;
    } else if (transition === 'kenburns' && (isActive || i === prev)) {
      // The outgoing slide keeps its running zoom while it fades, so nothing snaps.
      st.animation = `${(gens[i] || 0) % 2 ? 'hpKenburnsB' : 'hpKenburnsA'} ${interval + dur * 2}ms linear both`;
    }
    return st;
  };

  const center = (x: any) => x.align === 'center';
  const badges = (s.trustPoints || []).filter((p: any) => p?.text);

  return (
    <section
      data-hp-section={s.id} id={s.anchor || undefined}
      aria-roledescription="carousel" aria-label="Highlights"
      className={`relative z-10 isolate overflow-hidden bg-hp-ink text-white flex ${HEIGHTS[s.height] || HEIGHTS.tall}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onKeyDown={e => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') back(); }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx < 0 ? next : back)();
      }}
    >
      {/* Backgrounds */}
      <div className="absolute inset-0">
        {slides.map((x: any, i: number) => {
          const d = mediaUrl(x.imageDesktop), m = mediaUrl(x.imageMobile);
          const src = (!failed[d] && d) || (!failed[m] && m) || '';
          const mobileSrc = m && !failed[m] ? m : '';
          return (
            <div key={i} aria-hidden={i !== cur} className="absolute inset-0 overflow-hidden will-change-[opacity,transform]" style={bgStyle(i)}>
              {src ? (
                <picture>
                  {mobileSrc && mobileSrc !== src && <source media="(max-width: 767px)" srcSet={mobileSrc} />}
                  <img
                    src={src} alt={i === cur ? (x.imageAlt || '') : ''}
                    fetchPriority={i === 0 ? 'high' : 'low'} loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                    onError={() => setFailed(f => ({ ...f, [src]: true }))}
                    className="absolute inset-0 w-full h-full object-cover object-[var(--fp-m)] md:object-[var(--fp-d)] will-change-transform"
                    style={imgStyle(i, x)}
                  />
                </picture>
              ) : (
                <div className="absolute inset-0" style={{ background: 'linear-gradient(140deg, rgb(var(--hp-primary-dark)), rgb(var(--hp-ink)))' }} />
              )}
            </div>
          );
        })}
        {/* Readability: a directional wash plus a darker floor for the controls. */}
        <div className="absolute inset-0 z-[3] pointer-events-none transition-[background] duration-700" style={{
          background: center(slides[cur])
            ? `radial-gradient(ellipse at center, ${rgba(oc, overlay * 0.75)} 0%, ${rgba(oc, overlay)} 100%)`
            : `linear-gradient(90deg, ${rgba(oc, overlay)} 0%, ${rgba(oc, overlay * 0.85)} 38%, ${rgba(oc, overlay * 0.35)} 75%, ${rgba(oc, overlay * 0.2)} 100%)`,
        }} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 z-[3] pointer-events-none bg-gradient-to-t from-hp-ink/70 to-transparent" />
        <div className="absolute inset-0 z-[3] hp-pattern opacity-[0.04] pointer-events-none" />
      </div>

      {/* Content */}
      <ToneProvider value="dark">
        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 pt-[132px] md:pt-[176px] lg:pt-[196px] pb-20 lg:pb-28 flex flex-col justify-center">
          <div className="grid">
            {slides.map((x: any, i: number) => {
              const on = i === cur;
              const H = i === 0 ? 'h1' : 'h2';
              return (
                <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={!on}
                  className={`[grid-area:1/1] ${center(x) ? 'text-center mx-auto max-w-4xl' : 'max-w-[44rem]'} transition-[opacity,visibility] duration-300 ${on ? `visible opacity-100 hp-tx hp-tx-${textAnim}` : 'invisible opacity-0 pointer-events-none'}`}>
                  {/* Re-keyed per activation so the entrance animation replays every time. */}
                  <div key={on ? `on-${cur}-${prev}` : 'off'} className="hp-tx-items">
                    {x.eyebrow ? (
                      <p className={`inline-flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-hp-gold mb-5 ${center(x) ? 'justify-center' : ''}`}>
                        <span aria-hidden className="w-7 h-[2px] bg-hp-gold" />{x.eyebrow}
                      </p>
                    ) : <span />}
                    <H className="font-semibold leading-[1.05] text-white" style={{ fontSize: 'clamp(2.25rem, 4.8vw, 4.4rem)' }}>
                      <RichTitle text={x.headline} />
                    </H>
                    {x.subheadline ? (
                      <p className={`mt-5 text-[15px] sm:text-lg leading-relaxed text-white/75 max-w-2xl ${center(x) ? 'mx-auto' : ''}`}>{x.subheadline}</p>
                    ) : <span />}
                    <div className={`mt-8 flex flex-col sm:flex-row gap-3 ${center(x) ? 'sm:justify-center' : ''}`}>
                      <HpButton href={x.cta1Href} label={x.cta1Label} variant="gold" className="!rounded-full !px-6 !py-3 !text-[13.5px]" />
                      <HpButton href={x.cta2Href} label={x.cta2Label} variant="outline" arrow={false} className="!rounded-full !px-6 !py-3 !text-[13.5px] backdrop-blur-sm bg-white/5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          {count > 1 && (
            <div className={`mt-10 lg:mt-12 flex items-center gap-4 sm:gap-6 ${center(slides[cur]) ? 'justify-center' : ''}`}>
              {s.indicators !== 'none' && (
                <div className="flex items-center gap-2" role="tablist" aria-label="Choose slide">
                  {slides.map((_: any, i: number) => {
                    const on = i === cur;
                    const label = `Go to slide ${i + 1}`;
                    if (s.indicators === 'dots') {
                      return <button key={i} type="button" role="tab" aria-selected={on} aria-label={label} onClick={() => go(i)}
                        className={`h-2 rounded-full transition-all duration-500 ${on ? 'w-7 bg-hp-gold' : 'w-2 bg-white/35 hover:bg-white/60'}`} />;
                    }
                    if (s.indicators === 'numbers') {
                      return <button key={i} type="button" role="tab" aria-selected={on} aria-label={label} onClick={() => go(i)}
                        className={`text-[12px] font-semibold tabular-nums px-1 transition-colors ${on ? 'text-hp-gold' : 'text-white/45 hover:text-white'}`}>{String(i + 1).padStart(2, '0')}</button>;
                    }
                    return (
                      <button key={i} type="button" role="tab" aria-selected={on} aria-label={label} onClick={() => go(i)} className="group py-2">
                        <span className="block relative w-8 sm:w-12 h-[3px] rounded-full bg-white/25 overflow-hidden group-hover:bg-white/40 transition-colors">
                          {on && <span key={`bar-${cur}`} className="hp-progress-bar absolute inset-y-0 left-0 bg-hp-gold rounded-full"
                            style={{ width: autoplay ? undefined : '100%', animation: autoplay ? `hpProgress ${interval}ms linear both` : undefined, animationPlayState: playing ? 'running' : 'paused' }} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* The timer itself: invisible when another indicator style is chosen. */}
              {autoplay && (
                <span key={`timer-${cur}`} aria-hidden className="absolute w-px h-px opacity-0 pointer-events-none"
                  style={{ animation: `hpTimer ${interval}ms linear both`, animationPlayState: playing ? 'running' : 'paused' }}
                  onAnimationEnd={next} />
              )}
              <span className="hidden sm:inline text-[12px] font-semibold tabular-nums text-white/55">
                <span className="text-white">{String(cur + 1).padStart(2, '0')}</span> / {String(count).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                {autoplay && (
                  <button type="button" onClick={() => setUserPaused(p => !p)} aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
                    className="grid place-items-center w-9 h-9 rounded-full ring-1 ring-white/25 text-white/80 hover:bg-white hover:text-hp-ink transition-colors">
                    {userPaused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                )}
                {s.showArrows !== false && (
                  <>
                    <button type="button" onClick={back} aria-label="Previous slide"
                      className="grid place-items-center w-9 h-9 rounded-full ring-1 ring-white/25 text-white hover:bg-white hover:text-hp-ink transition-colors"><ArrowLeft size={15} /></button>
                    <button type="button" onClick={next} aria-label="Next slide"
                      className="grid place-items-center w-9 h-9 rounded-full bg-hp-gold text-hp-ink hover:brightness-110 transition"><ArrowRight size={15} /></button>
                  </>
                )}
              </div>
            </div>
          )}

          {badges.length > 0 && (
            <ul className="hidden lg:flex flex-wrap gap-x-8 gap-y-3 mt-10 pt-6 border-t border-white/10 max-w-3xl">
              {badges.map((b: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-[12.5px] text-white/75">
                  <span className="grid place-items-center w-6 h-6 rounded-full ring-1 ring-hp-gold/50 text-hp-gold">
                    {b.icon ? <Icon name={b.icon} size={12} /> : <Check size={12} />}
                  </span>
                  {b.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </ToneProvider>
      {s.showFlagStripe && <div aria-hidden className="hp-flag-stripe absolute bottom-0 inset-x-0 h-1 z-20" />}
    </section>
  );
}
