'use client';
import { Component, useEffect, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fontsHref, normalizeFooter, normalizeHomepage, normalizeNavbar, themeVars, type HomeSection } from '@/lib/homepage/config';
import type { WebsiteContent } from '@/server/siteContent';
import Hero from './sections/Hero';
import {
  About, Awards, Banner, ContentBlock, Cta, CvUpload, Emirates, Faq, Features, Industries,
  Leadership, Logos, Process, Services, Stats, Testimonials,
} from './sections/Content';
import { Candidates, Jobs } from './sections/Live';
import { GlobalHiring, ServiceStrip } from './sections/Showcase';

const RENDERERS: Record<string, React.ComponentType<{ s: HomeSection }>> = {
  hero: Hero, logos: Logos, about: About, stats: Stats, services: Services, process: Process,
  industries: Industries, features: Features, emirates: Emirates, jobs: Jobs, candidates: Candidates,
  testimonials: Testimonials, awards: Awards, leadership: Leadership, cvUpload: CvUpload, faq: Faq,
  cta: Cta, banner: Banner, content: ContentBlock, serviceStrip: ServiceStrip, globalHiring: GlobalHiring,
};

/** One broken section (say, a hand-edited value of the wrong type) must not take the page down. */
class SectionBoundary extends Component<{ id: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error(`[homepage] section ${this.props.id} failed to render`, err); }
  componentDidUpdate(prev: { children: React.ReactNode }) {
    if (this.state.failed && prev.children !== this.props.children) this.setState({ failed: false });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export const PREVIEW_MSG = {
  ready: 'hp:ready',     // preview → builder: listening, send the draft
  update: 'hp:update',   // builder → preview: { homepage, navbar, footer }
  select: 'hp:select',   // builder → preview: { id } scroll to and outline a section
  pick: 'hp:pick',       // preview → builder: { id } a section was clicked
} as const;

export default function HomeRenderer({ initial, preview = false }: { initial: WebsiteContent; preview?: boolean }) {
  const [content, setContent] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { homepage, navbar, footer } = content;
  const theme = homepage.theme;

  // Builder preview: take drafts from the parent window, report clicked sections.
  useEffect(() => {
    if (!preview || window.parent === window) return;
    const origin = window.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || !e.data || typeof e.data !== 'object') return;
      if (e.data.type === PREVIEW_MSG.update) {
        setContent({
          homepage: normalizeHomepage(e.data.homepage),
          navbar: normalizeNavbar(e.data.navbar),
          footer: normalizeFooter(e.data.footer),
        });
      } else if (e.data.type === 'hp:slide') {
        window.dispatchEvent(new CustomEvent('hp-slide', { detail: Number(e.data.index) || 0 }));
      } else if (e.data.type === PREVIEW_MSG.select) {
        setSelected(e.data.id || null);
        const el = e.data.id && document.querySelector(`[data-hp-section="${CSS.escape(e.data.id)}"]`);
        if (el && e.data.scroll !== false) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Links and forms stay inert in the preview, so a click selects instead of navigating away.
      if (target.closest('a, button[type="submit"]')) e.preventDefault();
      const sec = target.closest('[data-hp-section]') as HTMLElement | null;
      if (sec) window.parent.postMessage({ type: PREVIEW_MSG.pick, id: sec.dataset.hpSection }, origin);
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    window.parent.postMessage({ type: PREVIEW_MSG.ready }, origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    };
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    document.querySelectorAll('[data-hp-section].hp-selected').forEach(el => el.classList.remove('hp-selected'));
    if (selected) document.querySelector(`[data-hp-section="${CSS.escape(selected)}"]`)?.classList.add('hp-selected');
  }, [preview, selected, content]);

  // Scroll reveal. Elements already on screen are marked visible before the
  // animate class goes on, so nothing above the fold blinks out and back in.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!theme.animations || typeof IntersectionObserver === 'undefined') {
      root.classList.remove('hp-animate');
      return;
    }
    const els = Array.from(root.querySelectorAll<HTMLElement>('.hp-reveal:not(.is-visible)'));
    for (const el of els) if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
    root.classList.add('hp-animate');
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(el => { if (!el.classList.contains('is-visible')) obs.observe(el); });
    return () => obs.disconnect();
  }, [theme.animations, content]);

  const sections = homepage.sections.filter(s => s.enabled && RENDERERS[s.type]);
  const first = sections[0];
  const heroFirst = first?.type === 'hero';
  const overDarkHero = heroFirst && !['split', 'showcase'].includes(first.layout);
  const topBar = navbar.topBarEnabled;

  return (
    <div ref={rootRef} className={`hp-root bg-hp-surface ${preview ? 'hp-preview' : ''}`} style={themeVars(theme) as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontsHref(theme)} />
      <Navbar config={navbar} footerConfig={footer} overDarkHero={overDarkHero} flagStripe={theme.flagStripe} />
      <main>
        {!heroFirst && <div aria-hidden className={topBar ? 'h-[67px] md:h-[103px] lg:h-[111px]' : 'h-[67px] lg:h-[75px]'} />}
        {sections.map(s => {
          const R = RENDERERS[s.type];
          return <SectionBoundary key={s.id} id={s.id}><R s={s} /></SectionBoundary>;
        })}
      </main>
      <Footer config={footer} navConfig={navbar} />
    </div>
  );
}
