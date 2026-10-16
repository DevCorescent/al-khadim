'use client';
import './pb.css';
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { buildPageCss, collectFonts, color, fontsLink } from '@/lib/pageBuilder/css';
import type { PBNode, PageDoc } from '@/lib/pageBuilder/types';
import { Lightbox, PBContext, RawHtml, embedUrl, href, type InlineEdit, type LightboxItem } from './ui';
import { Alert, ButtonsEl, Divider, Heading, IconEl, IconList, QuoteEl, Rating, Spacer, TableEl, Text, type ElProps } from './elements/basic';
import { Carousel, Gallery, ImageEl, Logos, MapEl, VideoEl } from './elements/media';
import { Counter, Cta, FeatureGrid, Hero, IconBox, ImageBox, Pricing, Stats, Steps, Team, Testimonials, Progress } from './elements/content';
import { Accordion, Countdown, ModalButton, Social, Tabs, Ticker } from './elements/interactive';
import { FormEl, HtmlEl, Jobs } from './elements/data';
import { SHAPES } from './shapes';

export const RENDERERS: Record<string, React.ComponentType<ElProps>> = {
  heading: Heading, text: Text, buttons: ButtonsEl, icon: IconEl, divider: Divider, spacer: Spacer, iconList: IconList,
  quote: QuoteEl, alert: Alert, rating: Rating, table: TableEl,
  image: ImageEl, video: VideoEl, gallery: Gallery, carousel: Carousel, logos: Logos, map: MapEl,
  iconBox: IconBox, imageBox: ImageBox, counter: Counter, progress: Progress, steps: Steps, team: Team,
  testimonials: Testimonials, pricing: Pricing, cta: Cta, hero: Hero, stats: Stats, featureGrid: FeatureGrid,
  accordion: Accordion, tabs: Tabs, countdown: Countdown, modalButton: ModalButton, ticker: Ticker, social: Social,
  form: FormEl, jobs: Jobs, html: HtmlEl,
};

/** One broken element (say, a hand-edited value of the wrong type) must not take the page down. */
class Boundary extends Component<{ id: string; editing: boolean; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error(`[page] element ${this.props.id} failed to render`, err); }
  componentDidUpdate(prev: { children: React.ReactNode }) {
    if (this.state.failed && prev.children !== this.props.children) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.editing ? <div style={{ padding: 12, border: '1px dashed #f87171', color: '#b91c1c', fontSize: 12, borderRadius: 8 }}>This element could not be displayed — check its settings.</div> : null;
  }
}

const SAFE_ID = (v?: string) => String(v || '').replace(/[^\w-]/g, '').slice(0, 60) || undefined;
const SAFE_CLASS = (v?: string) => String(v || '').replace(/[^\w\s-]/g, '').slice(0, 200);

const EASINGS: Record<string, string> = {
  smooth: 'cubic-bezier(.22,.8,.24,1)', ease: 'ease', linear: 'linear', 'ease-in': 'ease-in', 'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out', spring: 'cubic-bezier(.34,1.56,.64,1)', snappy: 'cubic-bezier(.16,1,.3,1)',
};

function anim(node: PBNode, editing: boolean): { cls: string; style: React.CSSProperties } {
  const a = node.adv;
  if (!a?.anim || editing) return { cls: '', style: {} };
  return {
    cls: `pb-anim pb-a-${SAFE_ID(a.anim)} ${a.animRepeat ? 'pb-anim-repeat' : ''}`,
    style: {
      ...(a.animDuration ? { ['--pb-dur' as any]: `${Number(a.animDuration) || 800}ms` } : {}),
      ...(a.animDelay ? { ['--pb-delay' as any]: `${Number(a.animDelay) || 0}ms` } : {}),
      ...(a.animEasing && EASINGS[a.animEasing] ? { ['--pb-easing' as any]: EASINGS[a.animEasing] } : {}),
    },
  };
}

function editAttrs(node: PBNode, level: string, editing: boolean) {
  return editing ? { 'data-pb-id': node.id, 'data-pb-level': level, 'data-pb-type': node.type } : {};
}

const ElementView = memo(function ElementView({ node, editing }: { node: PBNode; editing: boolean }) {
  const Comp = RENDERERS[node.type];
  if (!Comp) return null;
  if (node.adv?.hidden && !editing) return null;
  const a = anim(node, editing);
  return (
    <div id={SAFE_ID(node.adv?.cssId)} className={`pb-el pb-el-${node.type} pb-n-${node.id} ${SAFE_CLASS(node.adv?.cssClass)} ${a.cls} ${node.adv?.hidden ? 'pb-node-off' : ''}`}
      style={a.style} aria-label={node.adv?.ariaLabel || undefined} {...editAttrs(node, 'element', editing)}>
      <Boundary id={node.id} editing={editing}><Comp node={node} p={node.props || {}} /></Boundary>
    </div>
  );
});

const ColumnView = memo(function ColumnView({ node, editing }: { node: PBNode; editing: boolean }) {
  if (node.adv?.hidden && !editing) return null;
  const p = node.props || {};
  const a = anim(node, editing);
  const kids = node.children || [];
  const link = !editing ? href(p.href) : undefined;
  return (
    <div id={SAFE_ID(node.adv?.cssId)} className={`pb-col pb-n-${node.id} ${SAFE_CLASS(node.adv?.cssClass)} ${a.cls} ${node.adv?.hidden ? 'pb-node-off' : ''}`} style={a.style} {...editAttrs(node, 'column', editing)}>
      <div className="pb-col-inner" style={{ justifyContent: p.vAlign || undefined, alignItems: p.hAlign && p.hAlign !== 'stretch' ? p.hAlign : undefined }}>
        {kids.map(k => <ElementView key={k.id} node={k} editing={editing} />)}
        {editing && !kids.length && <div className="pb-empty-col" data-pb-empty="1">Drop elements here</div>}
      </div>
      {link && <a className="pb-col-link" href={link} aria-label={node.adv?.ariaLabel || 'Open'} />}
    </div>
  );
});

const SECTION_TAGS = ['section', 'header', 'div', 'aside', 'footer', 'article'];

const SectionView = memo(function SectionView({ node, editing, contentWidth }: { node: PBNode; editing: boolean; contentWidth: number }) {
  if (node.adv?.hidden && !editing) return null;
  const p = node.props || {};
  const Tag = (SECTION_TAGS.includes(p.tag) ? p.tag : 'section') as any;
  const a = anim(node, editing);
  const maxWidth = p.width === 'full' ? 'none' : p.width === 'narrow' ? 820 : Number(p.boxWidth) || contentWidth || 1240;
  const hasOverlay = Object.values(node.style || {}).some(s => s?.overlay && s.overlay !== 'none');
  const bgVideo = p.bgVideo ? embedUrl(p.bgVideo, { background: true }) : null;
  const shape = (pos: 'top' | 'bottom') => {
    const kind = p[`shape${pos === 'top' ? 'Top' : 'Bottom'}`];
    const path = kind && SHAPES[kind];
    if (!path) return null;
    const h = Number(p[`shape${pos === 'top' ? 'Top' : 'Bottom'}Height`]) || 70;
    const c = p[`shape${pos === 'top' ? 'Top' : 'Bottom'}Color`] || '#ffffff';
    const flip = p[`shape${pos === 'top' ? 'Top' : 'Bottom'}Flip`];
    return (
      <div className={`pb-shape pb-shape-${pos} ${flip ? 'is-flip' : ''}`} aria-hidden>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ height: h }}><path d={path} style={{ fill: color(c) || '#ffffff' }} /></svg>
      </div>
    );
  };
  return (
    <Tag id={SAFE_ID(node.adv?.cssId)} className={`pb-section pb-n-${node.id} ${SAFE_CLASS(node.adv?.cssClass)} ${a.cls} ${node.adv?.hidden ? 'pb-node-off' : ''}`}
      style={{ ...a.style, justifyContent: p.contentAlign || undefined }} aria-label={node.adv?.ariaLabel || undefined} {...editAttrs(node, 'section', editing)}>
      {bgVideo && bgVideo.kind !== 'none' && (
        <div className="pb-bgvideo" aria-hidden>
          {bgVideo.kind === 'file'
            ? <video src={bgVideo.src} autoPlay muted loop playsInline />
            : <iframe src={bgVideo.src} title="" allow="autoplay; encrypted-media" tabIndex={-1} />}
        </div>
      )}
      {hasOverlay && <div className="pb-overlay" aria-hidden />}
      {p.pattern && p.pattern !== 'none' && <div className={`pb-pattern pb-pattern-${SAFE_ID(p.pattern)}`} aria-hidden />}
      {p.flagStripe && <div className="pb-flag" aria-hidden />}
      {shape('top')}
      <div className="pb-container" style={{ maxWidth }}>
        <div className="pb-row" style={{ alignItems: p.vAlign && p.vAlign !== 'stretch' ? p.vAlign : undefined }}>
          {(node.children || []).map(c => <ColumnView key={c.id} node={c} editing={editing} />)}
        </div>
      </div>
      {shape('bottom')}
    </Tag>
  );
});

export interface PageRendererProps {
  doc: Pick<PageDoc, 'sections' | 'settings'>;
  editing?: boolean;
  slug?: string;
  pageId?: string;
  inline?: InlineEdit | null;
  onInlineCommit?: (id: string, key: string, value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  rootRef?: React.Ref<HTMLDivElement>;
}

/** Renders a page document — the live site, the preview and the editor canvas all use this. */
function PageRenderer({ doc, editing = false, slug, pageId, inline, onInlineCommit, className = '', style, rootRef }: PageRendererProps) {
  const css = useMemo(() => buildPageCss(doc, { editing }), [doc, editing]);
  const fonts = useMemo(() => fontsLink(collectFonts(doc)), [doc]);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const openLightbox = useCallback((items: LightboxItem[], index = 0) => setLightbox({ items, index }), []);
  const ctx = useMemo(() => ({ editing, slug, pageId, inline, onInlineCommit, openLightbox }), [editing, slug, pageId, inline, onInlineCommit, openLightbox]);
  const localRef = useRef<HTMLDivElement>(null);

  // Entrance animations: reveal on scroll (elements already on screen at load just play).
  useEffect(() => {
    const root = localRef.current;
    if (!root || editing || typeof IntersectionObserver === 'undefined') return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.pb-anim'));
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          el.classList.add('pb-in');
          if (!el.classList.contains('pb-anim-repeat')) obs.unobserve(el);
        } else if (el.classList.contains('pb-anim-repeat') && e.boundingClientRect.top > 0) {
          el.classList.remove('pb-in');
        }
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [doc, editing]);

  // Smooth in-page anchor scrolling.
  useEffect(() => {
    if (editing || !doc.settings.smoothScroll) return;
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, [editing, doc.settings.smoothScroll]);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    if (editing || !doc.settings.backToTop) return;
    const on = () => setShowTop(window.scrollY > 600);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [editing, doc.settings.backToTop]);

  const setRefs = (el: HTMLDivElement | null) => {
    (localRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (typeof rootRef === 'function') rootRef(el);
    else if (rootRef) (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  return (
    <PBContext.Provider value={ctx}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {fonts && <link rel="stylesheet" href={fonts} />}
      <RawHtml as="style" html={css} />
      <div ref={setRefs} className={`pb-root ${editing ? 'pb-editing' : ''} ${className}`} style={style}>
        {doc.sections.map(s => <SectionView key={s.id} node={s} editing={editing} contentWidth={doc.settings.contentWidth} />)}
        {editing && !doc.sections.length && <div className="pb-empty-page" data-pb-empty-page="1" />}
      </div>
      {lightbox && <Lightbox items={lightbox.items} index={lightbox.index} onClose={() => setLightbox(null)} />}
      {showTop && <button type="button" className="pb-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={18} /></button>}
    </PBContext.Provider>
  );
}


/** Memoised: the editor re-renders often (selection, overlays); the page only when its props change. */
export default memo(PageRenderer);
