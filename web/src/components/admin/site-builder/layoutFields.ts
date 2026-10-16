import type { Field } from '@/lib/homepage/schema';

const h = (label: string, hint?: string): Field => ({ key: `__${label}`, type: 'heading', label, hint });
const linkFields: Field[] = [
  { key: 'label', type: 'text', label: 'Label' },
  { key: 'href',  type: 'link', label: 'Link' },
];

/** Site header form (the `navbar` document — shown on every public page). */
export const NAVBAR_FIELDS: Field[] = [
  h('Logo', 'Without an uploaded logo, the Al Khadim badge and company name are shown'),
  { key: 'logoText',   type: 'text',  label: 'Company name' },
  { key: 'tagline',    type: 'text',  label: 'Suffix', placeholder: 'LLC' },
  { key: 'logoArabic', type: 'text',  label: 'Arabic name', hint: 'Shown under the company name' },
  { key: 'logoImage',       type: 'image', label: 'Logo image (light backgrounds)', hint: 'Wide logos work best — shown about 40px tall' },
  { key: 'logoImageOnDark', type: 'image', label: 'Logo image (dark backgrounds)', hint: 'Used over a dark hero image and in the footer' },
  h('Menu'),
  {
    key: 'links', type: 'list', label: 'Menu links', itemLabel: 'label', max: 9,
    itemFields: [
      ...linkFields,
      { key: 'children', type: 'list', label: 'Dropdown links', hint: 'Optional — turns the link into a dropdown', itemLabel: 'label', itemFields: linkFields, newItem: { label: 'New link', href: '/' }, max: 8 },
    ],
    newItem: { label: 'New link', href: '/', children: [] },
  },
  h('Button & search'),
  { key: 'ctaLabel', type: 'text', label: 'Button text', hint: 'Leave empty to hide' },
  { key: 'ctaHref',  type: 'link', label: 'Button link' },
  { key: 'showSearch',        type: 'toggle', label: 'Show job search' },
  { key: 'searchPlaceholder', type: 'text',   label: 'Search placeholder', showIf: { key: 'showSearch', equals: [true] } },
  h('Log-in menu'),
  { key: 'showLogin',  type: 'toggle', label: 'Show the log-in menu' },
  { key: 'loginLabel', type: 'text',   label: 'Menu label', showIf: { key: 'showLogin', equals: [true] } },
  {
    key: 'loginLinks', type: 'list', label: 'Log-in options', itemLabel: 'label', showIf: { key: 'showLogin', equals: [true] },
    itemFields: [...linkFields, { key: 'icon', type: 'icon', label: 'Icon' }],
    newItem: { label: 'New option', href: '/login', icon: 'UserCheck' },
  },
  h('Behaviour'),
  { key: 'transparentOnHero', type: 'toggle', label: 'Transparent over a dark hero image', hint: 'Only applies to the full-width image hero layouts' },
  h('Utility strip', 'A thin dark strip above the header on the homepage (tablets and up); it slides away on scroll'),
  { key: 'topBarEnabled', type: 'toggle', label: 'Show the utility strip' },
  { key: 'headerTagline', type: 'text',   label: 'Tagline', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'expertLabel',   type: 'text',   label: 'Phone label', placeholder: 'Talk to our experts', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'expertPhone',   type: 'text',   label: 'Phone number', placeholder: '+971 4 000 0000', hint: 'Also shown in the phone menu', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'topBarEmail',   type: 'text',   label: 'Email', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'topBarHours',   type: 'text',   label: 'Opening hours', hint: 'Shown on very wide screens', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'topBarSocials', type: 'toggle', label: 'Show social icons', hint: 'Uses the links set in the footer', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'langLabel', type: 'text', label: 'Other-language link text', hint: 'e.g. عربي — shown only when a link is set too', placeholder: 'عربي', showIf: { key: 'topBarEnabled', equals: [true] } },
  { key: 'langHref',  type: 'link', label: 'Other-language link', hint: 'Address of your Arabic site, if you have one', showIf: { key: 'topBarEnabled', equals: [true] } },
];

/** Site footer form (the `footer` document). */
export const FOOTER_FIELDS: Field[] = [
  h('Brand'),
  { key: 'logoText',    type: 'text',     label: 'Company name' },
  { key: 'tagline',     type: 'text',     label: 'Suffix' },
  { key: 'logoArabic',  type: 'text',     label: 'Arabic name' },
  { key: 'logoImage',   type: 'image',    label: 'Logo image', hint: 'Shown on a dark background' },
  { key: 'description', type: 'textarea', label: 'Short description' },
  { key: 'showFlagStripe', type: 'toggle', label: 'Show UAE flag stripe on top' },
  h('Call-to-action band'),
  { key: 'ctaEnabled', type: 'toggle', label: 'Show the band above the footer' },
  { key: 'ctaTitle',   type: 'text',   label: 'Title', showIf: { key: 'ctaEnabled', equals: [true] } },
  { key: 'ctaText',    type: 'text',   label: 'Text',  showIf: { key: 'ctaEnabled', equals: [true] } },
  { key: 'ctaLabel',   type: 'text',   label: 'Button text', showIf: { key: 'ctaEnabled', equals: [true] } },
  { key: 'ctaHref',    type: 'link',   label: 'Button link', showIf: { key: 'ctaEnabled', equals: [true] } },
  h('Link columns'),
  {
    key: 'columns', type: 'list', label: 'Columns', itemLabel: 'title', max: 3,
    itemFields: [
      { key: 'title', type: 'text', label: 'Column title' },
      { key: 'links', type: 'list', label: 'Links', itemLabel: 'label', itemFields: linkFields, newItem: { label: 'New link', href: '/' } },
    ],
    newItem: { title: 'New column', links: [] },
  },
  h('Contact'),
  { key: 'address', type: 'textarea', label: 'Address' },
  { key: 'mapUrl',  type: 'link',     label: 'Map link (optional)', placeholder: 'https://maps.google.com/…' },
  { key: 'phone',   type: 'text',     label: 'Phone' },
  { key: 'email',   type: 'text',     label: 'Email' },
  { key: 'hours',   type: 'text',     label: 'Opening hours' },
  h('Social media', 'Leave a field empty to hide that icon'),
  { key: 'showSocials',      type: 'toggle', label: 'Show social icons' },
  { key: 'socials.linkedin',  type: 'link', label: 'LinkedIn',  showIf: { key: 'showSocials', equals: [true] } },
  { key: 'socials.instagram', type: 'link', label: 'Instagram', showIf: { key: 'showSocials', equals: [true] } },
  { key: 'socials.facebook',  type: 'link', label: 'Facebook',  showIf: { key: 'showSocials', equals: [true] } },
  { key: 'socials.twitter',   type: 'link', label: 'X (Twitter)', showIf: { key: 'showSocials', equals: [true] } },
  { key: 'socials.youtube',   type: 'link', label: 'YouTube',   showIf: { key: 'showSocials', equals: [true] } },
  { key: 'socials.whatsapp',  type: 'link', label: 'WhatsApp',  placeholder: 'https://wa.me/971…', showIf: { key: 'showSocials', equals: [true] } },
  h('Bottom bar'),
  { key: 'copyright',   type: 'text', label: 'Copyright', hint: '{year} is replaced with the current year' },
  { key: 'licenseText', type: 'text', label: 'Licence / registration line', placeholder: 'Trade licence no. …' },
  { key: 'legalLinks',  type: 'list', label: 'Legal links', itemLabel: 'label', itemFields: linkFields, newItem: { label: 'Privacy Policy', href: '/privacy' }, max: 5 },
];

export const SEO_FIELDS: Field[] = [
  { key: 'title',       type: 'text',     label: 'Page title', hint: 'Shown in the browser tab and search results — aim for under 60 characters' },
  { key: 'description', type: 'textarea', label: 'Meta description', hint: 'The summary under the title in search results — aim for 120–160 characters' },
  { key: 'keywords',    type: 'text',     label: 'Keywords', hint: 'Comma-separated' },
  { key: 'ogImage',     type: 'image',    label: 'Social sharing image', hint: '1200×630 recommended — shown when the site is shared on WhatsApp, LinkedIn, etc.' },
];
