/**
 * Brand theme every outgoing email is rendered with: colours, fonts, header
 * and footer. Stored as SiteConfig "emailTheme" and edited in Admin → Emails →
 * Brand & theme. Isomorphic (used by the builder preview and the mailer).
 */

export interface EmailTheme {
  brandName: string;
  /** Absolute or root-relative URL of the logo shown in the header. */
  logoUrl: string;
  logoWidth: number;
  tagline: string;
  headerStyle: 'band' | 'light' | 'minimal';
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  fontFamily: string;
  headingFontFamily: string;
  radius: number;
  buttonRadius: number;
  contentWidth: number;
  showFlagStripe: boolean;
  // Footer
  footerCompany: string;
  footerAddress: string;
  footerPhone: string;
  footerEmail: string;
  footerWebsite: string;
  footerNote: string;
  socials: { linkedin: string; instagram: string; facebook: string; twitter: string; youtube: string; whatsapp: string };
}

export const EMAIL_FONTS: { value: string; label: string }[] = [
  { value: "Arial, 'Helvetica Neue', Helvetica, sans-serif", label: 'Arial / Helvetica' },
  { value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", label: 'Segoe UI' },
  { value: "Verdana, Geneva, sans-serif", label: 'Verdana' },
  { value: "'Trebuchet MS', Tahoma, sans-serif", label: 'Trebuchet MS' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia (serif)' },
];

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  brandName: 'Al Khadim LLC',
  logoUrl: '/brand/logo-192.png',
  logoWidth: 56,
  tagline: 'People · Solutions · Global Opportunities',
  headerStyle: 'band',
  primary: '#0D4E60',
  accent: '#C6A15B',
  background: '#F2F4F5',
  surface: '#FFFFFF',
  text: '#1F2A30',
  muted: '#5F6B70',
  border: '#E3E8EA',
  fontFamily: EMAIL_FONTS[0].value,
  headingFontFamily: EMAIL_FONTS[0].value,
  radius: 12,
  buttonRadius: 8,
  contentWidth: 600,
  showFlagStripe: true,
  footerCompany: 'Al Khadim LLC',
  footerAddress: 'Sharjah Media City, Sharjah, United Arab Emirates',
  footerPhone: '+971 56 984 2508',
  footerEmail: 'info@alkhadim.ae',
  footerWebsite: 'www.alkhadim.ae',
  footerNote: 'You are receiving this email because of your account or recent activity with Al Khadim.',
  socials: { linkedin: '', instagram: '', facebook: '', twitter: '', youtube: '', whatsapp: '' },
};

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

export function normalizeEmailTheme(raw: any): EmailTheme {
  const v = isObj(raw) ? raw : {};
  return {
    ...DEFAULT_EMAIL_THEME,
    ...v,
    socials: { ...DEFAULT_EMAIL_THEME.socials, ...(isObj(v.socials) ? v.socials : {}) },
  };
}

/** Server-side cleaning: known keys only, sensible bounds. */
export function cleanEmailTheme(raw: any): EmailTheme {
  const t = normalizeEmailTheme(raw);
  const hex = (v: any, d: string) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : d);
  const str = (v: any, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: any, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  const d = DEFAULT_EMAIL_THEME;
  return {
    brandName: str(t.brandName, 100), logoUrl: str(t.logoUrl, 500), logoWidth: num(t.logoWidth, 24, 240, d.logoWidth),
    tagline: str(t.tagline, 150),
    headerStyle: (['band', 'light', 'minimal'] as const).includes(t.headerStyle) ? t.headerStyle : d.headerStyle,
    primary: hex(t.primary, d.primary), accent: hex(t.accent, d.accent), background: hex(t.background, d.background),
    surface: hex(t.surface, d.surface), text: hex(t.text, d.text), muted: hex(t.muted, d.muted), border: hex(t.border, d.border),
    fontFamily: EMAIL_FONTS.some(f => f.value === t.fontFamily) ? t.fontFamily : d.fontFamily,
    headingFontFamily: EMAIL_FONTS.some(f => f.value === t.headingFontFamily) ? t.headingFontFamily : d.headingFontFamily,
    radius: num(t.radius, 0, 32, d.radius), buttonRadius: num(t.buttonRadius, 0, 40, d.buttonRadius),
    contentWidth: num(t.contentWidth, 480, 720, d.contentWidth), showFlagStripe: !!t.showFlagStripe,
    footerCompany: str(t.footerCompany, 120), footerAddress: str(t.footerAddress, 300), footerPhone: str(t.footerPhone, 60),
    footerEmail: str(t.footerEmail, 120), footerWebsite: str(t.footerWebsite, 200), footerNote: str(t.footerNote, 500),
    socials: Object.fromEntries(Object.keys(d.socials).map(k => [k, str((t.socials as any)[k], 300)])) as EmailTheme['socials'],
  };
}
