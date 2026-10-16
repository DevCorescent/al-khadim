/**
 * Homepage content model.
 *
 * Every homepage section is described here once: its fields (which the admin
 * Website Builder turns into a form) and its default content (which the public
 * page falls back to). Nothing in this file imports React, so the server can use
 * the defaults when it seeds or normalises the stored config.
 */

export type FieldType =
  | 'text' | 'textarea' | 'link' | 'image' | 'color' | 'toggle'
  | 'select' | 'number' | 'icon' | 'list' | 'heading';

export interface FieldOption { value: string; label: string }

export interface Field {
  key: string;
  type: FieldType;
  label: string;
  hint?: string;
  placeholder?: string;
  options?: FieldOption[];
  /** list: fields of one item, the field used to title each row, and the item a new row starts as. */
  itemFields?: Field[];
  itemLabel?: string;
  newItem?: Record<string, any>;
  max?: number;
  min?: number;
  /** Only shown when another field of the same object has one of these values. */
  showIf?: { key: string; equals: any[] };
  /** Spans the full form width (textareas and lists always do). */
  wide?: boolean;
  /** image: endpoint that accepts the upload (defaults to the Website Builder's). */
  uploadUrl?: string;
}

export interface SectionDef {
  type: string;
  label: string;
  description: string;
  /** Icon name from the icon registry, for the builder's section list. */
  icon: string;
  /** Section pulls live data (jobs, candidates) rather than only stored content. */
  live?: boolean;
  fields: Field[];
  defaults: Record<string, any>;
}

/* ─── Shared field builders ─────────────────────────────────────────────── */

const heading = (label: string, hint?: string): Field => ({ key: `__${label}`, type: 'heading', label, hint });

const intro = (eyebrow: string, title: string, subtitle = ''): Field[] => [
  heading('Heading'),
  { key: 'eyebrow',  type: 'text',     label: 'Eyebrow',  hint: 'Small label above the title', placeholder: eyebrow },
  { key: 'title',    type: 'textarea', label: 'Title',    hint: 'Wrap words in *asterisks* to highlight them. Line breaks are kept.', placeholder: title },
  { key: 'subtitle', type: 'textarea', label: 'Subtitle', placeholder: subtitle },
];

const cta = (prefix: string, label: string): Field[] => [
  { key: `${prefix}Label`, type: 'text', label: `${label} text`, hint: 'Leave empty to hide the button' },
  { key: `${prefix}Href`,  type: 'link', label: `${label} link`, placeholder: '/enquiry' },
];

export const ICON_FIELD_HINT = 'Pick an icon';

/** Style controls every section gets, appended after its own fields. */
export const STYLE_FIELDS: Field[] = [
  heading('Section style', 'Background, spacing and visibility'),
  {
    key: 'background', type: 'select', label: 'Background',
    options: [
      { value: 'white',    label: 'White' },
      { value: 'sand',     label: 'Sand (warm light)' },
      { value: 'ink',      label: 'Dark (night)' },
      { value: 'primary',  label: 'Brand colour' },
      { value: 'gradient', label: 'Brand gradient' },
      { value: 'image',    label: 'Image' },
      { value: 'custom',   label: 'Custom colour' },
    ],
  },
  { key: 'bgColor',        type: 'color',  label: 'Custom background colour', showIf: { key: 'background', equals: ['custom'] } },
  { key: 'bgImage',        type: 'image',  label: 'Background image',         showIf: { key: 'background', equals: ['image'] } },
  { key: 'overlayOpacity', type: 'number', label: 'Image overlay strength (0–100)', min: 0, max: 100, showIf: { key: 'background', equals: ['image'] } },
  {
    key: 'spacing', type: 'select', label: 'Vertical spacing',
    options: [{ value: 'tight', label: 'Tight' }, { value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'spacious', label: 'Spacious' }],
  },
  {
    key: 'align', type: 'select', label: 'Heading alignment',
    options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }],
  },
  { key: 'pattern',       type: 'toggle', label: 'Show Arabesque pattern', hint: 'Subtle geometric texture behind the section' },
  { key: 'anchor',        type: 'text',   label: 'Anchor ID', hint: 'Lets links jump here, e.g. /#services', placeholder: 'services' },
  { key: 'hideOnMobile',  type: 'toggle', label: 'Hide on mobile' },
  { key: 'hideOnDesktop', type: 'toggle', label: 'Hide on desktop' },
];

export const STYLE_DEFAULTS = {
  background: 'white', bgColor: '#ffffff', bgImage: '', overlayOpacity: 70,
  spacing: 'normal', align: 'left', pattern: false, anchor: '',
  hideOnMobile: false, hideOnDesktop: false,
};

/* ─── Section catalogue ─────────────────────────────────────────────────── */

const SLIDER = { key: 'layout', equals: ['slider'] };
const NOT_SLIDER = { key: 'layout', equals: ['image', 'split', 'centered', 'showcase'] };
const FOCUS = [
  { value: 'center', label: 'Centre' }, { value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
];
const u = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}${h ? `&h=${h}&fit=crop&crop=entropy` : ''}&q=80&auto=format`;

const linkItemFields: Field[] = [
  { key: 'label', type: 'text', label: 'Label' },
  { key: 'hint',  type: 'text', label: 'Hint' },
];

export const SECTION_DEFS: SectionDef[] = [
  {
    type: 'hero', label: 'Hero banner', icon: 'Monitor',
    description: 'The first screen: headline, buttons, search and key figures',
    fields: [
      heading('Layout'),
      {
        key: 'layout', type: 'select', label: 'Layout',
        options: [
          { value: 'slider',   label: 'Background image slider' },
          { value: 'showcase', label: 'Showcase — text left, arched image right' },
          { value: 'image',    label: 'Full-width image' },
          { value: 'split',    label: 'Text left, image right' },
          { value: 'centered', label: 'Centred' },
        ],
      },
      {
        key: 'height', type: 'select', label: 'Height',
        options: [{ value: 'auto', label: 'Fit content' }, { value: 'tall', label: 'Tall' }, { value: 'screen', label: 'Full screen' }],
      },
      heading('Slides', 'Each slide has its own background, text and buttons'),
      {
        key: 'slides', type: 'list', label: 'Slides', itemLabel: 'headline', max: 8, showIf: SLIDER,
        itemFields: [
          { key: 'imageDesktop', type: 'image',  label: 'Desktop image', hint: 'Landscape, about 2400×1350 — used on tablets and larger' },
          { key: 'focus',        type: 'select', label: 'Desktop focal point', options: FOCUS },
          { key: 'imageMobile',  type: 'image',  label: 'Mobile image (optional)', hint: 'Portrait, about 1000×1600 — phones fall back to the desktop image' },
          { key: 'mobileFocus',  type: 'select', label: 'Mobile focal point', options: FOCUS },
          { key: 'imageAlt',     type: 'text',   label: 'Image description (accessibility)' },
          { key: 'eyebrow',      type: 'text',   label: 'Badge text' },
          { key: 'headline',     type: 'textarea', label: 'Headline', hint: 'Wrap words in *asterisks* to highlight them in gold' },
          { key: 'subheadline',  type: 'textarea', label: 'Supporting text' },
          { key: 'cta1Label', type: 'text', label: 'Primary button text' },
          { key: 'cta1Href',  type: 'link', label: 'Primary button link' },
          { key: 'cta2Label', type: 'text', label: 'Secondary button text' },
          { key: 'cta2Href',  type: 'link', label: 'Secondary button link' },
          { key: 'align', type: 'select', label: 'Text alignment', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }] },
        ],
        newItem: {
          imageDesktop: '', imageMobile: '', focus: 'center', mobileFocus: 'center', imageAlt: '',
          eyebrow: '', headline: 'New slide *headline*', subheadline: '',
          cta1Label: 'Get in touch', cta1Href: '/contact', cta2Label: '', cta2Href: '', align: 'left',
        },
      },
      heading('Slider animation', 'Transitions respect visitors who have reduced motion turned on'),
      {
        key: 'transition', type: 'select', label: 'Background transition', showIf: SLIDER,
        options: [
          { value: 'fade',     label: 'Cross-fade' },
          { value: 'zoom',     label: 'Fade + zoom out' },
          { value: 'kenburns', label: 'Fade + slow Ken Burns zoom' },
          { value: 'slide',    label: 'Slide sideways' },
        ],
      },
      {
        key: 'textAnimation', type: 'select', label: 'Text animation', showIf: SLIDER,
        options: [
          { value: 'fadeUp', label: 'Fade up (staggered)' },
          { value: 'fade',   label: 'Fade' },
          { value: 'blur',   label: 'Blur in' },
          { value: 'slide',  label: 'Slide from the side' },
          { value: 'none',   label: 'None' },
        ],
      },
      { key: 'transitionMs', type: 'number', label: 'Transition speed (milliseconds)', min: 300, max: 2500, showIf: SLIDER },
      { key: 'interval',     type: 'number', label: 'Time per slide (seconds)', min: 3, max: 15, showIf: SLIDER },
      { key: 'autoplay',     type: 'toggle', label: 'Play automatically', showIf: SLIDER },
      { key: 'pauseOnHover', type: 'toggle', label: 'Pause while the pointer is over the hero', showIf: SLIDER },
      {
        key: 'indicators', type: 'select', label: 'Slide indicators', showIf: SLIDER,
        options: [{ value: 'progress', label: 'Progress bars' }, { value: 'dots', label: 'Dots' }, { value: 'numbers', label: 'Numbers' }, { value: 'none', label: 'None' }],
      },
      { key: 'showArrows', type: 'toggle', label: 'Show previous / next arrows', showIf: SLIDER },
      { key: 'image',          type: 'image',  label: 'Image', hint: 'Recommended 1800×1100, under 1 MB', showIf: NOT_SLIDER },
      { key: 'imageAlt',       type: 'text',   label: 'Image description (for accessibility)', showIf: NOT_SLIDER },
      { key: 'showPanel',     type: 'toggle',   label: 'Show the Arabic tagline panel', showIf: { key: 'layout', equals: ['showcase'] } },
      { key: 'arabicTagline', type: 'text',     label: 'Arabic tagline', showIf: { key: 'layout', equals: ['showcase'] } },
      { key: 'panelText',     type: 'textarea', label: 'Panel text (English)', hint: 'Each line is shown on its own row', showIf: { key: 'layout', equals: ['showcase'] } },
      { key: 'overlayColor',   type: 'color',  label: 'Overlay colour', hint: 'Darkens the images so the text stays readable', showIf: { key: 'layout', equals: ['image', 'centered', 'slider'] } },
      { key: 'overlayOpacity', type: 'number', label: 'Overlay strength (0–100)', min: 0, max: 100, showIf: { key: 'layout', equals: ['image', 'centered', 'slider'] } },
      { ...heading('Text'), showIf: NOT_SLIDER },
      { key: 'eyebrow',     type: 'text',     label: 'Badge text', placeholder: 'Licensed HR partner in the UAE', showIf: NOT_SLIDER },
      { key: 'headline',    type: 'textarea', label: 'Headline', hint: 'Line breaks are kept. Wrap words in *asterisks* to highlight them in gold.', showIf: NOT_SLIDER },
      { key: 'subheadline', type: 'textarea', label: 'Supporting text', showIf: NOT_SLIDER },
      { ...heading('Buttons'), showIf: NOT_SLIDER },
      ...cta('cta1', 'Primary button').map(f => ({ ...f, showIf: NOT_SLIDER })),
      ...cta('cta2', 'Secondary button').map(f => ({ ...f, showIf: NOT_SLIDER })),
      { ...heading('Search box'), showIf: NOT_SLIDER },
      { key: 'showSearch',      type: 'toggle', label: 'Show search box', hint: 'Replaces the buttons with a hire / find-work search', showIf: NOT_SLIDER },
      { key: 'hireTabLabel',    type: 'text',   label: 'Hire tab label',  showIf: { key: 'showSearch', equals: [true] } },
      { key: 'workTabLabel',    type: 'text',   label: 'Work tab label',  showIf: { key: 'showSearch', equals: [true] } },
      { key: 'hirePlaceholder', type: 'text',   label: 'Hire placeholder', showIf: { key: 'showSearch', equals: [true] } },
      { key: 'workPlaceholder', type: 'text',   label: 'Work placeholder', showIf: { key: 'showSearch', equals: [true] } },
      { key: 'searchButton',    type: 'text',   label: 'Search button text', showIf: { key: 'showSearch', equals: [true] } },
      { key: 'hireSuggestions', type: 'list', label: 'Hire suggestions', itemLabel: 'label', itemFields: linkItemFields, newItem: { label: 'New suggestion', hint: '' }, max: 8, showIf: { key: 'showSearch', equals: [true] } },
      { key: 'workSuggestions', type: 'list', label: 'Job suggestions',  itemLabel: 'label', itemFields: linkItemFields, newItem: { label: 'New role', hint: '' }, max: 8, showIf: { key: 'showSearch', equals: [true] } },
      heading('Highlights'),
      {
        key: 'trustPoints', type: 'list', label: 'Trust badges under the buttons', hint: 'Slider: shown along the bottom of the hero on large screens', itemLabel: 'text', max: 5,
        itemFields: [{ key: 'icon', type: 'icon', label: 'Icon (showcase layout)' }, { key: 'text', type: 'text', label: 'Text' }],
        newItem: { icon: 'BadgeCheck', text: 'New point' },
      },
      {
        key: 'stats', type: 'list', label: 'Key figures strip', hint: 'Shown only once real figures are entered', itemLabel: 'label', max: 4,
        itemFields: [{ key: 'value', type: 'text', label: 'Figure', placeholder: '500+' }, { key: 'label', type: 'text', label: 'Label' }],
        newItem: { value: '', label: '' },
      },
      { key: 'showFlagStripe', type: 'toggle', label: 'Show UAE flag accent stripe' },
      { ...heading('Floating card', 'A small card over the image'), showIf: NOT_SLIDER },
      { key: 'cardEnabled', type: 'toggle', label: 'Show floating card', showIf: NOT_SLIDER },
      { key: 'cardIcon',    type: 'icon',   label: 'Card icon', showIf: { key: 'cardEnabled', equals: [true] } },
      { key: 'cardTitle',   type: 'text',   label: 'Card title', showIf: { key: 'cardEnabled', equals: [true] } },
      { key: 'cardText',    type: 'text',   label: 'Card text', showIf: { key: 'cardEnabled', equals: [true] } },
    ],
    defaults: {
      layout: 'slider', height: 'tall',
      slides: [
        {
          imageDesktop: u('1512453979798-5ea266f8880c', 2400), focus: 'center',
          imageMobile: u('1512453979798-5ea266f8880c', 1000, 1600), mobileFocus: 'center',
          imageAlt: 'Dubai skyline at dusk',
          eyebrow: 'HR & manpower partner · United Arab Emirates',
          headline: "Building the UAE's\n*workforce of tomorrow*",
          subheadline: 'End-to-end recruitment, outsourcing and HR consultancy for organisations across all seven Emirates.',
          cta1Label: 'Hire Talent', cta1Href: '/enquiry', cta2Label: 'Find a Job', cta2Href: '/careers', align: 'left',
        },
        {
          imageDesktop: u('1541888946425-d81bb19240f5', 2400), focus: 'center',
          imageMobile: u('1504307651254-35680f356dfd', 1000, 1600), mobileFocus: 'center',
          imageAlt: 'Construction team on site',
          eyebrow: 'Manpower supply',
          headline: 'Skilled manpower for\n*every project*',
          subheadline: 'Skilled and semi-skilled workforce for construction, oil & gas, facilities and logistics — mobilised fast, fully compliant.',
          cta1Label: 'Request Manpower', cta1Href: '/enquiry?service=Manpower%20Supply', cta2Label: 'Our Services', cta2Href: '/services', align: 'left',
        },
        {
          imageDesktop: u('1590650153855-d9e808231d41', 2400), focus: 'right',
          imageMobile: u('1590650153855-d9e808231d41', 1000, 1600), mobileFocus: 'center',
          imageAlt: 'Professional at work in a modern office',
          eyebrow: 'For job seekers',
          headline: 'Your next career move\n*starts here*',
          subheadline: 'Discover verified opportunities with leading UAE employers and let our consultants guide you from CV to offer.',
          cta1Label: 'Browse Jobs', cta1Href: '/careers', cta2Label: 'Upload Your CV', cta2Href: '/candidate/register', align: 'left',
        },
        {
          imageDesktop: u('1518684079-3c830dcef090', 2400), focus: 'center',
          imageMobile: u('1546412414-e1885259563a', 1000, 1600), mobileFocus: 'center',
          imageAlt: 'Burj Al Arab, Dubai',
          eyebrow: 'Global talent · Local expertise',
          headline: 'Connecting talent\n*across borders*',
          subheadline: 'Recruitment from the GCC, Asia, Europe and Canada, with visa, PRO and onboarding handled for you.',
          cta1Label: 'Global Hiring', cta1Href: '/#global-hiring', cta2Label: 'Talk to an Expert', cta2Href: '/contact', align: 'left',
        },
      ],
      transition: 'kenburns', textAnimation: 'fadeUp', transitionMs: 1200, interval: 7,
      autoplay: true, pauseOnHover: true, indicators: 'progress', showArrows: true,
      image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1800&q=80',
      imageAlt: 'Dubai skyline',
      showPanel: true,
      arabicTagline: 'بناء الفرص، وتمكين الإنسان',
      panelText: 'Building opportunities\nEmpowering people',
      overlayColor: '#061E26', overlayOpacity: 70,
      eyebrow: 'Global talent • Local expertise',
      headline: 'People\nPowering\n*A Stronger*\n*Tomorrow*',
      subheadline: 'Al Khadim LLC is a leading HR consultancy and manpower solutions provider based in Dubai, delivering end-to-end workforce, outsourcing and management consultancy services across the UAE and globally.',
      cta1Label: 'Explore Our Services', cta1Href: '/services',
      cta2Label: 'Find a Job',  cta2Href: '/careers',
      showSearch: false,
      hireTabLabel: 'I want to hire', workTabLabel: 'I want to work',
      hirePlaceholder: 'Search for talent or a service…',
      workPlaceholder: 'Search jobs, e.g. Civil Engineer',
      searchButton: 'Search',
      hireSuggestions: [
        { label: 'Executive Search',  hint: 'Senior & C-suite hiring' },
        { label: 'Bulk Hiring',       hint: 'High-volume recruitment' },
        { label: 'Contract Staffing', hint: 'Temporary & project teams' },
        { label: 'Visa Assistance',   hint: 'UAE permits & PRO services' },
      ],
      workSuggestions: [
        { label: 'Software Engineer', hint: 'Technology' },
        { label: 'HR Manager',        hint: 'Human resources' },
        { label: 'Civil Engineer',    hint: 'Construction' },
        { label: 'Financial Analyst', hint: 'Finance & accounting' },
      ],
      trustPoints: [
        { icon: 'ShieldCheck',    text: 'Trusted Partner' },
        { icon: 'BadgeCheck',     text: 'Compliant & Reliable' },
        { icon: 'Globe2',         text: 'Global Network' },
        { icon: 'HeartHandshake', text: 'People-Centric Approach' },
      ],
      stats: [],
      showFlagStripe: false,
      cardEnabled: false, cardIcon: 'ShieldCheck',
      cardTitle: 'Trusted HR partner', cardText: 'Serving UAE employers since 2017',
    },
  },
  {
    type: 'logos', label: 'Client logos', icon: 'Building2',
    description: 'A strip of client or partner names and logos',
    fields: [
      heading('Heading'),
      { key: 'title', type: 'text', label: 'Caption', placeholder: 'Trusted by leading organisations' },
      {
        key: 'display', type: 'select', label: 'Display',
        options: [{ value: 'marquee', label: 'Scrolling strip' }, { value: 'grid', label: 'Static grid' }],
      },
      { key: 'grayscale', type: 'toggle', label: 'Show logos in greyscale (colour on hover)' },
      {
        key: 'items', type: 'list', label: 'Clients', hint: 'The section stays hidden until at least one is added', itemLabel: 'name',
        itemFields: [
          { key: 'name', type: 'text',  label: 'Name' },
          { key: 'logo', type: 'image', label: 'Logo (optional)' },
          { key: 'href', type: 'link',  label: 'Website (optional)' },
        ],
        newItem: { name: 'Client name', logo: '', href: '' },
      },
    ],
    defaults: { title: 'Trusted by leading organisations across the UAE', display: 'marquee', grayscale: true, items: [] },
  },
  {
    type: 'about', label: 'About / introduction', icon: 'Landmark',
    description: 'Who you are, with an image, highlights and a button',
    fields: [
      ...intro('Who we are', 'A trusted UAE partner for people and growth'),
      { key: 'body', type: 'textarea', label: 'Body text', hint: 'Leave a blank line between paragraphs' },
      heading('Image'),
      { key: 'image', type: 'image', label: 'Image' },
      {
        key: 'imagePosition', type: 'select', label: 'Image position',
        options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }],
      },
      { key: 'badgeValue', type: 'text', label: 'Image badge — figure', placeholder: '2017' },
      { key: 'badgeLabel', type: 'text', label: 'Image badge — label', placeholder: 'Established in the UAE' },
      heading('Highlights'),
      {
        key: 'bullets', type: 'list', label: 'Highlights', itemLabel: 'text',
        itemFields: [{ key: 'text', type: 'text', label: 'Text' }], newItem: { text: 'New highlight' },
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'Who we are',
      title: 'A trusted UAE partner for *people and growth*',
      subtitle: '',
      body: 'Al Khadim LLC is an HR and recruitment consultancy helping organisations across the United Arab Emirates find, hire and retain the people who move their business forward.\n\nFrom a single specialist hire to a fully managed workforce, our consultants combine local market knowledge with a global talent network — and handle the visas, compliance and payroll that come with it.',
      image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
      imagePosition: 'left',
      badgeValue: '2017', badgeLabel: 'Established in the UAE',
      bullets: [
        { text: 'Placement & executive search' },
        { text: 'Contract staffing & outsourcing' },
        { text: 'Visa, PRO & payroll services' },
        { text: 'HR & management consultancy' },
      ],
      ctaLabel: 'About Al Khadim', ctaHref: '/about',
      background: 'white',
    },
  },
  {
    type: 'stats', label: 'Key figures', icon: 'BarChart3',
    description: 'Animated counters for your headline numbers',
    fields: [
      ...intro('By the numbers', 'Results that speak for themselves'),
      {
        key: 'display', type: 'select', label: 'Display',
        options: [{ value: 'band', label: 'Icon band' }, { value: 'columns', label: 'Large counters' }],
      },
      { key: 'animate', type: 'toggle', label: 'Count up when scrolled into view' },
      {
        key: 'items', type: 'list', label: 'Figures', hint: 'Only publish figures you can stand behind. A figure can also be text, e.g. "Since 2017".', itemLabel: 'label', max: 6,
        itemFields: [
          { key: 'icon',   type: 'icon', label: 'Icon (icon band)' },
          { key: 'prefix', type: 'text', label: 'Prefix', placeholder: 'AED ' },
          { key: 'value',  type: 'text', label: 'Number', placeholder: '1200' },
          { key: 'suffix', type: 'text', label: 'Suffix', placeholder: '+' },
          { key: 'label',  type: 'text', label: 'Label' },
          { key: 'description', type: 'text', label: 'Small print' },
        ],
        newItem: { icon: 'Star', prefix: '', value: '', suffix: '+', label: '', description: '' },
      },
    ],
    defaults: {
      eyebrow: '', title: '', subtitle: '', display: 'band', animate: true,
      // The figures Al Khadim already publishes on its About page.
      items: [
        { icon: 'Handshake',   prefix: '', value: '36',   suffix: '+', label: 'Client companies',  description: '' },
        { icon: 'Users',       prefix: '', value: '1800', suffix: '+', label: 'Job seekers served', description: '' },
        { icon: 'Globe2',      prefix: '', value: 'UAE, GCC, Asia, Europe & Canada', suffix: '', label: 'Hiring across borders', description: '' },
        { icon: 'ShieldCheck', prefix: '', value: 'Compliance', suffix: '', label: '& transparency in every placement', description: '' },
        { icon: 'Trophy',      prefix: '', value: 'Since 2017', suffix: '', label: 'Your long-term people partner', description: '' },
      ],
      background: 'ink', align: 'center', spacing: 'tight',
    },
  },
  {
    type: 'services', label: 'Services', icon: 'Briefcase',
    description: 'A grid of the services you offer',
    fields: [
      ...intro('What we do', 'Comprehensive HR solutions'),
      {
        key: 'columns', type: 'select', label: 'Cards per row (desktop)',
        options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }],
      },
      {
        key: 'cardStyle', type: 'select', label: 'Card style',
        options: [{ value: 'outline', label: 'Outlined' }, { value: 'elevated', label: 'Elevated' }, { value: 'image', label: 'Image cards' }],
      },
      {
        key: 'items', type: 'list', label: 'Services', itemLabel: 'title',
        itemFields: [
          { key: 'icon',        type: 'icon',     label: 'Icon' },
          { key: 'title',       type: 'text',     label: 'Title' },
          { key: 'description', type: 'textarea', label: 'Description' },
          { key: 'href',        type: 'link',     label: 'Link' },
          { key: 'image',       type: 'image',    label: 'Image (image cards only)' },
        ],
        newItem: { icon: 'Briefcase', title: 'New service', description: '', href: '/services', image: '' },
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'What we do',
      title: 'Comprehensive HR solutions,\n*one trusted partner*',
      subtitle: 'From your first hire to full workforce management — every service your organisation needs to grow in the UAE.',
      columns: '4', cardStyle: 'outline',
      items: [
        { icon: 'Users',          title: 'Placement Services',      description: 'Direct permanent hires — from C-suite to entry level.',       href: '/services#placement',   image: '' },
        { icon: 'Briefcase',      title: 'Recruitment Services',    description: 'End-to-end talent acquisition at any volume.',                 href: '/services#recruitment', image: '' },
        { icon: 'Clock',          title: 'Contractual Outsourcing', description: 'Flexible project and contract staffing on demand.',            href: '/services#outsourcing', image: '' },
        { icon: 'BarChart3',      title: 'Management Consultancy',  description: 'HR strategy, organisation design and workforce planning.',      href: '/services#consultancy', image: '' },
        { icon: 'Globe2',         title: 'Visa & PRO Services',     description: 'Work permits, Emirates ID and UAE visa processing.',           href: '/services#residency',   image: '' },
        { icon: 'Crown',          title: 'Executive Search',        description: 'Confidential C-level and board-member mandates.',              href: '/services',             image: '' },
        { icon: 'Target',         title: 'Talent Assessment',       description: 'Psychometric testing, skills-gap analysis and benchmarking.',  href: '/services',             image: '' },
        { icon: 'Landmark',       title: 'Payroll & Compliance',    description: 'WPS payroll, end-of-service benefits and HR administration.',  href: '/services',             image: '' },
      ],
      ctaLabel: 'Explore all services', ctaHref: '/services',
      background: 'sand',
    },
  },
  {
    type: 'process', label: 'How we work', icon: 'Route',
    description: 'Numbered steps of your process',
    fields: [
      ...intro('Our process', 'How we deliver excellence'),
      {
        key: 'items', type: 'list', label: 'Steps', itemLabel: 'title', max: 6,
        itemFields: [
          { key: 'icon',        type: 'icon',     label: 'Icon' },
          { key: 'title',       type: 'text',     label: 'Title' },
          { key: 'description', type: 'textarea', label: 'Description' },
        ],
        newItem: { icon: 'CheckCircle2', title: 'New step', description: '' },
      },
    ],
    defaults: {
      eyebrow: 'Our process',
      title: 'How we deliver *excellence*',
      subtitle: 'A proven four-step framework, from your brief to a successful placement.',
      items: [
        { icon: 'Search',     title: 'Define requirements', description: 'A deep-dive consultation on your hiring needs, culture and business goals.' },
        { icon: 'UserCheck',  title: 'Source & screen',     description: 'Our consultants handpick and verify professionals matched to your criteria.' },
        { icon: 'Handshake',  title: 'Present & interview', description: 'Shortlists with detailed profiles, and every interview coordinated for you.' },
        { icon: 'TrendingUp', title: 'Onboard & retain',    description: 'From offer letter to first day and beyond, we make the transition seamless.' },
      ],
      background: 'white', align: 'center',
    },
  },
  {
    type: 'industries', label: 'Industries', icon: 'Factory',
    description: 'The sectors you recruit for',
    fields: [
      ...intro('Expertise', 'Industries we serve'),
      {
        key: 'display', type: 'select', label: 'Display',
        options: [{ value: 'strip', label: 'Icon strip' }, { value: 'tiles', label: 'Icon tiles' }, { value: 'images', label: 'Image cards' }],
      },
      {
        key: 'items', type: 'list', label: 'Industries', itemLabel: 'label',
        itemFields: [
          { key: 'icon',        type: 'icon',  label: 'Icon' },
          { key: 'label',       type: 'text',  label: 'Name' },
          { key: 'description', type: 'text',  label: 'Short description' },
          { key: 'href',        type: 'link',  label: 'Link' },
          { key: 'image',       type: 'image', label: 'Image (image cards only)' },
        ],
        newItem: { icon: 'Building2', label: 'New industry', description: '', href: '/careers', image: '' },
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: '',
      title: 'Industries we serve',
      subtitle: '',
      display: 'strip',
      items: [
        { icon: 'Construction',  label: 'Construction',           description: 'Contractors, developers and projects', href: '/careers?industry=Construction',   image: '' },
        { icon: 'Flame',         label: 'Oil & Gas',              description: 'Upstream, downstream and energy',      href: '/careers?industry=Energy',         image: '' },
        { icon: 'Hotel',         label: 'Hospitality',            description: 'Hotels, F&B and leisure',              href: '/careers?industry=Hospitality',    image: '' },
        { icon: 'HeartPulse',    label: 'Healthcare',             description: 'Hospitals, clinics and life sciences', href: '/careers?industry=Healthcare',     image: '' },
        { icon: 'Truck',         label: 'Logistics & Transport',  description: 'Supply chain, fleet and ports',        href: '/careers?industry=Logistics',      image: '' },
        { icon: 'Store',         label: 'Retail',                 description: 'Retail, distribution and brands',      href: '/careers?industry=Retail',         image: '' },
        { icon: 'Building',      label: 'Facilities Management',  description: 'FM, maintenance and services',         href: '/careers?industry=Facilities',     image: '' },
        { icon: 'Cpu',           label: 'IT & Tech',              description: 'Software, data and infrastructure',    href: '/careers?industry=Technology',     image: '' },
        { icon: 'Factory',       label: 'Manufacturing',          description: 'Production and industrial',            href: '/careers?industry=Manufacturing',  image: '' },
        { icon: 'GraduationCap', label: 'Education',              description: 'Schools, universities and training',   href: '/careers?industry=Education',      image: '' },
        { icon: 'Landmark',      label: 'Government',             description: 'Public sector and semi-government',    href: '/careers?industry=Government',     image: '' },
        { icon: 'MoreHorizontal', label: 'More Industries',       description: '',                                     href: '/careers',                         image: '' },
      ],
      ctaLabel: '', ctaHref: '/careers',
      background: 'white', align: 'center', spacing: 'tight', anchor: 'industries',
    },
  },
  {
    type: 'features', label: 'Why choose us', icon: 'Award',
    description: 'Reasons to choose you, with optional figures',
    fields: [
      ...intro('Why Al Khadim', 'Why leading organisations choose us'),
      { key: 'image', type: 'image', label: 'Side image (optional)', hint: 'Leave empty for a full-width card grid' },
      {
        key: 'items', type: 'list', label: 'Reasons', itemLabel: 'title',
        itemFields: [
          { key: 'icon',        type: 'icon',     label: 'Icon' },
          { key: 'title',       type: 'text',     label: 'Title' },
          { key: 'description', type: 'textarea', label: 'Description' },
          { key: 'stat',        type: 'text',     label: 'Figure (optional)', placeholder: '72h' },
          { key: 'statLabel',   type: 'text',     label: 'Figure label' },
        ],
        newItem: { icon: 'Star', title: 'New reason', description: '', stat: '', statLabel: '' },
      },
    ],
    defaults: {
      eyebrow: 'Why Al Khadim',
      title: 'Why leading organisations *choose us*',
      subtitle: "We don't just fill positions — we build the teams that drive your business forward.",
      image: '',
      items: [
        { icon: 'Zap',            title: 'Fast, focused shortlists',  description: 'Pre-screened candidates presented quickly, so critical roles never sit open for long.', stat: '', statLabel: '' },
        { icon: 'ShieldCheck',    title: 'Verified & compliant',      description: 'Background and reference checks, with every step aligned to UAE labour regulations.',   stat: '', statLabel: '' },
        { icon: 'MapPin',         title: 'Deep UAE market knowledge', description: 'Long-standing relationships with hiring managers across every major sector.',           stat: '', statLabel: '' },
        { icon: 'Users',          title: 'Dedicated account team',    description: 'A named specialist team that learns your business — real people, not a ticket queue.',  stat: '', statLabel: '' },
        { icon: 'Award',          title: 'Placements that last',      description: 'We measure success by retention, so we optimise for long-term fit, not speed alone.',  stat: '', statLabel: '' },
        { icon: 'HeartHandshake', title: 'Post-hire support',         description: 'Onboarding support, check-ins and adjustments well after the offer is signed.',          stat: '', statLabel: '' },
      ],
      background: 'white', align: 'center',
    },
  },
  {
    type: 'emirates', label: 'Emirates coverage', icon: 'MapPin',
    description: 'Where you operate — the seven Emirates and beyond',
    fields: [
      ...intro('Our reach', 'Serving all seven Emirates'),
      {
        key: 'items', type: 'list', label: 'Locations', itemLabel: 'name',
        itemFields: [
          { key: 'name',       type: 'text',  label: 'Name' },
          { key: 'nameArabic', type: 'text',  label: 'Arabic name' },
          { key: 'description', type: 'text', label: 'Short description' },
          { key: 'image',      type: 'image', label: 'Image (optional)' },
        ],
        newItem: { name: 'New location', nameArabic: '', description: '', image: '' },
      },
      {
        key: 'metrics', type: 'list', label: 'Figures (optional)', itemLabel: 'label', max: 4,
        itemFields: [{ key: 'value', type: 'text', label: 'Figure' }, { key: 'label', type: 'text', label: 'Label' }],
        newItem: { value: '', label: '' },
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'Our reach',
      title: 'UAE-based. *Globally connected.*',
      subtitle: 'Headquartered in the Emirates, we draw on a global talent network to bring the right professionals to every corner of the UAE.',
      items: [
        { name: 'Abu Dhabi',      nameArabic: 'أبوظبي',     description: 'The capital',            image: '' },
        { name: 'Dubai',          nameArabic: 'دبي',         description: 'Commerce & innovation',  image: '' },
        { name: 'Sharjah',        nameArabic: 'الشارقة',     description: 'Culture & industry',     image: '' },
        { name: 'Ajman',          nameArabic: 'عجمان',       description: 'Trade & manufacturing',  image: '' },
        { name: 'Umm Al Quwain',  nameArabic: 'أم القيوين',  description: 'Emerging industry',      image: '' },
        { name: 'Ras Al Khaimah', nameArabic: 'رأس الخيمة', description: 'Industry & tourism',     image: '' },
        { name: 'Fujairah',       nameArabic: 'الفجيرة',     description: 'Ports & logistics',      image: '' },
      ],
      metrics: [],
      ctaLabel: 'Start a conversation', ctaHref: '/enquiry',
      background: 'ink', pattern: true,
    },
  },
  {
    type: 'jobs', label: 'Latest jobs', icon: 'Newspaper', live: true,
    description: 'Live list of your newest published jobs',
    fields: [
      ...intro('Open roles', 'Latest opportunities'),
      {
        key: 'limit', type: 'select', label: 'Jobs to show',
        options: ['3', '6', '9'].map(v => ({ value: v, label: v })),
      },
      { key: 'hideWhenEmpty', type: 'toggle', label: 'Hide the section when there are no open jobs' },
      { key: 'emptyText',     type: 'text',   label: 'Message when there are no jobs', showIf: { key: 'hideWhenEmpty', equals: [false] } },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'Open roles',
      title: 'Latest *opportunities*',
      subtitle: "Explore hand-picked roles from the UAE's leading employers.",
      limit: '6', hideWhenEmpty: false,
      emptyText: 'New roles are published every week — register your CV to hear about them first.',
      ctaLabel: 'View all jobs', ctaHref: '/careers',
      background: 'white',
    },
  },
  {
    type: 'candidates', label: 'Featured talent', icon: 'UserCheck', live: true,
    description: 'Anonymised preview of published candidate profiles',
    fields: [
      ...intro('Featured talent', 'Top-tier candidates, ready to join your team'),
      {
        key: 'limit', type: 'select', label: 'Profiles to show',
        options: ['4', '8', '12'].map(v => ({ value: v, label: v })),
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'Featured talent',
      title: 'Top-tier candidates, *ready to join your team*',
      subtitle: 'Verified professionals across every sector. Sign in as an employer to view full profiles.',
      limit: '4',
      ctaLabel: 'View all candidates', ctaHref: '/candidates',
      background: 'sand',
    },
  },
  {
    type: 'testimonials', label: 'Testimonials', icon: 'Quote',
    description: 'Client and candidate quotes',
    fields: [
      ...intro('Testimonials', 'What our clients say'),
      { key: 'showRating', type: 'toggle', label: 'Show average rating' },
      {
        key: 'items', type: 'list', label: 'Testimonials', hint: 'The section stays hidden until at least one is added. Only publish quotes you have permission to use.', itemLabel: 'author',
        itemFields: [
          { key: 'quote',   type: 'textarea', label: 'Quote' },
          { key: 'author',  type: 'text',     label: 'Name' },
          { key: 'role',    type: 'text',     label: 'Role' },
          { key: 'company', type: 'text',     label: 'Company' },
          { key: 'rating',  type: 'select',   label: 'Rating', options: [{ value: '', label: 'No rating' }, ...['5', '4', '3'].map(v => ({ value: v, label: `${v} stars` }))] },
          { key: 'photo',   type: 'image',    label: 'Photo (optional)' },
        ],
        newItem: { quote: '', author: '', role: '', company: '', rating: '5', photo: '' },
      },
    ],
    defaults: {
      eyebrow: 'Testimonials',
      title: "Trusted by the UAE's *best teams*",
      subtitle: '',
      showRating: true, items: [],
      background: 'sand',
    },
  },
  {
    type: 'awards', label: 'Accreditations', icon: 'BadgeCheck',
    description: 'Licences, certifications and awards',
    fields: [
      ...intro('Recognition', 'Licensed, certified and recognised'),
      {
        key: 'items', type: 'list', label: 'Accreditations', hint: 'The section stays hidden until at least one is added. Only list accreditations you genuinely hold.', itemLabel: 'title',
        itemFields: [
          { key: 'title',  type: 'text',  label: 'Title' },
          { key: 'issuer', type: 'text',  label: 'Issued by' },
          { key: 'year',   type: 'text',  label: 'Year' },
          { key: 'image',  type: 'image', label: 'Logo / certificate (optional)' },
        ],
        newItem: { title: '', issuer: '', year: '', image: '' },
      },
    ],
    defaults: { eyebrow: 'Recognition', title: 'Licensed, certified and *recognised*', subtitle: '', items: [], background: 'white', align: 'center' },
  },
  {
    type: 'leadership', label: 'Leadership message', icon: 'MessageSquareQuote',
    description: 'A message from your CEO or founder',
    fields: [
      heading('Heading'),
      { key: 'eyebrow', type: 'text',     label: 'Eyebrow' },
      { key: 'title',   type: 'textarea', label: 'Title', hint: 'Wrap words in *asterisks* to highlight them' },
      heading('Person'),
      { key: 'image', type: 'image', label: 'Portrait', hint: 'Without a photo an elegant monogram card is shown' },
      { key: 'name',  type: 'text',  label: 'Name' },
      { key: 'role',  type: 'text',  label: 'Role' },
      heading('Message'),
      { key: 'quote', type: 'textarea', label: 'Pull quote' },
      { key: 'body',  type: 'textarea', label: 'Body text', hint: 'Leave a blank line between paragraphs' },
      { key: 'signature', type: 'text', label: 'Signature line', placeholder: 'Santosh Bhagat' },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: 'Leadership',
      title: 'Leadership built on *trust and expertise*',
      image: '', name: 'Mr. Santosh Bhagat', role: 'CEO & Co-Founder, Al Khadim LLC',
      quote: 'Our mission is to bridge exceptional talent with visionary organisations — building a stronger UAE workforce, one placement at a time.',
      body: "With a background spanning transport, people management and strategic consulting, Mr. Santosh Bhagat co-founded Al Khadim LLC to meet the UAE's growing demand for comprehensive manpower solutions.\n\nUnder his leadership, Al Khadim has grown to serve enterprise clients across the UAE and beyond.",
      signature: 'Santosh Bhagat',
      ctaLabel: 'Read our story', ctaHref: '/about',
      background: 'white',
    },
  },
  {
    type: 'cvUpload', label: 'CV upload call-out', icon: 'FileUp',
    description: 'Invite job seekers to register and upload a CV',
    fields: [
      ...intro('For job seekers', 'Upload your CV. Get placed in the UAE.'),
      {
        key: 'steps', type: 'list', label: 'Steps', itemLabel: 'title', max: 6,
        itemFields: [
          { key: 'icon',        type: 'icon', label: 'Icon' },
          { key: 'title',       type: 'text', label: 'Title' },
          { key: 'description', type: 'text', label: 'Description' },
        ],
        newItem: { icon: 'CheckCircle2', title: 'New step', description: '' },
      },
      ...cta('cta1', 'Primary button'),
      ...cta('cta2', 'Secondary button'),
      { key: 'note', type: 'text', label: 'Privacy note' },
      { key: 'image', type: 'image', label: 'Image (optional)', hint: 'Without an image a profile illustration is shown' },
    ],
    defaults: {
      eyebrow: 'For job seekers',
      title: 'Upload your CV.\n*Get placed in the UAE.*',
      subtitle: "Create your profile in minutes. Once approved by our team you'll get a personal dashboard and direct exposure to hiring employers.",
      steps: [
        { icon: 'UploadCloud', title: 'Upload your CV',      description: 'PDF or Word — we fill in your profile for you' },
        { icon: 'BadgeCheck',  title: 'Get verified',        description: 'Our consultants review and approve your profile' },
        { icon: 'Eye',         title: 'Get discovered',      description: 'Employers across the UAE can find you' },
        { icon: 'Handshake',   title: 'Land the role',       description: 'We support you from interview to offer' },
      ],
      cta1Label: 'Upload CV now', cta1Href: '/candidate/register',
      cta2Label: 'Already registered? Sign in', cta2Href: '/candidate/login',
      note: 'Your data is confidential and only shared with your consent.',
      image: '',
      background: 'sand',
    },
  },
  {
    type: 'faq', label: 'FAQ', icon: 'HelpCircle',
    description: 'Frequently asked questions',
    fields: [
      ...intro('FAQ', 'Frequently asked questions'),
      {
        key: 'items', type: 'list', label: 'Questions', itemLabel: 'question',
        itemFields: [
          { key: 'question', type: 'text',     label: 'Question' },
          { key: 'answer',   type: 'textarea', label: 'Answer' },
        ],
        newItem: { question: 'New question', answer: '' },
      },
      heading('Side panel'),
      { key: 'panelTitle', type: 'text', label: 'Panel title' },
      { key: 'panelText',  type: 'text', label: 'Panel text' },
      ...cta('cta', 'Panel button'),
    ],
    defaults: {
      eyebrow: 'FAQ',
      title: 'Frequently asked *questions*',
      subtitle: '',
      items: [
        { question: 'What services does Al Khadim offer?', answer: 'We provide permanent placement, recruitment, executive search, contract staffing and outsourcing, visa and PRO services, payroll, and HR and management consultancy.' },
        { question: 'Which Emirates do you cover?', answer: 'We work with employers and candidates across all seven Emirates — Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah.' },
        { question: 'How do I start hiring through Al Khadim?', answer: 'Send us an enquiry with the roles you need to fill. A consultant will contact you to understand your requirements and agree the next steps.' },
        { question: 'How do I apply for jobs?', answer: 'Browse open roles on our careers page, or register and upload your CV so our consultants can match you with suitable opportunities.' },
        { question: 'Can you help with UAE visas and work permits?', answer: 'Yes. Our visa and PRO team can handle work permits, Emirates ID and related government formalities for the people we place.' },
      ],
      panelTitle: 'Still have questions?',
      panelText: 'Our consultants are happy to help.',
      ctaLabel: 'Contact us', ctaHref: '/contact',
      background: 'white',
    },
  },
  {
    type: 'cta', label: 'Closing call-to-action', icon: 'Megaphone',
    description: 'Employer and job-seeker cards with trust points',
    fields: [
      heading('Employer card'),
      { key: 'employerEyebrow', type: 'text',     label: 'Eyebrow' },
      { key: 'employerTitle',   type: 'text',     label: 'Title' },
      { key: 'employerText',    type: 'textarea', label: 'Text' },
      ...cta('employerCta', 'Button'),
      heading('Job seeker card'),
      { key: 'seekerEyebrow', type: 'text',     label: 'Eyebrow' },
      { key: 'seekerTitle',   type: 'text',     label: 'Title' },
      { key: 'seekerText',    type: 'textarea', label: 'Text' },
      ...cta('seekerCta', 'Button'),
      heading('Trust strip'),
      {
        key: 'trustItems', type: 'list', label: 'Trust points', itemLabel: 'text', max: 6,
        itemFields: [{ key: 'text', type: 'text', label: 'Text' }], newItem: { text: 'New point' },
      },
    ],
    defaults: {
      employerEyebrow: 'For employers', employerTitle: 'Find the right talent, fast.',
      employerText: 'Access verified candidates across the UAE. Our consultants match you with the right professionals.',
      employerCtaLabel: 'Start hiring', employerCtaHref: '/enquiry',
      seekerEyebrow: 'For job seekers', seekerTitle: 'Land your next role in the UAE.',
      seekerText: 'Browse open positions across UAE companies and let our placement experts guide your career.',
      seekerCtaLabel: 'Find work', seekerCtaHref: '/careers',
      trustItems: [{ text: 'Free consultation' }, { text: '48-hour response' }, { text: '100% confidential' }, { text: 'UAE licensed' }],
      background: 'ink', pattern: true,
    },
  },
  {
    type: 'serviceStrip', label: 'Services strip', icon: 'LayoutGrid',
    description: 'A row of compact service tiles, tucked under the hero',
    fields: [
      heading('Layout'),
      { key: 'overlap', type: 'toggle', label: 'Overlap the section above', hint: 'Lifts the strip so it sits over the bottom of the hero' },
      {
        key: 'items', type: 'list', label: 'Services', itemLabel: 'title', max: 12,
        itemFields: [
          { key: 'icon',        type: 'icon', label: 'Icon' },
          { key: 'title',       type: 'text', label: 'Title' },
          { key: 'description', type: 'text', label: 'Short description' },
          { key: 'href',        type: 'link', label: 'Link' },
        ],
        newItem: { icon: 'Briefcase', title: 'New service', description: '', href: '/services' },
      },
    ],
    defaults: {
      overlap: false,
      items: [
        { icon: 'Users',        title: 'HR Consultancy',          description: 'Strategic HR solutions for business growth',      href: '/services#consultancy' },
        { icon: 'HardHat',      title: 'Manpower Supply',         description: 'Skilled & unskilled workforce across industries', href: '/services#placement' },
        { icon: 'Settings',     title: 'Outsourcing Solutions',   description: 'Flexible workforce for operational efficiency',   href: '/services#outsourcing' },
        { icon: 'BarChart3',    title: 'Management Consultancy',  description: 'Expert guidance for sustainable growth',          href: '/services#consultancy' },
        { icon: 'FileText',     title: 'PRO Services',            description: 'Government relations & approvals',   href: '/services#residency' },
        { icon: 'Bus',          title: 'Employee Transport',      description: 'Safe, reliable & on-time transportation',        href: '/enquiry?service=Employee%20Transport' },
        { icon: 'Home',         title: 'Accommodation',           description: 'Comfortable housing for your workforce',          href: '/enquiry?service=Accommodation' },
        { icon: 'ShieldCheck',  title: 'Insurance Services',      description: 'Comprehensive insurance solutions',               href: '/enquiry?service=Insurance' },
        { icon: 'BookUser',     title: 'Visa & Immigration',      description: 'Visa processing & immigration support',          href: '/services#residency' },
        { icon: 'Plane',        title: 'Air Ticketing',           description: 'Global travel & ticketing assistance',            href: '/enquiry?service=Air%20Ticketing' },
      ],
      background: 'sand', spacing: 'compact',
    },
  },
  {
    type: 'globalHiring', label: 'Global hiring', icon: 'Earth',
    description: 'Country cards for the markets you recruit from and for',
    fields: [
      heading('Heading'),
      { key: 'title',    type: 'text', label: 'Title' },
      { key: 'subtitle', type: 'text', label: 'Subtitle' },
      {
        key: 'items', type: 'list', label: 'Countries / regions', itemLabel: 'name', max: 8,
        itemFields: [
          { key: 'name',  type: 'text',  label: 'Name' },
          { key: 'code',  type: 'text',  label: 'Flag code', hint: 'Two-letter country code (ae, sa, qa, om, in…) or eu', placeholder: 'ae' },
          { key: 'image', type: 'image', label: 'Image' },
          { key: 'href',  type: 'link',  label: 'Link (optional)' },
        ],
        newItem: { name: 'New country', code: '', image: '', href: '' },
      },
      heading('Closing card'),
      { key: 'cardTitle', type: 'text',  label: 'Title' },
      { key: 'cardText',  type: 'text',  label: 'Text' },
      { key: 'cardHref',  type: 'link',  label: 'Link' },
      { key: 'cardImage', type: 'image', label: 'Background image' },
    ],
    defaults: {
      title: 'Global hiring solutions',
      subtitle: 'Connecting talent across borders',
      items: [
        { name: 'UAE',          code: 'ae', image: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=600&q=70', href: '' },
        { name: 'Saudi Arabia', code: 'sa', image: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=600&q=70', href: '' },
        { name: 'Qatar',        code: 'qa', image: '', href: '' },
        { name: 'Oman',         code: 'om', image: 'https://images.unsplash.com/photo-1621680696874-edd80ce57b72?w=600&q=70', href: '' },
        { name: 'Europe',       code: 'eu', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=70', href: '' },
        { name: 'Canada',       code: 'ca', image: 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=600&q=70', href: '' },
      ],
      cardTitle: 'Global opportunities', cardText: 'Endless possibilities', cardHref: '/careers',
      cardImage: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=70',
      background: 'sand', spacing: 'tight', anchor: 'global-hiring',
    },
  },
  {
    type: 'banner', label: 'Banner', icon: 'RectangleHorizontal',
    description: 'A bold full-width band with a message and buttons',
    fields: [
      ...intro('', 'Ready to build your team?'),
      ...cta('cta1', 'Primary button'),
      ...cta('cta2', 'Secondary button'),
    ],
    defaults: {
      eyebrow: '', title: 'Ready to build your *dream team*?', subtitle: 'Talk to a consultant today — no obligation.',
      cta1Label: 'Get in touch', cta1Href: '/enquiry', cta2Label: '', cta2Href: '',
      background: 'gradient', align: 'center', pattern: true,
    },
  },
  {
    type: 'content', label: 'Text & image', icon: 'LayoutPanelLeft',
    description: 'A free-form block: text with an optional image',
    fields: [
      ...intro('', 'Your heading'),
      { key: 'body', type: 'textarea', label: 'Body text', hint: 'Leave a blank line between paragraphs' },
      { key: 'image', type: 'image', label: 'Image (optional)' },
      {
        key: 'imagePosition', type: 'select', label: 'Image position',
        options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }],
      },
      {
        key: 'bullets', type: 'list', label: 'Bullet points', itemLabel: 'text',
        itemFields: [{ key: 'text', type: 'text', label: 'Text' }], newItem: { text: 'New point' },
      },
      ...cta('cta', 'Button'),
    ],
    defaults: {
      eyebrow: '', title: 'Your heading', subtitle: '', body: 'Write your content here.',
      image: '', imagePosition: 'right', bullets: [], ctaLabel: '', ctaHref: '',
      background: 'white',
    },
  },
];

export const SECTION_BY_TYPE: Record<string, SectionDef> =
  Object.fromEntries(SECTION_DEFS.map(d => [d.type, d]));
