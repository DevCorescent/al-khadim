/**
 * Website configuration stored in site_config: the `homepage` document (theme,
 * SEO and the ordered section list) plus the defaults the site-wide `navbar`
 * and `footer` documents are merged over. Isomorphic — no React, no Prisma.
 */
import { SECTION_BY_TYPE, SECTION_DEFS, STYLE_DEFAULTS } from './schema';

/* ─── Theme ─────────────────────────────────────────────────────────────── */

export interface HomeTheme {
  preset: string;
  primary: string; primaryDark: string; accent: string; gold: string;
  ink: string; sand: string; surface: string; text: string; muted: string;
  headingFont: string; bodyFont: string;
  radius: 'sharp' | 'soft' | 'rounded' | 'pill';
  animations: boolean;
  flagStripe: boolean;
}

/** UAE flag green / red / black / white, with desert gold and sand as supporting tones. */
export const THEME_PRESETS: { id: string; label: string; description: string; theme: Partial<HomeTheme> }[] = [
  {
    id: 'al-khadim', label: 'Al Khadim Teal', description: 'Logo teal with champagne gold',
    theme: { primary: '#0F5468', primaryDark: '#0A3D4C', accent: '#2A8C9E', gold: '#C6A15B', ink: '#061E26', sand: '#F5F2EB', surface: '#FFFFFF', text: '#0B1F26', muted: '#5A6B70' },
  },
  {
    id: 'uae-heritage', label: 'UAE Heritage', description: 'Flag green and red with desert gold',
    theme: { primary: '#00732F', primaryDark: '#00521F', accent: '#C8102E', gold: '#B8935A', ink: '#08130D', sand: '#F7F2E8', surface: '#FFFFFF', text: '#0E1A14', muted: '#5C6660' },
  },
  {
    id: 'desert-gold', label: 'Desert Gold', description: 'Warm gold lead with green accents',
    theme: { primary: '#9C7A44', primaryDark: '#7A5E31', accent: '#00732F', gold: '#C9A24D', ink: '#17130D', sand: '#FAF5EC', surface: '#FFFFFF', text: '#1D1810', muted: '#6B6255' },
  },
  {
    id: 'emirates-night', label: 'Emirates Night', description: 'Deep black with gold and green',
    theme: { primary: '#00843D', primaryDark: '#006130', accent: '#EF3340', gold: '#D4AF37', ink: '#050505', sand: '#F3F2EE', surface: '#FFFFFF', text: '#111111', muted: '#5F5F5F' },
  },
  {
    id: 'falcon-red', label: 'Falcon Red', description: 'Flag red lead with green and gold',
    theme: { primary: '#C8102E', primaryDark: '#9C0B22', accent: '#00732F', gold: '#B8935A', ink: '#120A0B', sand: '#F8F3EE', surface: '#FFFFFF', text: '#1A1213', muted: '#685C5D' },
  },
];

export const DEFAULT_THEME: HomeTheme = {
  preset: 'al-khadim',
  ...(THEME_PRESETS[0].theme as any),
  headingFont: 'Manrope',
  bodyFont: 'Plus Jakarta Sans',
  radius: 'soft',
  animations: true,
  flagStripe: true,
};

/** Google Fonts families offered in the builder, with the weights each one ships. */
export const FONT_FAMILIES: Record<string, { spec: string; kind: 'serif' | 'sans' }> = {
  'Playfair Display':   { spec: 'Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600', kind: 'serif' },
  'Cormorant Garamond': { spec: 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600', kind: 'serif' },
  'DM Serif Display':   { spec: 'DM+Serif+Display:ital@0;1', kind: 'serif' },
  'Marcellus':          { spec: 'Marcellus', kind: 'serif' },
  'Plus Jakarta Sans':  { spec: 'Plus+Jakarta+Sans:wght@400;500;600;700;800', kind: 'sans' },
  'Sora':               { spec: 'Sora:wght@400;500;600;700', kind: 'sans' },
  'Outfit':             { spec: 'Outfit:wght@400;500;600;700', kind: 'sans' },
  'Montserrat':         { spec: 'Montserrat:wght@400;500;600;700;800', kind: 'sans' },
  'Manrope':            { spec: 'Manrope:wght@400;500;600;700;800', kind: 'sans' },
  'Inter':              { spec: 'Inter:wght@400;500;600;700', kind: 'sans' },
  'DM Sans':            { spec: 'DM+Sans:wght@400;500;600;700', kind: 'sans' },
  'Poppins':            { spec: 'Poppins:wght@400;500;600;700', kind: 'sans' },
  'Tajawal':            { spec: 'Tajawal:wght@400;500;700;800', kind: 'sans' },
};

/** Arabic glyphs (logo, emirate names) always use this face. */
const ARABIC_FONT = { name: 'Tajawal', spec: 'Tajawal:wght@500;700' };

export function fontsHref(theme: HomeTheme): string {
  const specs = new Set<string>();
  for (const name of [theme.headingFont, theme.bodyFont]) {
    const f = FONT_FAMILIES[name];
    if (f) specs.add(f.spec);
  }
  if (![...specs].some(s => s.startsWith('Tajawal'))) specs.add(ARABIC_FONT.spec);
  return `https://fonts.googleapis.com/css2?${[...specs].map(s => `family=${s}`).join('&')}&display=swap`;
}

const RADII: Record<HomeTheme['radius'], { btn: string; card: string }> = {
  sharp:   { btn: '2px',    card: '4px' },
  soft:    { btn: '10px',   card: '16px' },
  rounded: { btn: '14px',   card: '24px' },
  pill:    { btn: '9999px', card: '24px' },
};

function hexToRgb(hex: string, fallback: string): string {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hexToRgb(fallback, '#000000');
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function fontStack(name: string) {
  const f = FONT_FAMILIES[name];
  const generic = f?.kind === 'serif' ? 'Georgia, serif' : '-apple-system, BlinkMacSystemFont, sans-serif';
  return `'${name}', ${generic}`;
}

/** CSS custom properties consumed by the `hp-*` Tailwind colours and fonts. */
export function themeVars(t: HomeTheme): Record<string, string> {
  const d = DEFAULT_THEME;
  const r = RADII[t.radius] || RADII.soft;
  return {
    '--hp-primary':      hexToRgb(t.primary, d.primary),
    '--hp-primary-dark': hexToRgb(t.primaryDark, d.primaryDark),
    '--hp-accent':       hexToRgb(t.accent, d.accent),
    '--hp-gold':         hexToRgb(t.gold, d.gold),
    '--hp-ink':          hexToRgb(t.ink, d.ink),
    '--hp-sand':         hexToRgb(t.sand, d.sand),
    '--hp-surface':      hexToRgb(t.surface, d.surface),
    '--hp-text':         hexToRgb(t.text, d.text),
    '--hp-muted':        hexToRgb(t.muted, d.muted),
    '--hp-font-heading': fontStack(t.headingFont),
    '--hp-font-body':    fontStack(t.bodyFont),
    '--hp-font-arabic':  `'${ARABIC_FONT.name}', sans-serif`,
    '--hp-radius-btn':   r.btn,
    '--hp-radius-card':  r.card,
  };
}

export function themeCss(t: HomeTheme): string {
  return `:root{${Object.entries(themeVars(t)).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}

/* ─── Homepage document ─────────────────────────────────────────────────── */

export interface HomeSection {
  id: string;
  type: string;
  enabled: boolean;
  [key: string]: any;
}

export interface HomeSeo { title: string; description: string; keywords: string; ogImage: string }

export interface HomepageConfig {
  version: 1;
  theme: HomeTheme;
  seo: HomeSeo;
  sections: HomeSection[];
}

export const DEFAULT_SEO: HomeSeo = {
  title: 'Al Khadim LLC — HR & Recruitment Consultancy in the UAE',
  description: 'Al Khadim LLC is a UAE HR consultancy offering placement, recruitment, outsourcing, visa & PRO and management consultancy services across all seven Emirates.',
  keywords: 'HR consultancy UAE, recruitment agency Dubai, manpower outsourcing, placement services UAE',
  ogImage: '',
};

export const DEFAULT_ORDER = [
  'hero', 'serviceStrip', 'stats', 'industries', 'globalHiring', 'logos', 'about', 'services', 'process',
  'features', 'emirates', 'jobs', 'candidates', 'testimonials', 'awards', 'leadership', 'cvUpload', 'faq', 'cta',
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function newSection(type: string, id?: string): HomeSection {
  const def = SECTION_BY_TYPE[type];
  return {
    ...clone(STYLE_DEFAULTS),
    ...clone(def?.defaults || {}),
    id: id || `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    enabled: true,
  };
}

/* Legacy `hero` / `sections` documents (the previous homepage) ──────────── */

const LEGACY_HERO_HEADLINE = "Connecting UAE's\nBest Talent with\nTop Employers";
const LEGACY_HERO_SUB = 'Hire expert professionals or find your next career move — trusted by 36+ leading UAE organisations since 2017.';

const LEGACY_SECTION_MAP: Record<string, string> = {
  clients: 'logos', stats: 'stats', services: 'services', process: 'process', whyUs: 'features',
  industries: 'industries', jobs: 'jobs', candidates: 'candidates', globalBanner: 'emirates',
  testimonials: 'testimonials', awards: 'awards', ceo: 'leadership', cvUpload: 'cvUpload', cta: 'cta',
};

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const nameOf = (v: any) => (typeof v === 'string' ? v : v?.name);

/**
 * The first homepage document, built from the shipped defaults plus whatever real
 * content was entered in the previous editor (client names, figures, testimonials,
 * accreditations, a customised hero). Content is carried over; the old default copy
 * is not, so the new design starts with its own wording.
 */
export function buildInitialHomepage(legacy?: { hero?: any; sections?: any }): HomepageConfig {
  const sections = DEFAULT_ORDER.map(type => newSection(type, type));
  const byType = Object.fromEntries(sections.map(s => [s.type, s]));
  const hero = legacy?.hero;
  const old = legacy?.sections || {};

  if (hero && typeof hero === 'object') {
    const h = byType.hero;
    if (hero.enabled === false) h.enabled = false;
    if (hero.headline && hero.headline !== LEGACY_HERO_HEADLINE) h.headline = hero.headline;
    if (hero.subheadline && hero.subheadline !== LEGACY_HERO_SUB) h.subheadline = hero.subheadline;
    const stats = arr(hero.stats).filter(s => s?.value && s?.label).map(s => ({ value: String(s.value), label: String(s.label) }));
    if (stats.length) h.stats = stats;
  }

  for (const [oldKey, type] of Object.entries(LEGACY_SECTION_MAP)) {
    if (old[oldKey]?.enabled === false) byType[type].enabled = false;
  }

  const clients = arr(old.clients?.items).map(nameOf).filter(Boolean);
  const partners = arr(old.awards?.partners).map(nameOf).filter(Boolean);
  const logoNames = [...new Set([...clients, ...partners])];
  if (logoNames.length) byType.logos.items = logoNames.map(name => ({ name, logo: '', href: '' }));

  const stats = arr(old.stats?.items).filter(s => s?.label && Number.isFinite(Number(s.value)));
  if (stats.length) {
    byType.stats.items = stats.map(s => ({
      prefix: '', value: String(s.value), suffix: s.suffix ?? '', label: String(s.label), description: s.sub ?? '',
    }));
  }

  const testimonials = arr(old.testimonials?.items).filter(t => t?.quote && t?.author);
  if (testimonials.length) {
    byType.testimonials.items = testimonials.map(t => ({
      quote: t.quote, author: t.author, role: t.role || '', company: t.company || '',
      rating: Number(t.rating) > 0 ? String(t.rating) : '', photo: '',
    }));
  }

  const awards = arr(old.awards?.items).filter(a => a?.label);
  if (awards.length) {
    byType.awards.items = awards.map(a => ({ title: a.label, issuer: a.issuer || '', year: a.year || '', image: '' }));
  }

  const metrics = arr(old.globalBanner?.metrics).filter(m => m?.value && m?.label);
  if (metrics.length) byType.emirates.metrics = metrics.map(m => ({ value: String(m.value), label: String(m.label) }));

  return { version: 1, theme: clone(DEFAULT_THEME), seo: clone(DEFAULT_SEO), sections };
}

/**
 * Fills in anything a stored document lacks — fields added to a section after it
 * was saved, an unknown section type from a newer build — so renderers can rely
 * on every field being present.
 */
export function normalizeHomepage(raw: any, legacy?: { hero?: any; sections?: any }): HomepageConfig {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return buildInitialHomepage(legacy);
  const seen = new Set<string>();
  const sections: HomeSection[] = [];
  for (const s of raw.sections) {
    if (!s || typeof s !== 'object' || !SECTION_BY_TYPE[s.type]) continue;
    let id = typeof s.id === 'string' && s.id ? s.id : `${s.type}-${sections.length}`;
    if (seen.has(id)) id = `${id}-${sections.length}`;
    seen.add(id);
    sections.push({ ...newSection(s.type, id), ...s, id, enabled: s.enabled !== false });
  }
  return {
    version: 1,
    theme: { ...DEFAULT_THEME, ...(raw.theme && typeof raw.theme === 'object' ? raw.theme : {}) },
    seo: { ...DEFAULT_SEO, ...(raw.seo && typeof raw.seo === 'object' ? raw.seo : {}) },
    sections,
  };
}

/* ─── Header & footer ───────────────────────────────────────────────────── */

/** The menu every earlier release shipped; a stored menu still equal to it was never customised. */
const LEGACY_NAV_LINKS = [
  { label: 'Home',       href: '/' },
  { label: 'Services',   href: '/services' },
  { label: 'Candidates', href: '/candidates' },
  { label: 'About',      href: '/about' },
  { label: 'Careers',    href: '/careers' },
  { label: 'Contact',    href: '/contact' },
];

export const NAVBAR_DEFAULTS = {
  layout: 'twoRow',
  logoText: 'Al Khadim',
  tagline: 'LLC',
  logoArabic: 'الخادم ذ.م.م',
  logoSubtitle: 'People | Solutions | Global Opportunities',
  logoImage: '',
  logoImageOnDark: '',
  headerTagline: 'Your trusted HR & manpower partner in the UAE & beyond',
  links: [
    { label: 'Home', href: '/', children: [] },
    { label: 'About Us', href: '/about', children: [] },
    {
      label: 'Services', href: '/services', children: [
        { label: 'Placement Services',     href: '/services#placement' },
        { label: 'Recruitment Services',   href: '/services#recruitment' },
        { label: 'Outsourcing Solutions',  href: '/services#outsourcing' },
        { label: 'Management Consultancy', href: '/services#consultancy' },
        { label: 'Visa & PRO Services',    href: '/services#residency' },
      ],
    },
    {
      label: 'Industries', href: '/#industries', children: [
        { label: 'Construction', href: '/careers?industry=Construction' },
        { label: 'Oil & Gas',    href: '/careers?industry=Energy' },
        { label: 'Hospitality',  href: '/careers?industry=Hospitality' },
        { label: 'Healthcare',   href: '/careers?industry=Healthcare' },
        { label: 'IT & Tech',    href: '/careers?industry=Technology' },
      ],
    },
    {
      label: 'Employers', href: '/enquiry', children: [
        { label: 'Hire Talent',        href: '/enquiry' },
        { label: 'Browse Candidates',  href: '/candidates' },
        { label: 'Register Company',   href: '/company/register' },
        { label: 'Company Login',      href: '/company/login' },
      ],
    },
    {
      label: 'Job Seekers', href: '/careers', children: [
        { label: 'Find Jobs',       href: '/careers' },
        { label: 'Upload Your CV',  href: '/candidate/register' },
        { label: 'Candidate Login', href: '/candidate/login' },
      ],
    },
    { label: 'Global Hiring', href: '/#global-hiring', children: [] },
    { label: 'Contact', href: '/contact', children: [] },
  ],
  ctaLabel: 'Get in Touch',
  ctaHref: '/contact',
  showSearch: true,
  searchPlaceholder: 'Search jobs, e.g. Civil Engineer',
  langLabel: '',
  langHref: '',
  expertLabel: 'Talk to our experts',
  expertPhone: '',
  showLogin: true,
  loginLabel: 'Log in',
  loginLinks: [
    { label: 'Candidate',     href: '/candidate/login', icon: 'Briefcase' },
    { label: 'Company',       href: '/company/login',   icon: 'Building2' },
    { label: 'Staff / Admin', href: '/login',           icon: 'ShieldCheck' },
  ],
  transparentOnHero: true,
  topBarEnabled: true,
  topBarText: 'HR & Recruitment Consultancy · United Arab Emirates',
  topBarPhone: '',
  topBarEmail: '',
  topBarHours: 'Mon – Fri · 9:00 – 18:00 GST',
  topBarSocials: true,
};

export const FOOTER_DEFAULTS = {
  logoText: 'Al Khadim',
  tagline: 'LLC',
  logoArabic: 'الخادم',
  logoImage: '',
  description: 'HR & recruitment consultancy serving employers and professionals across the United Arab Emirates since 2017.',
  phone: '',
  email: 'info@alkhadim.ae',
  address: 'United Arab Emirates',
  mapUrl: '',
  hours: 'Monday – Friday, 9:00 – 18:00 GST',
  copyright: `© {year} Al Khadim LLC. All rights reserved.`,
  licenseText: '',
  showSocials: true,
  socials: { linkedin: '', instagram: '', twitter: '', facebook: '', youtube: '', whatsapp: '' },
  columns: [
    {
      title: 'Services',
      links: [
        { label: 'Placement',   href: '/services#placement' },
        { label: 'Recruitment', href: '/services#recruitment' },
        { label: 'Outsourcing', href: '/services#outsourcing' },
        { label: 'Consultancy', href: '/services#consultancy' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Careers',  href: '/careers' },
        { label: 'Contact',  href: '/contact' },
        { label: 'Enquiry',  href: '/enquiry' },
      ],
    },
  ],
  legalLinks: [] as { label: string; href: string }[],
  ctaEnabled: true,
  ctaTitle: 'Ready to build your team?',
  ctaText: 'Talk to a consultant about your hiring needs today.',
  ctaLabel: 'Get in touch',
  ctaHref: '/enquiry',
  showFlagStripe: true,
};

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

export function normalizeNavbar(raw: any) {
  const v = isObj(raw) ? raw : {};
  const stored = Array.isArray(v.links) ? v.links : null;
  const untouched = stored && JSON.stringify(stored.map((l: any) => ({ label: l?.label, href: l?.href }))) === JSON.stringify(LEGACY_NAV_LINKS);
  // Menus saved before the header gained a layout field get the new layout and,
  // when they still match the old default exactly, the new dropdown menu.
  const legacy = !('layout' in v);
  return { ...NAVBAR_DEFAULTS, ...v,
    ...(legacy && (v.ctaLabel === 'Hire Talent' || !v.ctaLabel) ? { ctaLabel: NAVBAR_DEFAULTS.ctaLabel, ctaHref: NAVBAR_DEFAULTS.ctaHref } : {}),
    ...(legacy && (!v.logoArabic || v.logoArabic === 'الخادم') ? { logoArabic: NAVBAR_DEFAULTS.logoArabic } : {}),
    links: stored && !untouched ? stored : NAVBAR_DEFAULTS.links,
    loginLinks: Array.isArray(v.loginLinks) ? v.loginLinks : NAVBAR_DEFAULTS.loginLinks };
}

export function normalizeFooter(raw: any) {
  const v = isObj(raw) ? raw : {};
  return {
    ...FOOTER_DEFAULTS, ...v,
    socials: { ...FOOTER_DEFAULTS.socials, ...(isObj(v.socials) ? v.socials : {}) },
    columns: Array.isArray(v.columns) ? v.columns : FOOTER_DEFAULTS.columns,
    legalLinks: Array.isArray(v.legalLinks) ? v.legalLinks : [],
  };
}

/** Every section type, for the builder's "Add section" library. */
export const SECTION_LIBRARY = SECTION_DEFS;

/* ─── Small rendering helpers shared by server and client ──────────────── */

/** Only same-site paths, anchors, http(s), mailto and tel links are rendered. */
export function safeHref(href?: string | null): string {
  const v = String(href ?? '').trim();
  if (!v) return '';
  if (v.startsWith('/') || v.startsWith('#')) return v;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
  return `/${v}`;
}
