/**
 * Ready-made sections ("blocks") and whole-page starting points. Each is a
 * factory so every insert gets fresh ids.
 */
import { newColumn, newNode, newSection } from './doc';
import { SECTION_DEF } from './elements';
import type { PBNode, StyleProps } from './types';

const el = (type: string, props: Record<string, any> = {}, desktop?: StyleProps, extra: Partial<PBNode> = {}): PBNode => {
  const n = newNode(type, props);
  if (desktop) n.style = { ...n.style, desktop: { ...(n.style?.desktop || {}), ...desktop } };
  return { ...n, ...extra };
};

function sec(widths: number[], cols: PBNode[][], props: Record<string, any> = {}, desktop: StyleProps = {}, mobile: StyleProps = {}, colProps: Record<string, any>[] = []): PBNode {
  const s = newSection(widths, props);
  s.style = {
    ...s.style,
    desktop: { ...(SECTION_DEF.style?.desktop || {}), ...desktop },
    mobile: { ...(SECTION_DEF.style?.mobile || {}), ...mobile },
  };
  s.children = (s.children || []).map((c, i) => ({ ...c, props: { ...c.props, ...(colProps[i] || {}) }, children: cols[i] || [] }));
  return s;
}

const intro = (eyebrow: string, title: string, text?: string, align: 'center' | 'left' = 'center', dark = false): PBNode[] => [
  el('heading', { eyebrow, text: title, tag: 'h2', size: 'xl', align, color: dark ? '#ffffff' : '' }),
  ...(text ? [el('text', { html: `<p>${text}</p>`, size: 'lg', align, color: dark ? 'rgba(255,255,255,.75)' : '' }, { maxWidth: align === 'center' ? '680' : '', ml: align === 'center' ? 'auto' : '', mr: align === 'center' ? 'auto' : '' })] : []),
];

const darkBg: StyleProps = { bgType: 'gradient', gradFrom: 'primary-dark', gradTo: 'ink', gradAngle: '135', color: '#ffffff' };
const sandBg: StyleProps = { bgType: 'color', bgColor: 'sand' };

export interface BlockTemplate { id: string; label: string; category: string; description: string; build: () => PBNode }

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  /* Heroes */
  {
    id: 'hero-image', label: 'Hero — full image', category: 'Hero', description: 'Headline over a darkened photo',
    build: () => sec([100], [[el('hero', {})]], { width: 'full' }, { pt: '0', pb: '0', pl: '0', pr: '0' }, { pt: '0', pb: '0', pl: '0', pr: '0' }),
  },
  {
    id: 'hero-centered', label: 'Hero — centred', category: 'Hero', description: 'Centred headline on a brand gradient',
    build: () => sec([100], [[
      el('heading', { eyebrow: 'Al Khadim · Since 2017', eyebrowStyle: 'pill', text: 'Workforce solutions for a *growing* UAE', tag: 'h1', size: 'display', align: 'center', color: '#ffffff', highlight: 'gold' }, { maxWidth: '900', ml: 'auto', mr: 'auto' }),
      el('text', { html: '<p>Recruitment, outsourcing and PRO services — delivered with speed, compliance and care across all seven emirates.</p>', size: 'lg', align: 'center', color: 'rgba(255,255,255,.78)' }, { maxWidth: '640', ml: 'auto', mr: 'auto' }),
      el('buttons', { align: 'center', size: 'lg', items: [{ label: 'Hire talent', href: '/enquiry', variant: 'gold', icon: 'ArrowRight', iconPos: 'right' }, { label: 'Explore services', href: '/services', variant: 'white', iconPos: 'right' }] }, { mt: '12' }),
    ]], { pattern: 'arabesque', flagStripe: true, shapeBottom: 'curve', shapeBottomColor: '#ffffff' }, { ...darkBg, pt: '150', pb: '140', minHeight: '640' }, { pt: '110', pb: '100', minHeight: '0' }),
  },
  {
    id: 'hero-split', label: 'Hero — split', category: 'Hero', description: 'Text left, framed image right',
    build: () => sec([55, 45], [[
      el('heading', { eyebrow: 'Trusted HR partner', text: 'Hire *faster*. Stay compliant. Grow with confidence.', tag: 'h1', size: 'xxl' }),
      el('text', { html: '<p>From one specialist to an entire workforce, we source, screen, process and deploy the people your business needs.</p>', size: 'lg' }),
      el('iconList', { layout: 'grid2', items: [{ text: 'MOHRE licensed' }, { text: 'Visa & PRO included' }, { text: 'GCC-wide sourcing' }, { text: 'Replacement guarantee' }] }),
      el('buttons', { size: 'lg' }, { mt: '8' }),
    ], [
      el('image', { src: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80', alt: 'Team meeting', aspect: '4/3', frame: 'gold' }, { radius: '24' }),
    ]], { vAlign: 'center' }, { pt: '140', pb: '96' }, { pt: '100', pb: '56' }),
  },
  {
    id: 'hero-slider', label: 'Hero — slider', category: 'Hero', description: 'Full-width image slider with captions',
    build: () => sec([100], [[el('carousel', { height: 640, mobileHeight: 520 }, { radius: '0' })]], { width: 'full' }, { pt: '0', pb: '0', pl: '0', pr: '0' }, { pt: '0', pb: '0', pl: '0', pr: '0' }),
  },
  {
    id: 'page-header', label: 'Page header', category: 'Hero', description: 'Compact title band for inner pages',
    build: () => sec([100], [[
      el('heading', { eyebrow: 'About us', eyebrowStyle: 'line', text: 'Our *story*', tag: 'h1', size: 'xxl', align: 'center', color: '#ffffff', highlight: 'gold' }),
      el('text', { html: '<p>Building careers and businesses across the UAE since 2017.</p>', size: 'lg', align: 'center', color: 'rgba(255,255,255,.75)' }),
    ]], { pattern: 'dots', flagStripe: true }, { ...darkBg, pt: '150', pb: '80' }, { pt: '110', pb: '56' }),
  },

  /* Content */
  {
    id: 'features-grid', label: 'Features grid', category: 'Features', description: 'Heading with six feature cards',
    build: () => sec([100], [[...intro('What we do', 'Everything your workforce needs', 'One partner for hiring, managing and supporting your people in the UAE.'), el('featureGrid', {}, { mt: '24' })]]),
  },
  {
    id: 'icon-boxes', label: 'Three icon boxes', category: 'Features', description: 'Three columns with icon boxes',
    build: () => sec([33.333, 33.333, 33.334], [
      [el('iconBox', { icon: 'Rocket', title: 'Fast shortlists', text: 'Screened candidates within days, not weeks.', card: 'shadow' })],
      [el('iconBox', { icon: 'ShieldCheck', title: 'Fully compliant', text: 'Licensed, transparent and audit-ready processes.', card: 'shadow' })],
      [el('iconBox', { icon: 'HeartHandshake', title: 'Long-term partner', text: 'Dedicated managers who know your business.', card: 'shadow' })],
    ], {}, sandBg),
  },
  {
    id: 'image-text', label: 'Image + text', category: 'Content', description: 'Image on the left, story on the right',
    build: () => sec([50, 50], [
      [el('image', { src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80', alt: 'Our team', aspect: '4/3', frame: 'offset' })],
      [
        el('heading', { eyebrow: 'Who we are', text: 'People-first since *2017*' }),
        el('text', { html: '<p>Al Khadim was founded to make hiring in the UAE simpler, faster and fairer. Today we support leading organisations across hospitality, construction, healthcare, retail and more.</p><p>Our registered office is in Sharjah Media City, with teams across the GCC and India.</p>' }),
        el('buttons', { items: [{ label: 'About us', href: '/about', variant: 'primary', icon: 'ArrowRight', iconPos: 'right' }] }),
      ],
    ], { vAlign: 'center' }),
  },
  {
    id: 'text-image', label: 'Text + image', category: 'Content', description: 'Story on the left, image on the right',
    build: () => sec([50, 50], [
      [
        el('heading', { eyebrow: 'Why choose us', text: 'A partner that *delivers*' }),
        el('iconList', { items: [{ text: 'Dedicated account manager for every client' }, { text: 'Talent pool of 50,000+ pre-screened profiles' }, { text: 'Visa, medical and Emirates ID handled end-to-end' }, { text: 'Transparent pricing, no hidden fees' }] }),
      ],
      [el('image', { src: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&q=80', alt: 'Consultation', aspect: '4/3', frame: 'arch' })],
    ], { vAlign: 'center', reverseOnMobile: true }),
  },
  {
    id: 'stats-band', label: 'Stats band', category: 'Content', description: 'Animated numbers on a dark band',
    build: () => sec([100], [[el('stats', { style: 'divided', color: 'gold' })]], { pattern: 'grid' }, { ...darkBg, pt: '64', pb: '64' }, { pt: '48', pb: '48' }),
  },
  {
    id: 'process', label: 'Process steps', category: 'Content', description: 'How it works in three steps',
    build: () => sec([100], [[...intro('How it works', 'From brief to *first day*'), el('steps', {}, { mt: '24' })]]),
  },
  {
    id: 'timeline', label: 'Timeline', category: 'Content', description: 'Company history timeline',
    build: () => sec([100], [[...intro('Our journey', 'Milestones'), el('steps', { layout: 'alternating', marker: 'dot', items: [{ date: '2017', title: 'Founded in Sharjah', text: 'Started with a small recruitment desk.' }, { date: '2019', title: 'Outsourcing launched', text: 'Managed staffing for hospitality clients.' }, { date: '2022', title: 'India branches', text: 'Delhi-NCR, Bangalore and Cochin offices.' }, { date: '2025', title: '1,800+ placements', text: 'Trusted by 36+ corporate clients.' }] }, { mt: '24' })]], {}, sandBg),
  },
  {
    id: 'tabs-section', label: 'Services in tabs', category: 'Content', description: 'Tabbed overview of services',
    build: () => sec([100], [[...intro('Services', 'Explore what we offer'), el('tabs', { align: 'center' }, { mt: '16' })]]),
  },
  {
    id: 'video', label: 'Video feature', category: 'Media', description: 'Heading with a large video',
    build: () => sec([100], [[...intro('See us in action', 'Your talent partner in the UAE'), el('video', { lightbox: true, poster: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80' }, { mt: '20', maxWidth: '980', ml: 'auto', mr: 'auto' })]], {}, sandBg),
  },
  {
    id: 'gallery', label: 'Gallery', category: 'Media', description: 'Photo grid with lightbox',
    build: () => sec([100], [[...intro('Gallery', 'Life at Al Khadim'), el('gallery', {}, { mt: '16' })]]),
  },
  {
    id: 'logos', label: 'Client logos', category: 'Media', description: 'Scrolling marquee of logos',
    build: () => sec([100], [[el('heading', { text: 'Trusted by leading UAE organisations', tag: 'p', size: 'xs', align: 'center', color: 'muted' }, { textTransform: 'uppercase', letterSpacing: '2' }), el('logos', {})]], {}, { pt: '48', pb: '48' }, { pt: '36', pb: '36' }),
  },

  /* Social proof & conversion */
  {
    id: 'testimonials', label: 'Testimonials', category: 'Social proof', description: 'Client quotes in cards',
    build: () => sec([100], [[...intro('Testimonials', 'What our clients say'), el('testimonials', {}, { mt: '20' })]], {}, sandBg),
  },
  {
    id: 'team', label: 'Team', category: 'Social proof', description: 'Leadership team grid',
    build: () => sec([100], [[...intro('Leadership', 'Meet the team'), el('team', {}, { mt: '20' })]]),
  },
  {
    id: 'pricing', label: 'Pricing', category: 'Conversion', description: 'Three plans with a highlighted option',
    build: () => sec([100], [[...intro('Pricing', 'Simple, transparent plans'), el('pricing', {}, { mt: '24' })]], {}, sandBg),
  },
  {
    id: 'faq', label: 'FAQ', category: 'Conversion', description: 'Questions beside an intro',
    build: () => sec([40, 60], [
      [...intro('FAQ', 'Questions, *answered*', 'Can’t find what you’re looking for? Our team is one message away.', 'left'), el('buttons', { items: [{ label: 'Contact us', href: '/contact', variant: 'outline' }] })],
      [el('accordion', {})],
    ]),
  },
  {
    id: 'cta', label: 'Call to action', category: 'Conversion', description: 'Brand banner with buttons',
    build: () => sec([100], [[el('cta', {})]], {}, { pt: '48', pb: '48' }),
  },
  {
    id: 'contact', label: 'Contact', category: 'Conversion', description: 'Contact details with an enquiry form',
    build: () => sec([42, 58], [
      [
        ...intro('Get in touch', 'Let’s talk about your *hiring*', 'Tell us about the roles you need to fill and we’ll get back to you within one business day.', 'left'),
        el('iconList', { items: [{ icon: 'Phone', text: '+971 6 000 0000', href: 'tel:+97160000000' }, { icon: 'Mail', text: 'info@alkhadim.ae', href: 'mailto:info@alkhadim.ae' }, { icon: 'MapPin', text: 'Sharjah Media City, UAE' }], iconStyle: 'circle', gap: 16 }),
        el('social', {}),
      ],
      [el('form', {})],
    ], { vAlign: 'flex-start' }, sandBg),
  },
  {
    id: 'map', label: 'Map', category: 'Conversion', description: 'Full-width location map',
    build: () => sec([100], [[el('map', { height: 420 }, { radius: '0' })]], { width: 'full' }, { pt: '0', pb: '0', pl: '0', pr: '0' }, { pt: '0', pb: '0', pl: '0', pr: '0' }),
  },
  {
    id: 'jobs', label: 'Open jobs', category: 'Conversion', description: 'Live jobs from the ATS',
    build: () => sec([100], [[...intro('Careers', 'Latest opportunities'), el('jobs', {}, { mt: '16' })]]),
  },
  {
    id: 'launch', label: 'Countdown', category: 'Conversion', description: 'Event or offer countdown',
    build: () => sec([100], [[
      el('heading', { eyebrow: 'Job fair', text: 'Al Khadim *Hiring Day* — Dubai', align: 'center', color: '#ffffff', highlight: 'gold' }),
      el('countdown', { date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 16), color: '#ffffff', boxBg: 'rgba(255,255,255,.08)' }),
      el('buttons', { align: 'center', items: [{ label: 'Register now', href: '/candidate/register', variant: 'gold' }] }),
    ]], { pattern: 'arabesque' }, darkBg),
  },
  {
    id: 'ticker', label: 'Ticker band', category: 'Content', description: 'Scrolling list of services',
    build: () => sec([100], [[el('ticker', {}, { color: '#ffffff' })]], { width: 'full' }, { bgType: 'color', bgColor: 'primary', pt: '0', pb: '0', pl: '0', pr: '0' }, { pt: '0', pb: '0', pl: '0', pr: '0' }),
  },
];

export const BLOCK_BY_ID = Object.fromEntries(BLOCK_TEMPLATES.map(b => [b.id, b]));

const build = (...ids: string[]) => ids.map(id => BLOCK_BY_ID[id].build());

export interface PageTemplate { id: string; label: string; description: string; build: () => PBNode[] }

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'blank', label: 'Blank page', description: 'Start from an empty canvas', build: () => [] },
  { id: 'landing', label: 'Landing page', description: 'Hero, logos, features, stats, testimonials, FAQ and CTA', build: () => build('hero-centered', 'logos', 'features-grid', 'image-text', 'stats-band', 'testimonials', 'faq', 'cta') },
  { id: 'about', label: 'About us', description: 'Story, numbers, timeline and team', build: () => build('page-header', 'image-text', 'stats-band', 'timeline', 'team', 'cta') },
  { id: 'services', label: 'Services', description: 'Service grid, tabs, process, pricing and FAQ', build: () => build('hero-split', 'features-grid', 'process', 'pricing', 'faq', 'cta') },
  { id: 'contact', label: 'Contact', description: 'Header, contact form and map', build: () => build('page-header', 'contact', 'map') },
  { id: 'campaign', label: 'Event / campaign', description: 'Slider hero, countdown, video and form', build: () => build('hero-slider', 'launch', 'video', 'contact') },
];

/** A section wrapping one element — used when an element is dropped on empty canvas. */
export function sectionFor(element: PBNode): PBNode {
  const s = newSection([100]);
  s.children = [{ ...newColumn(100), children: [element] }];
  return s;
}
