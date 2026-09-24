// Ported from api/src/routes/siteConfig.js
import { prisma } from '@/lib/prisma';
import { requirePermission } from '../permissions';
import { body, handler, json } from '../http';
import { absoluteUploadPath, parseUpload } from '../upload';
import { unlink } from 'fs/promises';

/* Default config seeded on first call */
const DEFAULTS: Record<string, any> = {
  general: {
    companyName:    'Al Khadim LLC',
    companyEmail:   'info@alkhadim.ae',
    companyPhone:   '+971 4 XXX XXXX',
    companyAddress: 'Dubai, United Arab Emirates',
    currency:       'AED',
    currencySymbol: 'د.إ',
    dateFormat:     'DD/MM/YYYY',
    timezone:       'Asia/Dubai',
    fiscalYearStart:'01',   // month: 01 = January
    language:       'en',
  },
  theme: {
    primaryColor:    '#2563EB',
    primaryDark:     '#1d4ed8',
    primaryLight:    '#eff6ff',
    accentColor:     '#f59e0b',
    bgColor:         '#ffffff',
    textColor:       '#111827',
    navBg:           '#ffffff',
    footerBg:        '#0f172a',
    footerText:      '#94a3b8',
    btnRadius:       '9999px',
    cardRadius:      '1rem',
    fontFamily:      'Plus Jakarta Sans',
  },
  navbar: {
    logoText:   'Al Khadim',
    logoImage:  '',
    tagline:    'LLC',
    links: [
      { label: 'Home',       href: '/' },
      { label: 'Services',   href: '/services' },
      { label: 'Candidates', href: '/candidates' },
      { label: 'About',      href: '/about' },
      { label: 'Careers',    href: '/careers' },
      { label: 'Contact',    href: '/contact' },
    ],
    ctaLabel: 'Hire Talent',
    ctaHref:  '/enquiry',
    sticky: true,
    transparent: false,
  },
  hero: {
    enabled:     true,
    headline:    "Connecting UAE's\nBest Talent with\nTop Employers",
    subheadline: 'Hire expert professionals or find your next career move — trusted by 36+ leading UAE organisations since 2017.',
    bgType:      'image',  // 'image' | 'gradient' | 'color'
    bgImage:     'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=85',
    bgColor:     '#0f172a',
    bgGradient:  'from-slate-900 to-slate-700',
    overlayOpacity: 0.65,
    cta1Label:   'Hire Talent',
    cta1Href:    '/enquiry',
    cta2Label:   'Find Jobs',
    cta2Href:    '/careers',
    showSearch:  true,
    showAnnouncement: true,
    announcementText: '🇦🇪 Now serving across UAE — Dubai, Abu Dhabi, Sharjah & more.',
    announcementLink: '/enquiry',
    announcementLinkText: 'Get a free consultation',
  },
  sections: {
    clients:      { enabled: true, title: 'Trusted by Leading Organisations' },
    stats:        { enabled: true },
    services:     { enabled: true, title: 'Comprehensive HR Solutions', subtitle: 'From your first hire to full workforce management — every service in one trusted partnership.' },
    process:      { enabled: true, title: 'How We Deliver Excellence', subtitle: 'A proven 4-step framework trusted by 36+ leading UAE organisations' },
    whyUs:        { enabled: true, title: 'Why Leading Organisations Choose Al Khadim', subtitle: "We don't just fill positions — we build the teams that drive your business forward." },
    industries:   { enabled: true, title: 'Industries We Serve', subtitle: 'Deep domain expertise across every major sector in the UAE economy' },
    jobs:         { enabled: true, title: 'Latest Opportunities', subtitle: "Explore hand-curated roles from the UAE's top employers" },
    candidates:   { enabled: true, title: 'Our Talent Pool', subtitle: 'Browse top verified professionals' },
    globalBanner: { enabled: true, title: 'UAE-Based. Globally Connected.', subtitle: "Headquartered in Dubai, we tap into a global talent network to bring the world's best professionals to the UAE job market.", ctaLabel: 'Start a Conversation', ctaHref: '/enquiry' },
    testimonials: { enabled: true, title: "Trusted by the UAE's Best Teams" },
    awards:       { enabled: true },
    ceo:          { enabled: true },
    cvUpload:     { enabled: true, title: 'Are You Looking for Work?', subtitle: 'Upload your CV and get discovered' },
    cta:          { enabled: true, title: 'Ready to Build Your Dream Team?', subtitle: 'Connect with Al Khadim today' },
  },
  footer: {
    logoText:   'Al Khadim',
    tagline:    'Empowering Careers, Elevating Business',
    description:'Premier HR & recruitment consultancy across the UAE since 2017.',
    phone:      '+971 4 XXX XXXX',
    email:      'info@alkhadim.ae',
    address:    'Dubai, United Arab Emirates',
    copyright:  '© 2024 Al Khadim LLC. All rights reserved.',
    showSocials: true,
    socials: {
      linkedin:  '',
      instagram: '',
      twitter:   '',
      facebook:  '',
      whatsapp:  '',
    },
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
          { label: 'About Us',  href: '/about' },
          { label: 'Careers',   href: '/careers' },
          { label: 'Contact',   href: '/contact' },
          { label: 'Enquiry',   href: '/enquiry' },
        ],
      },
    ],
  },
};

/**
 * The public site sections this module manages. Other rows in the same table
 * (e.g. 'smtp', 'ai') hold private settings owned by other modules, so only
 * these keys may be read or written through /site-config/:key.
 */
const SITE_CONFIG_KEYS = Object.keys(DEFAULTS);

function isKnownKey(key: string) {
  return SITE_CONFIG_KEYS.includes(key);
}

async function getConfig(key: string) {
  const row = await prisma.siteConfig.findUnique({ where: { key } });
  if (row) return row.value;
  // seed default (skipDuplicates: a concurrent first read may have seeded it already)
  await prisma.siteConfig.createMany({ data: [{ key, value: DEFAULTS[key] }], skipDuplicates: true });
  return DEFAULTS[key];
}

/* ── Public: get all config ── */
export const getAll = handler(async () => {
  try {
    const rows = await prisma.siteConfig.findMany();
    const result: Record<string, any> = {};
    const keys = Object.keys(DEFAULTS);
    // ensure all keys exist
    for (const key of keys) {
      const row = rows.find((r) => r.key === key);
      result[key] = row ? row.value : DEFAULTS[key];
    }
    // seed missing
    const missing = keys.filter((k) => !rows.find((r) => r.key === k));
    if (missing.length) {
      await prisma.siteConfig.createMany({ data: missing.map((k) => ({ key: k, value: DEFAULTS[k] })), skipDuplicates: true });
    }
    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

/* ── Public: get one section ── */
export const getSection = handler<{ key: string }>(async (_req, { params }) => {
  if (!isKnownKey(params.key)) return json({ error: 'Unknown config section' }, 404);
  try {
    const val = await getConfig(params.key);
    return json(val);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

/* ── Admin: update one section ── */
export const updateSection = handler<{ key: string }>(async (req, { params }) => {
  const user = await requirePermission(req, 'site_editor', 'edit');
  if (!isKnownKey(params.key)) return json({ error: 'Unknown config section' }, 404);
  const value = await body(req);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return json({ error: 'Config value must be a JSON object' }, 400);
  }
  try {
    const val = await prisma.siteConfig.upsert({
      where: { key: params.key },
      create: { key: params.key, value, updatedBy: user?.id },
      update: { value, updatedBy: user?.id },
    });
    return json(val.value);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});

/* ── Admin: upload image for site (banner, logo etc) ── */
export const uploadImage = handler(async (req) => {
  await requirePermission(req, 'site_editor', 'edit');
  const { file } = await parseUpload(req, ['image']);
  if (!file) return json({ error: 'No file uploaded' }, 400);
  if (!file.mimetype.startsWith('image/')) {
    await unlink(absoluteUploadPath(file.path)).catch(() => {});
    return json({ error: 'Only image files can be uploaded here' }, 400);
  }
  // Root-relative, deliberately: an absolute URL bakes in whichever host did
  // the upload, so a value saved on a dev machine breaks everywhere else.
  // lib/mediaUrl.ts normalises the absolute values older rows still hold.
  const url = `/${file.path}`;
  return json({ url, path: file.path });
});
