/**
 * Page builder document model. Isomorphic (no React, no Prisma) so the editor,
 * the public renderer and the API's sanitiser all share it.
 *
 *   PageDoc ─ sections[] ─ columns[] ─ elements[]
 *
 * Every node carries `props` (content, element-specific design), `style`
 * (box styles per device; tablet/mobile only hold overrides), `hover` and
 * `adv` (animation, visibility, CSS id/class, custom CSS).
 */

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICES: Device[] = ['desktop', 'tablet', 'mobile'];

/** Canvas widths, and the container-query breakpoints tablet/mobile styles apply below. */
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 834, mobile: 390 };
export const BREAKPOINT = { tablet: 1024, mobile: 767 } as const;

export type StyleProps = Partial<Record<StyleKey, string>>;

export const STYLE_KEYS = [
  // spacing
  'mt', 'mr', 'mb', 'ml', 'pt', 'pr', 'pb', 'pl',
  // size & layout
  'width', 'maxWidth', 'minHeight', 'height', 'gap', 'position', 'top', 'zIndex', 'overflow', 'alignSelf',
  // typography
  'textAlign', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textTransform', 'fontStyle', 'textDecoration', 'textShadow',
  // background
  'bgType', 'bgColor', 'gradFrom', 'gradTo', 'gradAngle', 'gradKind', 'gradMid', 'bgImage', 'bgSize', 'bgPos',
  'bgRepeat', 'bgAttach', 'overlay', 'overlayOpacity', 'overlayFrom', 'overlayTo', 'overlayAngle',
  // border
  'borderWidth', 'borderStyle', 'borderColor', 'radius', 'borderSides',
  // effects
  'shadow', 'shadowCustom', 'opacity', 'rotate', 'scale', 'translateX', 'translateY', 'blur', 'backdropBlur',
  'filter', 'mixBlend', 'cursor', 'transition',
] as const;
export type StyleKey = typeof STYLE_KEYS[number];

export const HOVER_KEYS = ['color', 'bgColor', 'borderColor', 'shadow', 'scale', 'translateY', 'opacity', 'rotate', 'filter'] as const;
export type HoverProps = Partial<Record<typeof HOVER_KEYS[number], string>>;

export interface AdvancedProps {
  anim?: string;          // entrance animation key
  animDuration?: string;  // ms
  animDelay?: string;     // ms
  animEasing?: string;
  animRepeat?: boolean;   // replay every time it scrolls into view
  hideDesktop?: boolean;
  hideTablet?: boolean;
  hideMobile?: boolean;
  cssId?: string;
  cssClass?: string;
  customCss?: string;     // `selector` refers to this node
  label?: string;         // name shown in the layers panel
  locked?: boolean;       // editor: cannot be moved or deleted
  hidden?: boolean;       // editor & site: switched off entirely
  ariaLabel?: string;
}

export interface PBNode {
  id: string;
  type: string;
  props: Record<string, any>;
  style?: Partial<Record<Device, StyleProps>>;
  hover?: HoverProps;
  adv?: AdvancedProps;
  children?: PBNode[];
}

export interface PageSettings {
  showNavbar: boolean;
  showFooter: boolean;
  /** Let the navbar float over the first section (for full-bleed dark heroes). */
  navOverlay: boolean;
  bgColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
  contentWidth: number;   // default boxed width (px) for new sections
  customCss: string;      // page-wide CSS; `.pb-root` scopes it
  smoothScroll: boolean;
  backToTop: boolean;
}

export interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  noindex: boolean;
  canonical: string;
}

export interface PageDoc {
  version: 1;
  settings: PageSettings;
  seo: PageSeo;
  sections: PBNode[];
}

export const DEFAULT_SETTINGS: PageSettings = {
  showNavbar: true,
  showFooter: true,
  navOverlay: false,
  bgColor: '',
  textColor: '',
  fontHeading: '',
  fontBody: '',
  contentWidth: 1240,
  customCss: '',
  smoothScroll: true,
  backToTop: false,
};

export const DEFAULT_SEO: PageSeo = { title: '', description: '', keywords: '', ogImage: '', noindex: false, canonical: '' };

/** First-level URL segments owned by the app; pages may not use them as slugs. */
export const RESERVED_SLUGS = [
  'about', 'admin', 'api', 'candidate', 'candidates', 'careers', 'company', 'contact', 'enquiry', 'login',
  'register', 'services', 'uploads', '_next', 'brand', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'icon.png',
  'apple-icon.png', 'p', 'preview', 'page-preview', 'static', 'public', 'assets', 'index', 'home',
];

export function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function slugError(slug: string): string | null {
  if (!slug) return 'Enter a URL slug';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return 'Use lowercase letters, numbers and single hyphens';
  if (slug.length > 80) return 'Keep the slug under 80 characters';
  if (RESERVED_SLUGS.includes(slug)) return `"/${slug}" is already used by the site`;
  return null;
}
