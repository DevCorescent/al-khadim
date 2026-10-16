'use client';
import { createContext, Fragment, useContext } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { safeHref, type HomeSection } from '@/lib/homepage/config';
import { mediaUrl } from '@/lib/mediaUrl';

/** Whether the current section paints a dark or light surface; text colours follow it. */
export type Tone = 'light' | 'dark';
const ToneContext = createContext<Tone>('light');
export const useTone = () => useContext(ToneContext);
export const ToneProvider = ToneContext.Provider;

/** Renders `*word*` as a highlighted span and keeps line breaks. */
export function RichTitle({ text }: { text?: string }) {
  const lines = String(text ?? '').split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*]+\*)/g).map((part, pi) =>
            /^\*[^*]+\*$/.test(part)
              ? <span key={pi} className="hp-mark">{part.slice(1, -1)}</span>
              : <Fragment key={pi}>{part}</Fragment>)}
        </Fragment>
      ))}
    </>
  );
}

export function Paragraphs({ text, className = '' }: { text?: string; className?: string }) {
  const paras = String(text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return <>{paras.map((p, i) => <p key={i} className={className}>{p}</p>)}</>;
}

function luminance(hex: string) {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return 1;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const SPACING: Record<string, string> = {
  tight:    'py-8 md:py-10',
  compact:  'py-12 md:py-16',
  normal:   'py-16 md:py-24',
  spacious: 'py-20 md:py-32',
};

export function sectionTone(s: HomeSection): Tone {
  switch (s.background) {
    case 'ink': case 'primary': case 'gradient': case 'image': return 'dark';
    case 'custom': return luminance(s.bgColor) < 0.5 ? 'dark' : 'light';
    default: return 'light';
  }
}

/** Outer wrapper every section renders in: background, spacing, anchor, visibility, pattern. */
export function Section({ s, children, className = '', flush = false, visible = false }: {
  s: HomeSection; children: React.ReactNode; className?: string; flush?: boolean;
  /** Let content spill outside the section box (e.g. a strip pulled up over the hero). */
  visible?: boolean;
}) {
  const tone = sectionTone(s);
  const style: React.CSSProperties = {};
  let bg = '';
  switch (s.background) {
    case 'sand': bg = 'bg-hp-sand'; break;
    case 'ink': bg = 'bg-hp-ink'; break;
    case 'primary': bg = 'bg-hp-primary'; break;
    case 'gradient': style.background = 'linear-gradient(135deg, rgb(var(--hp-primary-dark)) 0%, rgb(var(--hp-ink)) 100%)'; break;
    case 'custom': style.background = s.bgColor; break;
    case 'image': bg = 'bg-hp-ink'; break;
    default: bg = 'bg-hp-surface';
  }
  const hide = s.hideOnMobile && s.hideOnDesktop ? 'hidden'
    : s.hideOnMobile ? 'hidden md:block'
    : s.hideOnDesktop ? 'md:hidden' : '';
  const image = s.background === 'image' ? mediaUrl(s.bgImage) : '';
  const overlay = Math.min(100, Math.max(0, Number(s.overlayOpacity ?? 70))) / 100;

  return (
    <ToneContext.Provider value={tone}>
      <section
        id={s.anchor || undefined}
        data-hp-section={s.id}
        className={`relative ${visible ? '' : 'overflow-hidden'} scroll-mt-24 ${bg} ${tone === 'dark' ? 'text-white' : 'text-hp-text hp-on-light'} ${flush ? '' : SPACING[s.spacing] || SPACING.normal} ${hide} ${className}`}
        style={style}
      >
        {image && (
          <>
            <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-hp-ink" style={{ opacity: overlay }} />
          </>
        )}
        {s.pattern && (
          <div aria-hidden className={`absolute inset-0 pointer-events-none ${tone === 'dark' ? 'hp-pattern opacity-[0.06]' : 'hp-pattern-dark opacity-[0.04]'}`} />
        )}
        <div className="relative">{children}</div>
      </section>
    </ToneContext.Provider>
  );
}

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-10 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  const tone = useTone();
  return (
    <p className={`flex items-center gap-3 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-4 ${center ? 'justify-center' : ''} ${tone === 'dark' ? 'text-hp-gold' : 'text-hp-primary'}`}>
      <span className="inline-flex h-[3px] w-8 overflow-hidden rounded-full" aria-hidden>
        <span className="w-1/4 bg-hp-accent" /><span className={`flex-1 ${tone === 'dark' ? 'bg-hp-gold' : 'bg-hp-primary'}`} />
      </span>
      {children}
    </p>
  );
}

/** Eyebrow, title, subtitle and an optional action, aligned per the section's style. */
export function SectionHeading({ s, action, className = 'mb-12 md:mb-16' }: { s: HomeSection; action?: React.ReactNode; className?: string }) {
  const tone = useTone();
  const center = s.align === 'center';
  if (!s.eyebrow && !s.title && !s.subtitle && !action) return null;
  const text = (
    <div className={center ? 'max-w-3xl mx-auto text-center' : 'max-w-3xl'}>
      {s.eyebrow && <Eyebrow center={center}>{s.eyebrow}</Eyebrow>}
      {s.title && (
        <h2 className={`font-semibold leading-[1.12] ${tone === 'dark' ? 'text-white' : 'text-hp-text'}`}
          style={{ fontSize: 'clamp(1.9rem, 3.6vw, 3rem)' }}>
          <RichTitle text={s.title} />
        </h2>
      )}
      {s.subtitle && (
        <p className={`mt-4 text-base md:text-lg leading-relaxed ${tone === 'dark' ? 'text-white/70' : 'text-hp-muted'}`}>{s.subtitle}</p>
      )}
    </div>
  );
  if (!action) return <div className={`hp-reveal ${className}`}>{text}</div>;
  return (
    <div className={`hp-reveal flex flex-col ${center ? 'items-center text-center' : 'lg:flex-row lg:items-end lg:justify-between'} gap-6 ${className}`}>
      {text}
      <div className="shrink-0">{action}</div>
    </div>
  );
}

type BtnVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'light' | 'dark';

export function HpButton({ href, label, variant = 'primary', arrow = true, className = '' }: {
  href?: string; label?: string; variant?: BtnVariant; arrow?: boolean; className?: string;
}) {
  const tone = useTone();
  const to = safeHref(href);
  if (!label || !to) return null;
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-hp-primary text-white hover:bg-hp-primary-dark shadow-lg shadow-hp-primary/25',
    gold:    'bg-hp-gold text-hp-ink hover:brightness-110 shadow-lg shadow-hp-gold/25',
    outline: tone === 'dark'
      ? 'border border-white/30 text-white hover:bg-white hover:text-hp-ink'
      : 'border border-hp-text/15 text-hp-text hover:border-hp-primary hover:text-hp-primary',
    ghost:   tone === 'dark' ? 'text-white hover:text-hp-gold' : 'text-hp-primary hover:text-hp-primary-dark',
    light:   'bg-white text-hp-ink hover:bg-hp-sand',
    dark:    'bg-hp-ink text-white hover:bg-hp-primary',
  };
  const external = /^https?:/i.test(to);
  return (
    <Link href={to} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group inline-flex items-center justify-center gap-2 rounded-hp-btn text-sm font-semibold transition-all duration-200 ${variant === 'ghost' ? 'px-0 py-2' : 'px-6 py-3.5'} ${styles[variant]} ${className}`}>
      {label}
      {arrow && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
    </Link>
  );
}

/** Picks the text colour for body copy in the current tone. */
export function useMutedClass() {
  return useTone() === 'dark' ? 'text-white/65' : 'text-hp-muted';
}

export function Img({ src, alt = '', className = '', eager = false }: { src?: string; alt?: string; className?: string; eager?: boolean }) {
  const url = mediaUrl(src);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} {...(eager ? { fetchPriority: 'high' as any } : {})} />;
}
