/**
 * Turns node styles into one stylesheet. Each node gets a class `pb-n-<id>`;
 * desktop values are the base rules, tablet/mobile values sit in container
 * queries on `.pb-root`, so the editor canvas switches devices just by
 * changing its own width (no iframe), and the live site behaves the same.
 *
 * Every value is cleaned here — the CSS is injected with a <style> tag, so a
 * value must never be able to close a rule or the tag.
 */
import { mediaUrl } from '@/lib/mediaUrl';
import { FONT_FAMILIES } from '@/lib/homepage/config';
import { BREAKPOINT, type Device, type HoverProps, type PBNode, type PageDoc, type StyleProps } from './types';

const UNITLESS = new Set(['fontWeight', 'lineHeight', 'opacity', 'zIndex', 'scale', 'overlayOpacity']);

/** Strips anything that could escape a declaration. */
export function cssValue(v: unknown, max = 300): string {
  return String(v ?? '')
    .replace(/<\/?\s*style/gi, '')
    .replace(/[;{}<>\\]/g, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/@import/gi, '')
    .trim()
    .slice(0, max);
}

/** Bare numbers get px (unitless keys excepted); everything else passes through cleaned. */
export function len(v: unknown, key = ''): string {
  const s = cssValue(v, 120);
  if (!s) return '';
  if (/^-?\d*\.?\d+$/.test(s) && !UNITLESS.has(key)) return `${s}px`;
  return s;
}

function cssUrl(raw: string): string {
  const u = mediaUrl(raw).replace(/["'()\\\s<>]/g, c => encodeURIComponent(c));
  if (!u || /^javascript:/i.test(u)) return '';
  return `url("${u}")`;
}

export function fontStackFor(name?: string): string {
  const n = cssValue(name, 60).replace(/['"]/g, '');
  if (!n) return '';
  if (n === 'heading') return 'var(--hp-font-heading)';
  if (n === 'body') return 'var(--hp-font-body)';
  const f = FONT_FAMILIES[n];
  return f ? `'${n}', ${f.kind === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'}` : `'${n}', system-ui, sans-serif`;
}

export const SHADOWS: Record<string, string> = {
  none: 'none',
  xs: '0 1px 2px rgba(6,30,38,.06)',
  sm: '0 2px 8px -2px rgba(6,30,38,.10), 0 1px 2px rgba(6,30,38,.06)',
  md: '0 10px 24px -8px rgba(6,30,38,.16), 0 2px 6px rgba(6,30,38,.06)',
  lg: '0 22px 44px -16px rgba(6,30,38,.24), 0 4px 10px rgba(6,30,38,.06)',
  xl: '0 34px 70px -24px rgba(6,30,38,.32)',
  '2xl': '0 50px 100px -30px rgba(6,30,38,.42)',
  inner: 'inset 0 2px 10px rgba(6,30,38,.12)',
  glow: '0 0 0 1px rgb(var(--hp-primary) / .15), 0 12px 40px -8px rgb(var(--hp-primary) / .45)',
  gold: '0 0 0 1px rgb(var(--hp-gold) / .25), 0 12px 40px -10px rgb(var(--hp-gold) / .5)',
};

export function shadowValue(preset?: string, custom?: string) {
  if (preset === 'custom') return cssValue(custom);
  return preset ? SHADOWS[preset] ?? '' : '';
}

/** Colour value: hex/rgb/hsl/var/transparent, or a theme token name. */
export function color(v?: string): string {
  const s = cssValue(v, 80);
  if (!s) return '';
  const token = THEME_TOKENS[s];
  return token ?? s;
}

export const THEME_TOKENS: Record<string, string> = {
  primary: 'rgb(var(--hp-primary))',
  'primary-dark': 'rgb(var(--hp-primary-dark))',
  accent: 'rgb(var(--hp-accent))',
  gold: 'rgb(var(--hp-gold))',
  ink: 'rgb(var(--hp-ink))',
  sand: 'rgb(var(--hp-sand))',
  surface: 'rgb(var(--hp-surface))',
  text: 'rgb(var(--hp-text))',
  muted: 'rgb(var(--hp-muted))',
  white: '#ffffff',
};

function gradient(s: StyleProps, from = s.gradFrom, to = s.gradTo, angle = s.gradAngle, kind = s.gradKind) {
  const a = color(from) || 'rgb(var(--hp-primary))';
  const b = color(to) || 'rgb(var(--hp-ink))';
  const mid = color(s.gradMid);
  const stops = mid ? `${a}, ${mid}, ${b}` : `${a}, ${b}`;
  if (kind === 'radial') return `radial-gradient(circle at center, ${stops})`;
  return `linear-gradient(${Number(cssValue(angle)) || 135}deg, ${stops})`;
}

/** Declarations for one device's style values. */
export function declarations(s: StyleProps | undefined, opts: { kind?: 'section' | 'column' | 'element' } = {}): string[] {
  if (!s) return [];
  const d: string[] = [];
  const put = (prop: string, v: string) => { if (v) d.push(`${prop}:${v}`); };

  put('margin-top', len(s.mt)); put('margin-right', len(s.mr)); put('margin-bottom', len(s.mb)); put('margin-left', len(s.ml));
  put('padding-top', len(s.pt)); put('padding-right', len(s.pr)); put('padding-bottom', len(s.pb)); put('padding-left', len(s.pl));
  if (opts.kind !== 'column') put('width', len(s.width));
  put('max-width', len(s.maxWidth)); put('min-height', len(s.minHeight)); put('height', len(s.height));
  if (s.gap) put(opts.kind === 'section' ? '--pb-gap' : '--pb-cgap', len(s.gap));
  if (s.position === 'sticky') { put('position', 'sticky'); put('top', len(s.top) || '0px'); }
  else if (s.position === 'relative') { put('position', 'relative'); put('top', len(s.top)); }
  put('z-index', cssValue(s.zIndex));
  put('overflow', cssValue(s.overflow));
  put('align-self', cssValue(s.alignSelf));

  put('text-align', cssValue(s.textAlign));
  put('color', color(s.color));
  put('font-family', fontStackFor(s.fontFamily));
  put('font-size', len(s.fontSize));
  put('font-weight', cssValue(s.fontWeight));
  put('line-height', len(s.lineHeight, 'lineHeight'));
  put('letter-spacing', len(s.letterSpacing));
  put('text-transform', cssValue(s.textTransform));
  put('font-style', cssValue(s.fontStyle));
  put('text-decoration', cssValue(s.textDecoration));
  put('text-shadow', cssValue(s.textShadow));

  switch (s.bgType) {
    case 'color': put('background', color(s.bgColor)); break;
    case 'gradient': put('background', gradient(s)); break;
    case 'image': {
      const url = s.bgImage ? cssUrl(s.bgImage) : '';
      if (url) {
        put('background-color', color(s.bgColor));
        put('background-image', url);
        put('background-size', cssValue(s.bgSize) || 'cover');
        put('background-position', cssValue(s.bgPos) || 'center');
        put('background-repeat', cssValue(s.bgRepeat) || 'no-repeat');
        put('background-attachment', cssValue(s.bgAttach));
      }
      break;
    }
    case 'none': put('background', 'none'); break;
  }

  if (s.borderStyle && s.borderStyle !== 'none') {
    const w = len(s.borderWidth) || '1px';
    const c = color(s.borderColor) || 'rgb(var(--hp-text) / .12)';
    const sides = s.borderSides || 'all';
    const val = `${w} ${cssValue(s.borderStyle)} ${c}`;
    if (sides === 'all') put('border', val);
    else for (const side of sides.split(',')) if (['top', 'right', 'bottom', 'left'].includes(side)) put(`border-${side}`, val);
  } else if (s.borderStyle === 'none') put('border', 'none');
  if (s.radius) {
    put('border-radius', String(s.radius).split(/\s+/).map(x => len(x)).join(' '));
  }

  put('box-shadow', shadowValue(s.shadow, s.shadowCustom));
  put('opacity', cssValue(s.opacity));
  const t: string[] = [];
  if (s.translateX || s.translateY) t.push(`translate(${len(s.translateX) || '0px'}, ${len(s.translateY) || '0px'})`);
  if (s.rotate) t.push(`rotate(${Number(cssValue(s.rotate)) || 0}deg)`);
  if (s.scale) t.push(`scale(${Number(cssValue(s.scale)) || 1})`);
  if (t.length) put('transform', t.join(' '));
  const f: string[] = [];
  if (s.blur) f.push(`blur(${len(s.blur)})`);
  if (s.filter) f.push(cssValue(s.filter));
  if (f.length) put('filter', f.join(' '));
  if (s.backdropBlur) { put('backdrop-filter', `blur(${len(s.backdropBlur)})`); put('-webkit-backdrop-filter', `blur(${len(s.backdropBlur)})`); }
  put('mix-blend-mode', cssValue(s.mixBlend));
  put('cursor', cssValue(s.cursor));
  if (s.transition) put('transition', `all ${Number(cssValue(s.transition)) || 300}ms ease`);
  return d;
}

function overlayDecl(s: StyleProps | undefined): string[] {
  if (!s || !s.overlay || s.overlay === 'none') return [];
  const op = cssValue(s.overlayOpacity) || '0.6';
  const bg = s.overlay === 'gradient'
    ? gradient(s, s.overlayFrom, s.overlayTo, s.overlayAngle, 'linear')
    : color(s.overlayFrom) || 'rgb(var(--hp-ink))';
  return [`background:${bg}`, `opacity:${op}`];
}

function hoverDecl(h?: HoverProps): string[] {
  if (!h) return [];
  const d: string[] = [];
  if (h.color) d.push(`color:${color(h.color)}`);
  if (h.bgColor) d.push(`background:${color(h.bgColor)}`);
  if (h.borderColor) d.push(`border-color:${color(h.borderColor)}`);
  if (h.shadow) d.push(`box-shadow:${shadowValue(h.shadow)}`);
  if (h.opacity) d.push(`opacity:${cssValue(h.opacity)}`);
  const t: string[] = [];
  if (h.translateY) t.push(`translateY(${len(h.translateY)})`);
  if (h.scale) t.push(`scale(${Number(cssValue(h.scale)) || 1})`);
  if (h.rotate) t.push(`rotate(${Number(cssValue(h.rotate)) || 0}deg)`);
  if (t.length) d.push(`transform:${t.join(' ')}`);
  if (h.filter) d.push(`filter:${cssValue(h.filter)}`);
  return d;
}

/** Custom CSS for one node: `selector` → that node; nothing may escape a <style> tag. */
export function scopeCustomCss(css: string | undefined, selector: string): string {
  if (!css) return '';
  const clean = String(css)
    .slice(0, 20_000)
    .replace(/<\/?\s*style/gi, '')
    .replace(/</g, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding/gi, '');
  return clean.replace(/\bselector\b/g, selector);
}

const q = (bp: number, body: string) => (body ? `@container pb (max-width:${bp}px){${body}}` : '');

interface Ctx { editing: boolean; out: { base: string[]; tablet: string[]; mobile: string[]; tail: string[] } }

function rule(sel: string, decls: string[]) {
  return decls.length ? `${sel}{${decls.join(';')}}` : '';
}

function walk(node: PBNode, parent: PBNode | null, ctx: Ctx) {
  const sel = `.pb-root .pb-n-${node.id}`;
  const kind = node.type === 'section' ? 'section' : node.type === 'column' ? 'column' : 'element';
  const devices: Device[] = ['desktop', 'tablet', 'mobile'];
  const bucket = (d: Device) => (d === 'desktop' ? ctx.out.base : d === 'tablet' ? ctx.out.tablet : ctx.out.mobile);

  for (const d of devices) {
    const s = node.style?.[d];
    if (kind === 'column') {
      // Width lives on the outer column (flex basis); every other style on the inner box.
      const w = len(s?.width);
      if (w) bucket(d).push(rule(sel, [`flex:0 0 ${w}`, `max-width:${w}`]));
      bucket(d).push(rule(`${sel} > .pb-col-inner`, declarations(s, { kind })));
    } else {
      bucket(d).push(rule(sel, declarations(s, { kind })));
    }
    const ov = overlayDecl(s);
    if (ov.length) bucket(d).push(rule(`${sel} > .pb-overlay`, ov));
  }

  // Columns stack below the section's breakpoint unless they have their own width there.
  if (kind === 'column' && parent) {
    const stack = parent.props?.stackOn || 'mobile';
    const full = ['flex:0 0 100%', 'max-width:100%'];
    if (stack === 'tablet' && !node.style?.tablet?.width) ctx.out.tablet.push(rule(sel, full));
    if (stack !== 'none' && !node.style?.mobile?.width) ctx.out.mobile.push(rule(sel, full));
  }
  if (kind === 'section' && node.props?.reverseOnMobile) {
    ctx.out.mobile.push(rule(`${sel} .pb-row`, ['flex-wrap:wrap-reverse']));
  }

  const hov = hoverDecl(node.hover);
  if (hov.length) {
    const target = kind === 'column' ? `${sel} > .pb-col-inner` : sel;
    ctx.out.base.push(rule(target, [`transition:all ${Number(node.style?.desktop?.transition) || 300}ms ease`]));
    ctx.out.base.push(rule(`${target}:hover`, hov));
  }

  const a = node.adv;
  if (a) {
    const hide = ctx.editing ? ['opacity:.35', 'outline:1px dashed #94a3b8'] : ['display:none !important'];
    const show = ctx.editing ? ['opacity:1', 'outline:none'] : [`display:${kind === 'element' ? 'block' : 'flex'} !important`];
    if (a.hideDesktop) ctx.out.base.push(rule(sel, hide));
    if (a.hideTablet) ctx.out.tablet.push(rule(sel, hide));
    else if (a.hideDesktop) ctx.out.tablet.push(rule(sel, show));
    if (a.hideMobile) ctx.out.mobile.push(rule(sel, hide));
    else if (a.hideDesktop || a.hideTablet) ctx.out.mobile.push(rule(sel, show));
    if (a.customCss) ctx.out.tail.push(scopeCustomCss(a.customCss, sel));
  }

  for (const c of node.children || []) walk(c, node, ctx);
}

/** The page's whole stylesheet: node rules plus page-wide settings and custom CSS. */
export function buildPageCss(doc: Pick<PageDoc, 'sections' | 'settings'>, { editing = false } = {}): string {
  const ctx: Ctx = { editing, out: { base: [], tablet: [], mobile: [], tail: [] } };
  for (const s of doc.sections) walk(s, null, ctx);
  const st = doc.settings;
  const root: string[] = [];
  if (st.bgColor) root.push(`background:${color(st.bgColor)}`);
  if (st.textColor) root.push(`color:${color(st.textColor)}`);
  if (st.fontBody) root.push(`font-family:${fontStackFor(st.fontBody)}`, `--hp-font-body:${fontStackFor(st.fontBody)}`);
  if (st.fontHeading) root.push(`--hp-font-heading:${fontStackFor(st.fontHeading)}`);
  return [
    rule('.pb-root', root),
    ...ctx.out.base,
    q(BREAKPOINT.tablet, ctx.out.tablet.filter(Boolean).join('')),
    q(BREAKPOINT.mobile, ctx.out.mobile.filter(Boolean).join('')),
    ...ctx.out.tail,
    scopeCustomCss(st.customCss, '.pb-root'),
  ].filter(Boolean).join('\n');
}

/** Google Fonts families used anywhere on the page (beyond the theme's two). */
export function collectFonts(doc: Pick<PageDoc, 'sections' | 'settings'>): string[] {
  const found = new Set<string>();
  const add = (n?: string) => { if (n && FONT_FAMILIES[n]) found.add(n); };
  add(doc.settings.fontBody); add(doc.settings.fontHeading);
  const visit = (n: PBNode) => {
    for (const d of ['desktop', 'tablet', 'mobile'] as Device[]) add(n.style?.[d]?.fontFamily);
    n.children?.forEach(visit);
  };
  doc.sections.forEach(visit);
  return [...found];
}

export function fontsLink(names: string[]): string {
  if (!names.length) return '';
  return `https://fonts.googleapis.com/css2?${names.map(n => `family=${FONT_FAMILIES[n].spec}`).join('&')}&display=swap`;
}
