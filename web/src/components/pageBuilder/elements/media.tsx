'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Highlight, PBButton, colsVars, embedUrl, href, justify, media, n, usePB } from '../ui';
import type { ElProps } from './basic';

const ratio = (a?: string) => (a && a !== 'auto' ? a : undefined);

/* ─── Image ─────────────────────────────────────────────────────────────── */

export function ImageEl({ p }: ElProps) {
  const { openLightbox, editing } = usePB();
  const src = media(p.src);
  const ar = ratio(p.aspect);
  const frame = p.frame && p.frame !== 'none' ? `pb-frame-${p.frame}` : '';
  const img = src
    ? <img src={src} alt={p.alt || ''} loading={p.lazy === false ? 'eager' : 'lazy'} decoding="async"
        style={ar ? { aspectRatio: ar, objectFit: p.fit === 'contain' ? 'contain' : 'cover', objectPosition: p.focus || 'center', height: 'auto', width: '100%' } : undefined} />
    : <div style={{ aspectRatio: ar || '16/9', display: 'grid', placeItems: 'center', background: 'var(--pb-faint)', color: 'var(--pb-soft)', fontSize: 13 }}>Choose an image</div>;
  const box = (
    <div className={`pb-img-wrap pb-img-fx-${p.hoverFx || 'none'} ${frame}`} style={{ borderRadius: 'inherit' }}>
      {img}
    </div>
  );
  const url = href(p.href);
  let content: React.ReactNode = box;
  if (p.lightbox && src) {
    content = <button type="button" onClick={() => !editing && openLightbox([{ src, caption: p.caption || p.alt }])} style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', cursor: 'zoom-in', borderRadius: 'inherit' }} aria-label="Open image">{box}</button>;
  } else if (url) {
    content = <a href={url} style={{ display: 'block', borderRadius: 'inherit' }}>{box}</a>;
  }
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: p.align === 'left' ? 'flex-start' : p.align === 'right' ? 'flex-end' : 'center', borderRadius: 'inherit' }}>
      <div style={{ width: '100%', borderRadius: 'inherit' }}>{content}</div>
      {p.caption && <figcaption className="pb-caption" style={{ textAlign: p.align || 'center', width: '100%' }}>{p.caption}</figcaption>}
    </figure>
  );
}

/* ─── Video ─────────────────────────────────────────────────────────────── */

export function VideoEl({ p }: ElProps) {
  const { openLightbox, editing } = usePB();
  const [playing, setPlaying] = useState(false);
  const poster = media(p.poster);
  const auto = !!p.autoplay;
  const v = embedUrl(p.url, { autoplay: auto || playing, loop: p.loop, controls: p.controls !== false, mute: auto });
  const ar = p.aspect || '16/9';
  if (v.kind === 'none') return <div style={{ aspectRatio: ar, display: 'grid', placeItems: 'center', background: 'var(--pb-faint)', color: 'var(--pb-soft)', fontSize: 13 }}>Add a video URL</div>;

  const cover = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label="Play video" style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: ar, border: 0, padding: 0, cursor: 'pointer', background: `#000 center/cover no-repeat url("${poster}")` }}>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.45))' }} />
      <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 84, height: 84, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.95)', color: 'rgb(var(--hp-primary))', boxShadow: '0 0 0 12px rgba(255,255,255,.18), 0 20px 40px -10px rgba(0,0,0,.5)' }}>
        <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />
      </span>
    </button>
  );

  if (p.lightbox) {
    const pop = embedUrl(p.url, { autoplay: true, controls: true });
    return poster ? cover(() => !editing && openLightbox([{ video: pop.src }])) : cover(() => !editing && openLightbox([{ video: pop.src }]));
  }
  if (poster && !auto && !playing) return cover(() => !editing && setPlaying(true));
  if (v.kind === 'file') {
    return <video src={v.src} poster={poster || undefined} style={{ width: '100%', aspectRatio: ar, display: 'block', objectFit: 'cover', background: '#000' }}
      controls={p.controls !== false} autoPlay={auto || playing} muted={auto} loop={!!p.loop} playsInline />;
  }
  return (
    <div style={{ position: 'relative', aspectRatio: ar, background: '#000' }}>
      <iframe src={v.src} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: editing ? 'none' : undefined }} />
    </div>
  );
}

/* ─── Gallery ───────────────────────────────────────────────────────────── */

export function Gallery({ p }: ElProps) {
  const { openLightbox, editing } = usePB();
  const imgs: any[] = (Array.isArray(p.images) ? p.images : []).filter(i => i?.src);
  const radius = n(p.radius, 14);
  const masonry = p.layout === 'masonry';
  const mosaic = p.layout === 'justified';
  const ar = masonry ? undefined : ratio(p.aspect) || '4/3';
  const open = (i: number) => !editing && openLightbox(imgs.map(x => ({ src: media(x.src), caption: x.caption || x.alt })), i);
  if (!imgs.length) return <div style={{ padding: 32, textAlign: 'center', background: 'var(--pb-faint)', borderRadius: 14, color: 'var(--pb-soft)', fontSize: 13 }}>Add images to the gallery</div>;
  return (
    <div className={masonry ? 'pb-masonry' : 'pb-grid'} style={{ ...colsVars(p, 'cols', n(p.gap, 12)), ...(mosaic ? { gridAutoFlow: 'dense' } : {}) }}>
      {imgs.map((im, i) => {
        const big = mosaic && i === 0;
        const tile = (
          <div className={`pb-img-wrap pb-img-fx-${p.hoverFx === 'grayscale' ? 'grayscale' : p.hoverFx === 'zoom' ? 'zoom' : 'none'}`} style={{ borderRadius: radius, height: '100%' }}>
            <img src={media(im.src)} alt={im.alt || ''} loading="lazy" style={{ width: '100%', height: big ? '100%' : undefined, aspectRatio: big ? undefined : ar, objectFit: 'cover' }} />
            {p.hoverFx === 'caption' && im.caption && (
              <span style={{ position: 'absolute', inset: 'auto 0 0 0', padding: '28px 14px 12px', color: '#fff', fontSize: 13, fontWeight: 600, background: 'linear-gradient(transparent, rgba(0,0,0,.65))' }}>{im.caption}</span>
            )}
          </div>
        );
        const style: React.CSSProperties = big ? { gridColumn: 'span 2', gridRow: 'span 2' } : {};
        const url = href(im.href);
        if (p.lightbox) return <button key={i} type="button" onClick={() => open(i)} style={{ ...style, display: 'block', padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }} aria-label={im.alt || 'Open image'}>{tile}</button>;
        if (url) return <a key={i} href={url} style={{ ...style, display: 'block' }}>{tile}</a>;
        return <div key={i} style={style}>{tile}</div>;
      })}
    </div>
  );
}

/* ─── Slider ────────────────────────────────────────────────────────────── */

export function Carousel({ p }: ElProps) {
  const slides: any[] = Array.isArray(p.slides) ? p.slides : [];
  const per = Math.max(1, Math.min(4, n(p.perView, 1)));
  const multi = per > 1;
  const effect = multi ? 'slide' : p.effect || 'fade';
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = multi ? Math.max(1, slides.length - per + 1) : slides.length;
  const go = useCallback((d: number) => setI(x => (count ? (x + d + count) % count : 0)), [count]);
  useEffect(() => { if (i >= count) setI(0); }, [count, i]);
  useEffect(() => {
    if (!p.autoplay || paused || count < 2) return;
    const t = setInterval(() => go(1), Math.max(2, n(p.interval, 5)) * 1000);
    return () => clearInterval(t);
  }, [p.autoplay, p.interval, paused, count, go]);

  // Swipe on touch screens.
  const touch = useRef<number | null>(null);
  const overlay = n(p.overlay, 45) / 100;
  const align = p.textAlign || 'left';
  const h = n(p.height, 520), mh = n(p.mobileHeight, 420);

  const slideBody = (s: any) => (
    <>
      <div className="pb-slide-img" style={{ backgroundImage: s.image ? `url("${media(s.image)}")` : undefined, backgroundColor: 'rgb(var(--hp-ink))' }} />
      <div style={{ position: 'absolute', inset: 0, background: align === 'left' ? `linear-gradient(90deg, rgba(4,16,20,${overlay + 0.2}) 0%, rgba(4,16,20,${overlay * 0.6}) 60%, rgba(4,16,20,${overlay * 0.3}))` : `rgba(4,16,20,${overlay})` }} />
      {(s.title || s.text || s.btnLabel) && (
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start', textAlign: align as any, padding: multi ? '24px' : 'clamp(24px, 6cqi, 80px)', color: '#fff' }}>
          <div style={{ maxWidth: multi ? '100%' : 640 }}>
            {s.eyebrow && <span className="pb-eyebrow pb-eyebrow-line">{s.eyebrow}</span>}
            {s.title && <h3 className={`pb-h ${multi ? 'pb-h-md' : 'pb-h-xxl'}`} style={{ color: '#fff' }}><Highlight text={s.title} cls="pb-hl-gold" /></h3>}
            {s.text && <p style={{ margin: '14px 0 0', fontSize: multi ? '.9rem' : '1.1rem', lineHeight: 1.6, color: 'rgba(255,255,255,.82)' }}>{s.text}</p>}
            {s.btnLabel && <div style={{ marginTop: 22, display: 'flex', justifyContent: justify(align) }}><PBButton b={{ label: s.btnLabel, href: s.btnHref, variant: 'gold', icon: 'ArrowRight' }} size={multi ? 'sm' : 'md'} /></div>}
          </div>
        </div>
      )}
    </>
  );

  if (!slides.length) return <div style={{ padding: 32, textAlign: 'center', background: 'var(--pb-faint)', borderRadius: 14, color: 'var(--pb-soft)', fontSize: 13 }}>Add slides</div>;
  return (
    <div className={`pb-slider pb-slider-${effect} pb-carousel`} style={{ ['--h' as any]: `${h}px`, ['--mh' as any]: `${mh}px`, height: 'var(--h)', borderRadius: 'inherit' }}
      onMouseEnter={() => p.pauseOnHover && setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}
      aria-roledescription="carousel">
      {effect === 'slide' ? (
        <div className="pb-slide-track" style={{ ['--per' as any]: per, ['--sgap' as any]: multi ? '16px' : '0px', transform: `translateX(-${(i * 100) / per}%)`, margin: multi ? '0 -8px' : undefined }}>
          {slides.map((s, k) => (
            <div key={k} className="pb-slide" aria-hidden={multi ? undefined : k !== i}>
              <div style={{ position: 'relative', height: '100%', overflow: 'hidden', borderRadius: multi ? 16 : undefined }}>{slideBody(s)}</div>
            </div>
          ))}
        </div>
      ) : slides.map((s, k) => (
        <div key={k} className={`pb-slide ${k === i ? 'is-active' : ''}`} aria-hidden={k !== i}>{slideBody(s)}</div>
      ))}
      {p.arrows && count > 1 && (
        <>
          <button type="button" className="pb-arrow pb-arrow-prev" onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft size={20} /></button>
          <button type="button" className="pb-arrow pb-arrow-next" onClick={() => go(1)} aria-label="Next slide"><ChevronRight size={20} /></button>
        </>
      )}
      {p.dots && count > 1 && (
        <div className="pb-dots">
          {Array.from({ length: count }).map((_, k) => <button key={k} type="button" className={`pb-dot ${k === i ? 'is-active' : ''}`} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Logos ─────────────────────────────────────────────────────────────── */

export function Logos({ p }: ElProps) {
  const logos: any[] = Array.isArray(p.logos) ? p.logos : [];
  const h = n(p.height, 36);
  const item = (l: any, i: number) => {
    const src = media(l.src);
    const inner = src
      ? <img src={src} alt={l.alt || ''} loading="lazy" style={{ height: h, width: 'auto', maxWidth: '100%', objectFit: 'contain', transition: 'filter .3s, opacity .3s', ...(p.grayscale ? { filter: 'grayscale(1)', opacity: 0.65 } : {}) }}
          onMouseEnter={e => { if (p.grayscale) { e.currentTarget.style.filter = 'none'; e.currentTarget.style.opacity = '1'; } }}
          onMouseLeave={e => { if (p.grayscale) { e.currentTarget.style.filter = 'grayscale(1)'; e.currentTarget.style.opacity = '.65'; } }} />
      : <span style={{ fontFamily: 'var(--hp-font-heading)', fontWeight: 800, fontSize: h * 0.55, letterSpacing: '-0.02em', opacity: 0.5, whiteSpace: 'nowrap' }}>{l.alt}</span>;
    const box = <div style={{ display: 'grid', placeItems: 'center', minHeight: h + 24, padding: p.boxed ? '16px 22px' : '0 8px', ...(p.boxed ? { background: '#fff', border: '1px solid var(--pb-line)', borderRadius: 14 } : {}) }}>{inner}</div>;
    const url = href(l.href);
    return url ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label={l.alt}>{box}</a> : <div key={i}>{box}</div>;
  };
  if (p.layout === 'grid') return <div className="pb-grid" style={{ ...colsVars(p, 'cols', 16), alignItems: 'center' }}>{logos.map(item)}</div>;
  return (
    <div className="pb-marquee is-pause" style={{ ['--speed' as any]: `${n(p.speed, 40)}s` }}>
      <div className="pb-marquee-track" style={{ gap: 56, paddingRight: 56 }}>
        {[...logos, ...logos].map((l, i) => item(l, i))}
      </div>
    </div>
  );
}

/* ─── Map ───────────────────────────────────────────────────────────────── */

export function MapEl({ p }: ElProps) {
  const { editing } = usePB();
  const q = encodeURIComponent(String(p.query || 'Dubai').slice(0, 200));
  const z = Math.max(1, Math.min(21, n(p.zoom, 14)));
  return (
    <div style={{ position: 'relative', height: n(p.height, 380), borderRadius: 'inherit', overflow: 'hidden', background: 'var(--pb-faint)' }}>
      <iframe title={`Map of ${p.query}`} src={`https://maps.google.com/maps?q=${q}&z=${z}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
        style={{ width: '100%', height: '100%', border: 0, filter: p.grayscale ? 'grayscale(1) contrast(1.05)' : undefined, pointerEvents: editing ? 'none' : undefined }} />
    </div>
  );
}
