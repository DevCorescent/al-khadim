/**
 * Email builder blocks: the settings each block exposes (rendered as a form by
 * the builder) and its starting content. A design is an ordered list of blocks
 * plus a few document settings; `render.ts` turns it into email-safe HTML.
 */
import type { Field } from '@/lib/homepage/schema';

export interface EmailBlock { id: string; type: string; [key: string]: any }

export interface EmailDesign {
  kind: 'ak-email';
  version: 1;
  settings: {
    /** Hidden preview line shown next to the subject in the inbox. */
    preheader: string;
    showHeader: boolean;
    showFooter: boolean;
  };
  blocks: EmailBlock[];
}

export interface EmailBlockDef {
  type: string;
  label: string;
  description: string;
  icon: string;
  fields: Field[];
  defaults: Record<string, any>;
}

const h = (label: string, hint?: string): Field => ({ key: `__${label}`, type: 'heading', label, hint });
const ALIGN: Field = { key: 'align', type: 'select', label: 'Alignment', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }] };

/** Spacing and background every block gets. */
export const BLOCK_STYLE_FIELDS: Field[] = [
  h('Block style'),
  {
    key: 'background', type: 'select', label: 'Background',
    options: [{ value: 'none', label: 'None' }, { value: 'soft', label: 'Soft tint' }, { value: 'brand', label: 'Brand' }, { value: 'custom', label: 'Custom' }],
  },
  { key: 'bgColor', type: 'color', label: 'Custom background', showIf: { key: 'background', equals: ['custom'] } },
  { key: 'paddingTop', type: 'number', label: 'Space above (px)', min: 0, max: 64 },
  { key: 'paddingBottom', type: 'number', label: 'Space below (px)', min: 0, max: 64 },
  { key: 'hideOnMobile', type: 'toggle', label: 'Hide on mobile' },
];
export const BLOCK_STYLE_DEFAULTS = { background: 'none', bgColor: '#F5F2EB', paddingTop: 8, paddingBottom: 8, hideOnMobile: false };

const TEXT_HINT = 'Blank line = new paragraph. **bold**, *italic*, [link text](https://…), lines starting with “- ” become a list. Merge tags like {{firstName}} are filled in when sent.';

export const EMAIL_BLOCKS: EmailBlockDef[] = [
  {
    type: 'heading', label: 'Heading', description: 'A title or section heading', icon: 'LayoutPanelLeft',
    fields: [
      { key: 'text', type: 'textarea', label: 'Text', hint: 'Merge tags allowed' },
      { key: 'level', type: 'select', label: 'Size', options: [{ value: 'h1', label: 'Large' }, { value: 'h2', label: 'Medium' }, { value: 'h3', label: 'Small' }] },
      ALIGN,
      { key: 'color', type: 'color', label: 'Colour (empty = theme)' },
    ],
    defaults: { text: 'Your heading', level: 'h2', align: 'left', color: '' },
  },
  {
    type: 'text', label: 'Text', description: 'Paragraphs with bold, italic, links and lists', icon: 'FileText',
    fields: [
      { key: 'text', type: 'textarea', label: 'Text', hint: TEXT_HINT },
      ALIGN,
      { key: 'size', type: 'select', label: 'Text size', options: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Normal' }, { value: 'lg', label: 'Large' }] },
      { key: 'color', type: 'color', label: 'Colour (empty = theme)' },
    ],
    defaults: { text: 'Write your message here.', align: 'left', size: 'md', color: '' },
  },
  {
    type: 'button', label: 'Button', description: 'A call-to-action button', icon: 'Target',
    fields: [
      { key: 'label', type: 'text', label: 'Button text' },
      { key: 'url', type: 'link', label: 'Link', hint: 'Merge tags allowed, e.g. {{viewLink}}' },
      { key: 'style', type: 'select', label: 'Style', options: [{ value: 'primary', label: 'Brand' }, { value: 'accent', label: 'Gold' }, { value: 'outline', label: 'Outline' }] },
      ALIGN,
      { key: 'fullWidth', type: 'toggle', label: 'Full width' },
      { key: 'note', type: 'text', label: 'Small text under the button', hint: 'e.g. a fallback link: {{viewLink}}' },
    ],
    defaults: { label: 'Open dashboard', url: 'https://', style: 'primary', align: 'left', fullWidth: false, note: '' },
  },
  {
    type: 'image', label: 'Image', description: 'A picture or banner, optionally linked', icon: 'Monitor',
    fields: [
      { key: 'src', type: 'image', label: 'Image', hint: 'JPG or PNG, at least 1200px wide for banners' },
      { key: 'alt', type: 'text', label: 'Description (shown if images are blocked)' },
      { key: 'url', type: 'link', label: 'Link (optional)' },
      { key: 'width', type: 'number', label: 'Width (%)', min: 10, max: 100 },
      ALIGN,
      { key: 'rounded', type: 'toggle', label: 'Rounded corners' },
    ],
    defaults: { src: '', alt: '', url: '', width: 100, align: 'center', rounded: true },
  },
  {
    type: 'code', label: 'Highlighted code', description: 'A large code or reference (OTP, CV ID)', icon: 'BadgeCheck',
    fields: [
      { key: 'label', type: 'text', label: 'Label above' },
      { key: 'code', type: 'text', label: 'Code', hint: 'Usually a merge tag, e.g. {{code}}' },
      { key: 'note', type: 'text', label: 'Note below' },
    ],
    defaults: { label: 'Your verification code', code: '{{code}}', note: '' },
  },
  {
    type: 'details', label: 'Details table', description: 'Label / value rows (dates, venue, reference)', icon: 'BarChart3',
    fields: [
      { key: 'title', type: 'text', label: 'Title (optional)' },
      {
        key: 'rows', type: 'list', label: 'Rows', itemLabel: 'label',
        itemFields: [{ key: 'label', type: 'text', label: 'Label' }, { key: 'value', type: 'text', label: 'Value', hint: 'Merge tags allowed' }],
        newItem: { label: 'Label', value: '' },
      },
    ],
    defaults: { title: '', rows: [{ label: 'Date', value: '{{date}}' }, { label: 'Time', value: '{{time}}' }] },
  },
  {
    type: 'callout', label: 'Info box', description: 'A coloured note to draw attention', icon: 'Megaphone',
    fields: [
      { key: 'title', type: 'text', label: 'Title (optional)' },
      { key: 'text', type: 'textarea', label: 'Text', hint: TEXT_HINT },
      { key: 'tone', type: 'select', label: 'Tone', options: [
        { value: 'brand', label: 'Brand' }, { value: 'info', label: 'Info' }, { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' }, { value: 'neutral', label: 'Neutral' },
      ] },
    ],
    defaults: { title: '', text: 'Something worth highlighting.', tone: 'brand' },
  },
  {
    type: 'list', label: 'List', description: 'Bulleted, numbered or tick list', icon: 'CheckCircle2',
    fields: [
      { key: 'style', type: 'select', label: 'Style', options: [{ value: 'check', label: 'Ticks' }, { value: 'bullet', label: 'Bullets' }, { value: 'number', label: 'Numbers' }] },
      { key: 'items', type: 'list', label: 'Items', itemLabel: 'text', itemFields: [{ key: 'text', type: 'text', label: 'Text' }], newItem: { text: 'New item' } },
    ],
    defaults: { style: 'check', items: [{ text: 'First point' }, { text: 'Second point' }] },
  },
  {
    type: 'quote', label: 'Quote / message', description: 'A personal message or quotation', icon: 'Quote',
    fields: [
      { key: 'text', type: 'textarea', label: 'Text', hint: TEXT_HINT },
      { key: 'author', type: 'text', label: 'From (optional)' },
    ],
    defaults: { text: 'A short personal message.', author: '' },
  },
  {
    type: 'columns', label: 'Two columns', description: 'Side-by-side text (stacks on mobile)', icon: 'LayoutPanelLeft',
    fields: [
      { key: 'leftTitle', type: 'text', label: 'Left title' },
      { key: 'left', type: 'textarea', label: 'Left text', hint: TEXT_HINT },
      { key: 'rightTitle', type: 'text', label: 'Right title' },
      { key: 'right', type: 'textarea', label: 'Right text', hint: TEXT_HINT },
    ],
    defaults: { leftTitle: 'Left', left: 'Some text.', rightTitle: 'Right', right: 'Some text.' },
  },
  {
    type: 'divider', label: 'Divider', description: 'A horizontal line', icon: 'RectangleHorizontal',
    fields: [
      { key: 'color', type: 'color', label: 'Colour (empty = theme border)' },
      { key: 'thickness', type: 'number', label: 'Thickness (px)', min: 1, max: 6 },
      { key: 'width', type: 'number', label: 'Width (%)', min: 10, max: 100 },
    ],
    defaults: { color: '', thickness: 1, width: 100 },
  },
  {
    type: 'spacer', label: 'Spacer', description: 'Empty vertical space', icon: 'Route',
    fields: [{ key: 'height', type: 'number', label: 'Height (px)', min: 4, max: 120 }],
    defaults: { height: 24 },
  },
  {
    type: 'signature', label: 'Sign-off', description: 'Closing line with name and team', icon: 'MessageSquareQuote',
    fields: [
      { key: 'closing', type: 'text', label: 'Closing', placeholder: 'Kind regards,' },
      { key: 'name', type: 'text', label: 'Name or team' },
      { key: 'title', type: 'text', label: 'Title / company' },
    ],
    defaults: { closing: 'Kind regards,', name: 'Al Khadim Team', title: 'Al Khadim LLC' },
  },
  {
    type: 'social', label: 'Social links', description: 'Links to your social profiles (from the theme)', icon: 'Globe2',
    fields: [ALIGN, { key: 'label', type: 'text', label: 'Label above (optional)' }],
    defaults: { align: 'center', label: 'Follow us' },
  },
  {
    type: 'html', label: 'Custom HTML', description: 'Raw HTML for advanced layouts', icon: 'FileUp',
    fields: [{ key: 'html', type: 'textarea', label: 'HTML', hint: 'Inserted as-is. Use inline styles; {{tags}} still work.' }],
    defaults: { html: '<p>Custom HTML</p>' },
  },
];

export const EMAIL_BLOCK_BY_TYPE: Record<string, EmailBlockDef> = Object.fromEntries(EMAIL_BLOCKS.map(b => [b.type, b]));

let seq = 0;
export function newEmailBlock(type: string, props: Record<string, any> = {}): EmailBlock {
  const def = EMAIL_BLOCK_BY_TYPE[type];
  seq += 1;
  return {
    ...BLOCK_STYLE_DEFAULTS,
    ...JSON.parse(JSON.stringify(def?.defaults || {})),
    ...props,
    id: `${type}-${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 5)}`,
    type,
  };
}

export function emptyDesign(): EmailDesign {
  return {
    kind: 'ak-email', version: 1,
    settings: { preheader: '', showHeader: true, showFooter: true },
    blocks: [newEmailBlock('heading', { text: 'Hello {{name}},', level: 'h2' }), newEmailBlock('text'), newEmailBlock('signature')],
  };
}

export function isBuilderDesign(d: any): d is EmailDesign {
  return !!d && typeof d === 'object' && d.kind === 'ak-email' && Array.isArray(d.blocks);
}

/** Stored design with defaults filled in (fields added later, unknown types dropped). */
export function normalizeDesign(d: any): EmailDesign {
  if (!isBuilderDesign(d)) return emptyDesign();
  return {
    kind: 'ak-email', version: 1,
    settings: { preheader: '', showHeader: true, showFooter: true, ...(d.settings || {}) },
    blocks: d.blocks
      .filter((b: any) => b && EMAIL_BLOCK_BY_TYPE[b.type])
      .map((b: any) => ({ ...BLOCK_STYLE_DEFAULTS, ...EMAIL_BLOCK_BY_TYPE[b.type].defaults, ...b })),
  };
}
