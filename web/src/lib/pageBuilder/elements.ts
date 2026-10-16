/**
 * Element registry: every node type the page builder knows, with the content
 * fields its inspector shows and the props/styles a new one starts with.
 * Isomorphic — the API's sanitiser validates stored nodes against it.
 */
import type { FieldOption, FieldType } from '@/lib/homepage/schema';
import type { Device, StyleProps } from './types';

export type PBFieldType = FieldType | 'richtext' | 'code' | 'range' | 'datetime' | 'align' | 'font' | 'columns';

export interface PBField {
  key: string;
  type: PBFieldType;
  label: string;
  hint?: string;
  placeholder?: string;
  options?: FieldOption[];
  itemFields?: PBField[];
  itemLabel?: string;
  newItem?: Record<string, any>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  showIf?: { key: string; equals: any[] };
  wide?: boolean;
}

export type ElementCategory = 'Layout' | 'Basic' | 'Media' | 'Content' | 'Interactive' | 'Marketing' | 'Forms & data';

export interface ElementDef {
  type: string;
  label: string;
  /** lucide icon name (resolved in the editor). */
  icon: string;
  category: ElementCategory;
  description: string;
  keywords?: string;
  fields: PBField[];
  defaults: Record<string, any>;
  style?: Partial<Record<Device, StyleProps>>;
  /** Props holding HTML that the server sanitises (top-level key or `list.key`). */
  html?: string[];
  /** Props holding URLs (checked against unsafe schemes on save). */
  links?: string[];
}

/* ─── Field helpers ─────────────────────────────────────────────────────── */

const h = (label: string, hint?: string): PBField => ({ key: `__${label}`, type: 'heading', label, hint });
const text = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'text', label, ...x });
const area = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'textarea', label, ...x });
const rich = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'richtext', label, wide: true, ...x });
const link = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'link', label, placeholder: '/contact or https://…', ...x });
const img = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'image', label, ...x });
const col = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'color', label, hint: x.hint ?? 'Empty uses the theme colour', ...x });
const tog = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'toggle', label, ...x });
const num = (key: string, label: string, x: Partial<PBField> = {}): PBField => ({ key, type: 'number', label, ...x });
const range = (key: string, label: string, min: number, max: number, x: Partial<PBField> = {}): PBField => ({ key, type: 'range', label, min, max, step: 1, ...x });
const icon = (key: string, label = 'Icon', x: Partial<PBField> = {}): PBField => ({ key, type: 'icon', label, ...x });
const sel = (key: string, label: string, opts: [string, string][], x: Partial<PBField> = {}): PBField =>
  ({ key, type: 'select', label, options: opts.map(([value, l]) => ({ value, label: l })), ...x });
const align = (key = 'align', label = 'Alignment', x: Partial<PBField> = {}): PBField => ({ key, type: 'align', label, ...x });
const list = (key: string, label: string, itemFields: PBField[], newItem: Record<string, any>, itemLabel: string, x: Partial<PBField> = {}): PBField =>
  ({ key, type: 'list', label, itemFields, newItem, itemLabel, wide: true, ...x });
const show = (key: string, ...equals: any[]) => ({ showIf: { key, equals } });

const BTN_VARIANTS: [string, string][] = [
  ['primary', 'Primary (filled)'], ['secondary', 'Secondary (dark)'], ['gold', 'Gold'], ['outline', 'Outline'],
  ['white', 'White'], ['ghost', 'Ghost'], ['link', 'Text link'], ['custom', 'Custom colours'],
];
const SIZES: [string, string][] = [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'Extra large']];
const CARD_STYLES: [string, string][] = [['none', 'Plain'], ['bordered', 'Bordered'], ['shadow', 'Shadow card'], ['filled', 'Filled (sand)'], ['dark', 'Dark card'], ['glass', 'Glass']];
const SHAPES: [string, string][] = [['none', 'No background'], ['circle', 'Circle'], ['rounded', 'Rounded square'], ['square', 'Square']];
const ASPECTS: [string, string][] = [['auto', 'Original'], ['1/1', 'Square 1:1'], ['4/3', 'Landscape 4:3'], ['3/2', 'Photo 3:2'], ['16/9', 'Wide 16:9'], ['21/9', 'Cinema 21:9'], ['3/4', 'Portrait 3:4'], ['2/3', 'Tall 2:3']];
const COLS: [string, string][] = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']];

const buttonItem: PBField[] = [
  text('label', 'Text'), link('href', 'Link'),
  sel('variant', 'Style', BTN_VARIANTS), icon('icon', 'Icon (optional)'),
  sel('iconPos', 'Icon position', [['right', 'After text'], ['left', 'Before text']]),
  tog('newTab', 'Open in a new tab'),
  col('bg', 'Background', show('variant', 'custom')), col('fg', 'Text colour', show('variant', 'custom')),
  col('hoverBg', 'Hover background', show('variant', 'custom')),
];

const responsiveCols = (prefix = 'cols', d = '3', t = '2', m = '1'): PBField[] => [
  sel(prefix, 'Columns — desktop', COLS), sel(`${prefix}Tablet`, 'Columns — tablet', COLS), sel(`${prefix}Mobile`, 'Columns — mobile', COLS),
];

const sp = (pt: string, pb: string, mpt = pt, mpb = pb) => ({ desktop: { pt, pb }, mobile: { pt: mpt, pb: mpb } });

/* ─── Structure ─────────────────────────────────────────────────────────── */

export const SECTION_DEF: ElementDef = {
  type: 'section', label: 'Section', icon: 'Rows3', category: 'Layout', description: 'A full-width band holding columns',
  fields: [
    h('Layout'),
    sel('width', 'Content width', [['boxed', 'Boxed'], ['full', 'Full width'], ['narrow', 'Narrow (reading width)']]),
    num('boxWidth', 'Boxed width (px)', { placeholder: '1240', ...show('width', 'boxed') }),
    sel('vAlign', 'Column vertical alignment', [['stretch', 'Stretch (equal height)'], ['flex-start', 'Top'], ['center', 'Middle'], ['flex-end', 'Bottom']]),
    sel('contentAlign', 'Content position in section', [['flex-start', 'Top'], ['center', 'Middle'], ['flex-end', 'Bottom']], { hint: 'Used when the section has a minimum height' }),
    sel('stackOn', 'Stack columns on', [['mobile', 'Mobile'], ['tablet', 'Tablet and mobile'], ['none', 'Never stack']]),
    tog('reverseOnMobile', 'Reverse column order when stacked'),
    sel('tag', 'HTML tag', [['section', 'section'], ['header', 'header'], ['div', 'div'], ['aside', 'aside'], ['footer', 'footer'], ['article', 'article']]),
    h('Background video', 'Plays muted behind the content; the background image shows while it loads'),
    text('bgVideo', 'Video URL (.mp4 or YouTube)', { placeholder: 'https://…/clip.mp4' }),
    h('Shape dividers'),
    sel('shapeTop', 'Top shape', [['none', 'None'], ['wave', 'Wave'], ['waves', 'Layered waves'], ['curve', 'Curve'], ['tilt', 'Tilt'], ['triangle', 'Triangle'], ['arrow', 'Arrow'], ['mountains', 'Mountains'], ['dunes', 'Desert dunes']]),
    col('shapeTopColor', 'Top shape colour', { hint: 'Usually the colour of the section above', ...show('shapeTop', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes') }),
    range('shapeTopHeight', 'Top shape height', 20, 240, { unit: 'px', ...show('shapeTop', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes') }),
    tog('shapeTopFlip', 'Flip top shape', show('shapeTop', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes')),
    sel('shapeBottom', 'Bottom shape', [['none', 'None'], ['wave', 'Wave'], ['waves', 'Layered waves'], ['curve', 'Curve'], ['tilt', 'Tilt'], ['triangle', 'Triangle'], ['arrow', 'Arrow'], ['mountains', 'Mountains'], ['dunes', 'Desert dunes']]),
    col('shapeBottomColor', 'Bottom shape colour', { hint: 'Usually the colour of the section below', ...show('shapeBottom', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes') }),
    range('shapeBottomHeight', 'Bottom shape height', 20, 240, { unit: 'px', ...show('shapeBottom', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes') }),
    tog('shapeBottomFlip', 'Flip bottom shape', show('shapeBottom', 'wave', 'waves', 'curve', 'tilt', 'triangle', 'arrow', 'mountains', 'dunes')),
    h('Decoration'),
    sel('pattern', 'Pattern overlay', [['none', 'None'], ['dots', 'Dots'], ['grid', 'Grid'], ['diagonal', 'Diagonal lines'], ['arabesque', 'Arabesque'], ['noise', 'Grain']]),
    tog('flagStripe', 'UAE flag stripe on top edge'),
  ],
  defaults: { width: 'boxed', boxWidth: '', vAlign: 'stretch', contentAlign: 'center', stackOn: 'mobile', reverseOnMobile: false, tag: 'section', bgVideo: '', shapeTop: 'none', shapeBottom: 'none', shapeTopHeight: 70, shapeBottomHeight: 70, pattern: 'none', flagStripe: false },
  style: { desktop: { pt: '88', pb: '88', pl: '24', pr: '24', gap: '32' }, tablet: { pt: '72', pb: '72' }, mobile: { pt: '56', pb: '56', pl: '16', pr: '16', gap: '24' } },
  links: ['bgVideo'],
};

export const COLUMN_DEF: ElementDef = {
  type: 'column', label: 'Column', icon: 'Columns2', category: 'Layout', description: 'Holds elements inside a section',
  fields: [
    h('Layout'),
    sel('vAlign', 'Vertical alignment of elements', [['flex-start', 'Top'], ['center', 'Middle'], ['flex-end', 'Bottom'], ['space-between', 'Space between']]),
    sel('hAlign', 'Horizontal position of narrow elements', [['stretch', 'Full width'], ['flex-start', 'Left'], ['center', 'Centre'], ['flex-end', 'Right']], { hint: 'Applies to elements given a custom width in Style → Size' }),
    link('href', 'Make the whole column a link', { hint: 'Optional' }),
  ],
  defaults: { vAlign: 'flex-start', hAlign: 'stretch', href: '' },
  style: { desktop: { gap: '20' } },
  links: ['href'],
};

/* ─── Elements ──────────────────────────────────────────────────────────── */

export const ELEMENTS: ElementDef[] = [
  /* Basic */
  {
    type: 'heading', label: 'Heading', icon: 'Heading', category: 'Basic', description: 'Titles from H1 to H6', keywords: 'title h1 h2 text',
    fields: [
      area('text', 'Text', { hint: 'Wrap words in *asterisks* to highlight them. Double-click on the canvas to edit inline.' }),
      sel('tag', 'HTML tag', [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'], ['p', 'Paragraph'], ['div', 'div']]),
      sel('size', 'Size preset', [['display', 'Display'], ['xxl', 'XXL'], ['xl', 'XL'], ['lg', 'Large'], ['md', 'Medium'], ['sm', 'Small'], ['xs', 'Extra small'], ['custom', 'Custom (Style tab)']]),
      align(),
      link('href', 'Link (optional)'),
      h('Highlight & eyebrow'),
      sel('highlight', 'Highlighted words', [['color', 'Theme colour'], ['gold', 'Gold'], ['gradient', 'Gradient text'], ['underline', 'Marker underline'], ['italic', 'Italic serif']]),
      col('highlightColor', 'Highlight colour'),
      text('eyebrow', 'Eyebrow above heading', { placeholder: 'e.g. WHY AL KHADIM' }),
      sel('eyebrowStyle', 'Eyebrow style', [['line', 'With line'], ['pill', 'Pill'], ['plain', 'Plain']]),
      tog('gradientText', 'Gradient fill for the whole heading'),
      col('color', 'Text colour'),
    ],
    defaults: { text: 'Build something *remarkable*', tag: 'h2', size: 'xl', align: 'left', href: '', highlight: 'color', highlightColor: '', eyebrow: '', eyebrowStyle: 'line', gradientText: false, color: '' },
    links: ['href'],
  },
  {
    type: 'text', label: 'Text', icon: 'Pilcrow', category: 'Basic', description: 'Rich text with formatting, lists and links', keywords: 'paragraph rich editor content',
    fields: [
      rich('html', 'Content'),
      sel('size', 'Text size', [['lg', 'Lead'], ['md', 'Body'], ['sm', 'Small']]),
      align(),
      sel('columns', 'Text columns', [['1', 'One'], ['2', 'Two'], ['3', 'Three']]),
      tog('dropCap', 'Drop cap on first letter'),
      col('color', 'Text colour'), col('linkColor', 'Link colour'),
    ],
    defaults: { html: '<p>Write something meaningful here. Select text to make it <strong>bold</strong>, <em>italic</em> or a <a href="/contact">link</a>.</p>', size: 'md', align: 'left', columns: '1', dropCap: false, color: '', linkColor: '' },
    html: ['html'],
  },
  {
    type: 'buttons', label: 'Buttons', icon: 'RectangleHorizontal', category: 'Basic', description: 'One or more call-to-action buttons', keywords: 'button cta link',
    fields: [
      list('items', 'Buttons', buttonItem, { label: 'Learn more', href: '/contact', variant: 'outline', iconPos: 'right' }, 'label', { max: 6 }),
      sel('size', 'Size', SIZES), align(),
      sel('shape', 'Shape', [['theme', 'Theme default'], ['square', 'Square'], ['rounded', 'Rounded'], ['pill', 'Pill']]),
      tog('fullWidth', 'Full width'), tog('stackMobile', 'Stack on mobile'),
      sel('hoverFx', 'Hover effect', [['lift', 'Lift'], ['grow', 'Grow'], ['shine', 'Shine sweep'], ['arrow', 'Nudge icon'], ['none', 'None']]),
    ],
    defaults: { items: [{ label: 'Get started', href: '/enquiry', variant: 'primary', icon: 'ArrowRight', iconPos: 'right' }, { label: 'Talk to us', href: '/contact', variant: 'outline', iconPos: 'right' }], size: 'md', align: 'left', shape: 'theme', fullWidth: false, stackMobile: true, hoverFx: 'lift' },
    links: ['items.href'],
  },
  {
    type: 'icon', label: 'Icon', icon: 'Sparkles', category: 'Basic', description: 'A single icon with optional shape',
    fields: [icon('icon'), range('size', 'Size', 12, 160, { unit: 'px' }), sel('shape', 'Shape', SHAPES), sel('look', 'Look', [['soft', 'Soft tint'], ['solid', 'Solid'], ['outline', 'Outline']], show('shape', 'circle', 'rounded', 'square')), col('color', 'Icon colour'), col('bg', 'Shape colour', show('shape', 'circle', 'rounded', 'square')), align(), link('href', 'Link')],
    defaults: { icon: 'Sparkles', size: 40, shape: 'circle', look: 'soft', color: '', bg: '', align: 'left', href: '' },
    links: ['href'],
  },
  {
    type: 'divider', label: 'Divider', icon: 'Minus', category: 'Basic', description: 'A line to separate content',
    fields: [sel('style', 'Line style', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double'], ['gradient', 'Gradient fade'], ['flag', 'UAE flag'], ['ornament', 'Arabesque ornament']]), range('weight', 'Thickness', 1, 12, { unit: 'px' }), range('width', 'Width', 5, 100, { unit: '%' }), col('color', 'Colour'), align(), text('label', 'Text in the middle (optional)'), icon('icon', 'Icon in the middle (optional)')],
    defaults: { style: 'solid', weight: 1, width: 100, color: '', align: 'center', label: '', icon: '' },
    style: { desktop: { pt: '8', pb: '8' } },
  },
  {
    type: 'spacer', label: 'Spacer', icon: 'MoveVertical', category: 'Basic', description: 'Empty vertical space (set per device in Style → Size)',
    fields: [h('Height', 'Set the height per device in Style → Size → Height')],
    defaults: {},
    style: { desktop: { height: '48' }, mobile: { height: '28' } },
  },
  {
    type: 'iconList', label: 'Icon list', icon: 'ListChecks', category: 'Basic', description: 'Bullet list with icons', keywords: 'checklist bullet features',
    fields: [
      list('items', 'Items', [text('text', 'Text'), icon('icon', 'Icon (empty uses the default)'), link('href', 'Link (optional)')], { text: 'New point' }, 'text', { max: 40 }),
      icon('icon', 'Default icon'), col('iconColor', 'Icon colour'), col('color', 'Text colour'),
      sel('layout', 'Layout', [['vertical', 'Vertical'], ['inline', 'Inline'], ['grid2', 'Two columns']]),
      range('gap', 'Space between items', 0, 40, { unit: 'px' }), range('iconSize', 'Icon size', 10, 40, { unit: 'px' }),
      tog('divider', 'Divider between items'), sel('iconStyle', 'Icon style', [['plain', 'Plain'], ['circle', 'In circle']]),
    ],
    defaults: { items: [{ text: 'Licensed by MOHRE across all seven emirates' }, { text: 'Visa, medical & Emirates ID handled end-to-end' }, { text: 'Replacement guarantee on every placement' }], icon: 'CheckCircle2', iconColor: '', color: '', layout: 'vertical', gap: 12, iconSize: 18, divider: false, iconStyle: 'plain' },
    links: ['items.href'],
  },
  {
    type: 'quote', label: 'Blockquote', icon: 'Quote', category: 'Basic', description: 'A pull quote with attribution',
    fields: [area('quote', 'Quote'), text('cite', 'Name'), text('role', 'Role / company'), img('photo', 'Photo'), sel('style', 'Style', [['bar', 'Side bar'], ['big', 'Large quote mark'], ['card', 'Card']]), align()],
    defaults: { quote: 'Al Khadim understood exactly what we needed and delivered a fully compliant team within weeks.', cite: 'Operations Director', role: 'Leading hospitality group, Dubai', photo: '', style: 'big', align: 'left' },
  },
  {
    type: 'alert', label: 'Notice box', icon: 'Info', category: 'Basic', description: 'Info, success, warning or error message',
    fields: [sel('kind', 'Type', [['info', 'Info'], ['success', 'Success'], ['warning', 'Warning'], ['error', 'Error'], ['brand', 'Brand']]), text('title', 'Title'), area('text', 'Message'), tog('dismissible', 'Can be dismissed'), tog('showIcon', 'Show icon')],
    defaults: { kind: 'info', title: 'Good to know', text: 'Visa processing typically takes 10–15 working days.', dismissible: false, showIcon: true },
  },

  /* Media */
  {
    type: 'image', label: 'Image', icon: 'Image', category: 'Media', description: 'A picture with caption, link, lightbox & effects', keywords: 'photo picture',
    fields: [
      img('src', 'Image'), text('alt', 'Alt text (for accessibility & SEO)'), text('caption', 'Caption'),
      sel('aspect', 'Aspect ratio', ASPECTS), sel('fit', 'Fit', [['cover', 'Fill (crop)'], ['contain', 'Fit inside']], show('aspect', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4', '2/3')),
      text('focus', 'Focal point', { placeholder: 'center / 50% 30%', ...show('aspect', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4', '2/3') }),
      align(), link('href', 'Link'), tog('lightbox', 'Open full size on click (lightbox)'),
      sel('hoverFx', 'Hover effect', [['none', 'None'], ['zoom', 'Zoom'], ['lift', 'Lift'], ['grayscale', 'Colour on hover'], ['tilt', 'Tilt'], ['shine', 'Shine']]),
      sel('frame', 'Frame', [['none', 'None'], ['offset', 'Offset border'], ['gold', 'Gold offset'], ['polaroid', 'Polaroid'], ['arch', 'Arch top (Arabic)']]),
      tog('lazy', 'Lazy load'),
    ],
    defaults: { src: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1400&q=80', alt: 'Dubai skyline', caption: '', aspect: 'auto', fit: 'cover', focus: '', align: 'center', href: '', lightbox: false, hoverFx: 'none', frame: 'none', lazy: true },
    style: { desktop: { radius: '16', overflow: 'hidden' } },
    links: ['href', 'src'],
  },
  {
    type: 'video', label: 'Video', icon: 'PlayCircle', category: 'Media', description: 'YouTube, Vimeo or an uploaded MP4', keywords: 'youtube vimeo mp4 embed',
    fields: [
      text('url', 'Video URL', { placeholder: 'https://www.youtube.com/watch?v=…' }), img('poster', 'Cover image (shows a play button)'),
      sel('aspect', 'Aspect ratio', [['16/9', '16:9'], ['4/3', '4:3'], ['1/1', '1:1'], ['9/16', 'Vertical 9:16'], ['21/9', '21:9']]),
      tog('autoplay', 'Autoplay (muted)'), tog('loop', 'Loop'), tog('controls', 'Show controls'), tog('lightbox', 'Play in a popup'),
    ],
    defaults: { url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4', poster: '', aspect: '16/9', autoplay: false, loop: false, controls: true, lightbox: false },
    style: { desktop: { radius: '16', overflow: 'hidden' } },
    links: ['url', 'poster'],
  },
  {
    type: 'gallery', label: 'Gallery', icon: 'LayoutGrid', category: 'Media', description: 'Image grid or masonry with lightbox', keywords: 'photos grid masonry',
    fields: [
      list('images', 'Images', [img('src', 'Image'), text('alt', 'Alt text'), text('caption', 'Caption'), link('href', 'Link (optional)')], { src: '' }, 'caption', { max: 60 }),
      sel('layout', 'Layout', [['grid', 'Grid'], ['masonry', 'Masonry'], ['justified', 'Mosaic (first image large)']]),
      ...responsiveCols('cols'),
      range('gap', 'Gap', 0, 48, { unit: 'px' }), sel('aspect', 'Tile shape', ASPECTS, show('layout', 'grid')),
      tog('lightbox', 'Lightbox'), sel('hoverFx', 'Hover effect', [['zoom', 'Zoom'], ['caption', 'Caption reveal'], ['grayscale', 'Colour on hover'], ['none', 'None']]),
      range('radius', 'Corner radius', 0, 40, { unit: 'px' }),
    ],
    defaults: {
      images: [
        { src: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=900&q=80', alt: 'Dubai Marina', caption: 'Dubai Marina' },
        { src: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=900&q=80', alt: 'Abu Dhabi', caption: 'Abu Dhabi' },
        { src: 'https://images.unsplash.com/photo-1526495124232-a04e1849168c?w=900&q=80', alt: 'Desert', caption: 'Desert' },
        { src: 'https://images.unsplash.com/photo-1582672060674-bc2bd808a8b5?w=900&q=80', alt: 'Burj Khalifa', caption: 'Downtown' },
        { src: 'https://images.unsplash.com/photo-1546412414-e1885259563a?w=900&q=80', alt: 'Sheikh Zayed Mosque', caption: 'Heritage' },
        { src: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=900&q=80', alt: 'Business', caption: 'Business Bay' },
      ],
      layout: 'grid', cols: '3', colsTablet: '2', colsMobile: '2', gap: 12, aspect: '4/3', lightbox: true, hoverFx: 'zoom', radius: 14,
    },
    links: ['images.src', 'images.href'],
  },
  {
    type: 'carousel', label: 'Slider', icon: 'GalleryHorizontal', category: 'Media', description: 'Slides with images, text and buttons', keywords: 'carousel slideshow banner',
    fields: [
      list('slides', 'Slides', [img('image', 'Image'), text('eyebrow', 'Eyebrow'), area('title', 'Title'), area('text', 'Text'), text('btnLabel', 'Button text'), link('btnHref', 'Button link')], { title: 'New slide' }, 'title', { max: 20 }),
      sel('effect', 'Transition', [['slide', 'Slide'], ['fade', 'Fade'], ['zoom', 'Ken Burns fade']]),
      range('height', 'Height', 200, 900, { unit: 'px' }), range('mobileHeight', 'Height on mobile', 180, 800, { unit: 'px' }),
      tog('autoplay', 'Autoplay'), range('interval', 'Seconds per slide', 2, 15, { unit: 's' }),
      tog('arrows', 'Arrows'), tog('dots', 'Dots'), tog('pauseOnHover', 'Pause on hover'),
      range('overlay', 'Darken images', 0, 90, { unit: '%' }), sel('textAlign', 'Text position', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]),
      sel('perView', 'Slides visible (desktop)', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]),
    ],
    defaults: {
      slides: [
        { image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&q=80', eyebrow: 'Dubai', title: 'Talent for the UAE’s fastest-growing businesses', text: 'Recruitment, outsourcing and PRO services under one roof.', btnLabel: 'Hire talent', btnHref: '/enquiry' },
        { image: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=1600&q=80', eyebrow: 'Abu Dhabi', title: 'Compliant, fast and fully managed', text: 'Visa, medical and Emirates ID handled for you.', btnLabel: 'Our services', btnHref: '/services' },
      ],
      effect: 'fade', height: 520, mobileHeight: 420, autoplay: true, interval: 5, arrows: true, dots: true, pauseOnHover: true, overlay: 45, textAlign: 'left', perView: '1',
    },
    style: { desktop: { radius: '20', overflow: 'hidden' } },
    links: ['slides.image', 'slides.btnHref'],
  },
  {
    type: 'logos', label: 'Logo strip', icon: 'Building2', category: 'Media', description: 'Client or partner logos, grid or scrolling marquee', keywords: 'clients partners brands marquee',
    fields: [
      list('logos', 'Logos', [img('src', 'Logo'), text('alt', 'Name'), link('href', 'Link (optional)')], { src: '', alt: 'Partner' }, 'alt', { max: 40 }),
      sel('layout', 'Layout', [['marquee', 'Scrolling marquee'], ['grid', 'Grid']]),
      ...responsiveCols('cols'),
      range('height', 'Logo height', 16, 120, { unit: 'px' }), range('speed', 'Marquee speed (seconds per loop)', 10, 120, { unit: 's', ...show('layout', 'marquee') }),
      tog('grayscale', 'Greyscale until hovered'), tog('boxed', 'Logos in cards'),
    ],
    defaults: {
      logos: ['Emaar', 'Etisalat', 'Majid Al Futtaim', 'DP World', 'Emirates NBD', 'ADNOC', 'Aldar', 'Jumeirah'].map(n => ({ src: '', alt: n })),
      layout: 'marquee', cols: '6', colsTablet: '4', colsMobile: '2', height: 36, speed: 40, grayscale: true, boxed: false,
    },
    links: ['logos.src', 'logos.href'],
  },
  {
    type: 'map', label: 'Map', icon: 'MapPin', category: 'Media', description: 'Google Map for an address or place', keywords: 'location google address',
    fields: [text('query', 'Address or place'), range('zoom', 'Zoom', 3, 20), range('height', 'Height', 160, 800, { unit: 'px' }), tog('grayscale', 'Muted colours')],
    defaults: { query: 'Sharjah Media City, Sharjah, UAE', zoom: 14, height: 380, grayscale: false },
    style: { desktop: { radius: '16', overflow: 'hidden' } },
  },

  /* Content */
  {
    type: 'iconBox', label: 'Icon box', icon: 'BoxSelect', category: 'Content', description: 'Icon, title, text and link — feature cards', keywords: 'feature service card',
    fields: [
      icon('icon'), text('title', 'Title'), area('text', 'Text'), text('linkLabel', 'Link text'), link('href', 'Link'),
      sel('layout', 'Icon position', [['top', 'Top'], ['left', 'Left'], ['inline', 'Beside title']]), align('align', 'Alignment', show('layout', 'top')),
      sel('card', 'Card style', CARD_STYLES), sel('shape', 'Icon shape', SHAPES), sel('look', 'Icon look', [['soft', 'Soft tint'], ['solid', 'Solid'], ['outline', 'Outline'], ['gradient', 'Gradient']]),
      range('iconSize', 'Icon size', 14, 80, { unit: 'px' }), col('iconColor', 'Icon colour'), col('iconBg', 'Icon background'),
      sel('titleTag', 'Title tag', [['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['p', 'Paragraph']]),
      sel('hoverFx', 'Hover effect', [['lift', 'Lift'], ['border', 'Accent border'], ['fill', 'Fill with colour'], ['none', 'None']]),
      text('badge', 'Corner badge (optional)'), text('number', 'Big number (optional)', { placeholder: '01' }),
    ],
    defaults: { icon: 'ShieldCheck', title: 'Fully compliant', text: 'MOHRE-licensed processes and transparent contracts for every placement.', linkLabel: '', href: '', layout: 'top', align: 'left', card: 'bordered', shape: 'rounded', look: 'soft', iconSize: 24, iconColor: '', iconBg: '', titleTag: 'h3', hoverFx: 'lift', badge: '', number: '' },
    links: ['href'],
  },
  {
    type: 'imageBox', label: 'Image card', icon: 'LayoutPanelLeft', category: 'Content', description: 'Image with title, text and button', keywords: 'card post service',
    fields: [
      img('image', 'Image'), text('tag', 'Tag / category'), text('title', 'Title'), area('text', 'Text'), text('btnLabel', 'Button text'), link('href', 'Link'),
      sel('layout', 'Layout', [['stacked', 'Image on top'], ['overlay', 'Text over image'], ['side', 'Image beside text'], ['reveal', 'Text reveals on hover']]),
      sel('aspect', 'Image shape', ASPECTS), sel('card', 'Card style', CARD_STYLES, show('layout', 'stacked', 'side')),
      tog('zoom', 'Zoom image on hover'),
    ],
    defaults: { image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1000&q=80', tag: 'Recruitment', title: 'Executive search', text: 'Senior and specialist hires sourced across the GCC and beyond.', btnLabel: 'Learn more', href: '/services', layout: 'stacked', aspect: '4/3', card: 'shadow', zoom: true },
    links: ['image', 'href'],
  },
  {
    type: 'counter', label: 'Counter', icon: 'Hash', category: 'Content', description: 'Animated number with label', keywords: 'stat number statistic',
    fields: [text('number', 'Number', { placeholder: '1800' }), text('prefix', 'Prefix'), text('suffix', 'Suffix', { placeholder: '+' }), text('label', 'Label'), area('text', 'Description'), icon('icon', 'Icon (optional)'), range('duration', 'Count-up duration', 0, 6, { unit: 's' }), tog('separator', 'Thousands separator'), align(), col('color', 'Number colour'), sel('size', 'Size', [['md', 'Medium'], ['lg', 'Large'], ['xl', 'Extra large']])],
    defaults: { number: '1800', prefix: '', suffix: '+', label: 'Candidates placed', text: '', icon: '', duration: 2, separator: true, align: 'center', color: '', size: 'lg' },
  },
  {
    type: 'progress', label: 'Progress bars', icon: 'BarChartHorizontal', category: 'Content', description: 'Skill or progress bars',
    fields: [list('items', 'Bars', [text('label', 'Label'), range('value', 'Percent', 0, 100, { unit: '%' }), col('color', 'Colour')], { label: 'New bar', value: 70 }, 'label', { max: 20 }), range('height', 'Bar height', 2, 30, { unit: 'px' }), tog('showValue', 'Show percentage'), tog('striped', 'Striped'), tog('rounded', 'Rounded')],
    defaults: { items: [{ label: 'Hospitality', value: 92 }, { label: 'Construction', value: 84 }, { label: 'Healthcare', value: 76 }], height: 8, showValue: true, striped: false, rounded: true },
  },
  {
    type: 'steps', label: 'Steps / timeline', icon: 'Milestone', category: 'Content', description: 'Process steps or a timeline', keywords: 'process timeline history',
    fields: [
      list('items', 'Steps', [text('title', 'Title'), area('text', 'Text'), icon('icon', 'Icon'), text('date', 'Date / label')], { title: 'New step' }, 'title', { max: 20 }),
      sel('layout', 'Layout', [['horizontal', 'Horizontal'], ['vertical', 'Vertical timeline'], ['alternating', 'Alternating timeline'], ['cards', 'Numbered cards']]),
      sel('marker', 'Marker', [['number', 'Numbers'], ['icon', 'Icons'], ['dot', 'Dots']]), col('accent', 'Accent colour'),
    ],
    defaults: { items: [{ title: 'Understand', text: 'We map roles, skills and timelines with your team.', icon: 'Search', date: 'Day 1' }, { title: 'Source', text: 'Screened shortlists from our GCC-wide talent pool.', icon: 'Users', date: 'Week 1' }, { title: 'Deploy', text: 'Visas, medicals and onboarding handled end-to-end.', icon: 'Rocket', date: 'Week 3' }], layout: 'horizontal', marker: 'number', accent: '' },
  },
  {
    type: 'team', label: 'Team', icon: 'Users', category: 'Content', description: 'Team members with photos and socials', keywords: 'people staff leadership',
    fields: [
      list('members', 'Members', [img('photo', 'Photo'), text('name', 'Name'), text('role', 'Role'), area('bio', 'Short bio'), link('linkedin', 'LinkedIn'), text('email', 'Email')], { name: 'New member' }, 'name', { max: 40 }),
      ...responsiveCols('cols'), sel('style', 'Style', [['card', 'Card'], ['overlay', 'Overlay on photo'], ['circle', 'Circle photo'], ['minimal', 'Minimal']]), sel('aspect', 'Photo shape', ASPECTS, show('style', 'card', 'overlay', 'minimal')),
    ],
    defaults: { members: [{ photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80', name: 'Ahmed Al Mansoori', role: 'Managing Director', bio: '', linkedin: '#' }, { photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80', name: 'Sara Khan', role: 'Head of Recruitment', bio: '' }, { photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80', name: 'Rahul Menon', role: 'Client Partner', bio: '' }], cols: '3', colsTablet: '2', colsMobile: '1', style: 'card', aspect: '3/4' },
    links: ['members.photo', 'members.linkedin'],
  },
  {
    type: 'testimonials', label: 'Testimonials', icon: 'MessageSquareQuote', category: 'Content', description: 'Client reviews as grid or slider', keywords: 'reviews quotes feedback',
    fields: [
      list('items', 'Testimonials', [area('quote', 'Quote'), text('name', 'Name'), text('role', 'Role / company'), img('photo', 'Photo'), range('rating', 'Stars', 0, 5)], { quote: 'Great experience.', name: 'Client', rating: 5 }, 'name', { max: 30 }),
      sel('layout', 'Layout', [['slider', 'Slider'], ['grid', 'Grid'], ['masonry', 'Masonry']]), ...responsiveCols('cols'),
      sel('style', 'Card style', [['card', 'White card'], ['bordered', 'Bordered'], ['dark', 'Dark'], ['minimal', 'Minimal']]), tog('autoplay', 'Autoplay slider', show('layout', 'slider')),
    ],
    defaults: { items: [{ quote: 'Al Khadim filled 40 hospitality roles for our opening in under a month — every one compliant and ready day one.', name: 'Fatima R.', role: 'HR Director, Dubai', rating: 5 }, { quote: 'Professional, transparent and quick. Their PRO team took the visa stress completely off our plate.', name: 'James W.', role: 'COO, Abu Dhabi', rating: 5 }, { quote: 'The best recruitment partner we have worked with in the region.', name: 'Priya S.', role: 'Founder, Sharjah', rating: 5 }], layout: 'grid', cols: '3', colsTablet: '2', colsMobile: '1', style: 'card', autoplay: true },
    links: ['items.photo'],
  },
  {
    type: 'pricing', label: 'Pricing table', icon: 'BadgeDollarSign', category: 'Content', description: 'Plans with features and highlighted option', keywords: 'plans packages price',
    fields: [
      list('plans', 'Plans', [text('name', 'Name'), text('price', 'Price'), text('period', 'Period', { placeholder: '/month' }), area('description', 'Description'), area('features', 'Features', { hint: 'One per line. Start a line with "-" for a feature not included.' }), text('btnLabel', 'Button text'), link('btnHref', 'Button link'), tog('featured', 'Highlight this plan'), text('badge', 'Badge text')], { name: 'Plan', price: '999' }, 'name', { max: 6 }),
      text('currency', 'Currency', { placeholder: 'AED' }), ...responsiveCols('cols'), sel('style', 'Style', [['cards', 'Cards'], ['flat', 'Flat columns']]),
    ],
    defaults: { plans: [{ name: 'Starter', price: '2,500', period: '/hire', description: 'For occasional hiring needs.', features: 'Screened shortlist\nInterview coordination\n30-day replacement\n-Dedicated manager', btnLabel: 'Get started', btnHref: '/enquiry' }, { name: 'Business', price: '7,900', period: '/month', description: 'Ongoing recruitment for growing teams.', features: 'Up to 5 hires a month\nDedicated account manager\nVisa & PRO support\n90-day replacement', btnLabel: 'Choose Business', btnHref: '/enquiry', featured: true, badge: 'Most popular' }, { name: 'Enterprise', price: 'Custom', period: '', description: 'Volume hiring & full outsourcing.', features: 'Unlimited roles\nOn-site team\nPayroll & WPS\nSLA-backed delivery', btnLabel: 'Talk to sales', btnHref: '/contact' }], currency: 'AED', cols: '3', colsTablet: '3', colsMobile: '1', style: 'cards' },
    links: ['plans.btnHref'],
  },
  {
    type: 'table', label: 'Table', icon: 'Table', category: 'Content', description: 'Data or comparison table',
    fields: [area('data', 'Rows', { hint: 'One row per line, cells separated by |. The first row is the header. Use ✓ and ✗ for ticks.', wide: true }), tog('striped', 'Striped rows'), tog('bordered', 'Borders'), tog('firstColBold', 'Bold first column'), sel('headerStyle', 'Header', [['primary', 'Brand colour'], ['dark', 'Dark'], ['light', 'Light']])],
    defaults: { data: 'Service | Starter | Business | Enterprise\nShortlist in | 7 days | 5 days | 72 hours\nVisa & PRO | ✗ | ✓ | ✓\nDedicated manager | ✗ | ✓ | ✓', striped: true, bordered: false, firstColBold: true, headerStyle: 'primary' },
  },
  {
    type: 'rating', label: 'Star rating', icon: 'Star', category: 'Content', description: 'Stars with an optional label',
    fields: [range('value', 'Rating', 0, 10, { step: 0.5 }), range('max', 'Out of', 3, 10), range('size', 'Star size', 10, 60, { unit: 'px' }), col('color', 'Star colour'), text('label', 'Label', { placeholder: '4.9 from 320 reviews' }), align()],
    defaults: { value: 5, max: 5, size: 20, color: '', label: 'Rated 4.9/5 by our clients', align: 'left' },
  },

  /* Interactive */
  {
    type: 'accordion', label: 'Accordion / FAQ', icon: 'ListCollapse', category: 'Interactive', description: 'Collapsible questions & answers', keywords: 'faq toggle collapse',
    fields: [
      list('items', 'Items', [text('title', 'Title'), rich('content', 'Content')], { title: 'New question', content: '<p>Answer…</p>' }, 'title', { max: 40 }),
      sel('style', 'Style', [['separated', 'Separated cards'], ['bordered', 'Bordered'], ['minimal', 'Minimal lines'], ['filled', 'Filled']]),
      sel('iconType', 'Toggle icon', [['plus', 'Plus / minus'], ['chevron', 'Chevron'], ['arrow', 'Arrow']]), sel('iconPos', 'Icon position', [['right', 'Right'], ['left', 'Left']]),
      tog('firstOpen', 'First item open'), tog('multiple', 'Allow several open'), tog('faqSchema', 'Add FAQ structured data (SEO)'),
      col('activeColor', 'Active colour'),
    ],
    defaults: { items: [{ title: 'How long does recruitment take?', content: '<p>Most roles are shortlisted within 5–7 working days.</p>' }, { title: 'Do you handle visas and onboarding?', content: '<p>Yes — our PRO team manages visas, medicals and Emirates ID.</p>' }, { title: 'Which emirates do you cover?', content: '<p>All seven emirates, plus sourcing across the GCC, India and beyond.</p>' }], style: 'separated', iconType: 'plus', iconPos: 'right', firstOpen: true, multiple: false, faqSchema: true, activeColor: '' },
    html: ['items.content'],
  },
  {
    type: 'tabs', label: 'Tabs', icon: 'PanelTop', category: 'Interactive', description: 'Content in switchable tabs',
    fields: [
      list('items', 'Tabs', [text('title', 'Title'), icon('icon', 'Icon (optional)'), rich('content', 'Content'), img('image', 'Image (optional)')], { title: 'New tab', content: '<p>Tab content…</p>' }, 'title', { max: 12 }),
      sel('layout', 'Layout', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]), sel('style', 'Style', [['underline', 'Underline'], ['pills', 'Pills'], ['boxed', 'Boxed'], ['segmented', 'Segmented']]), align('align', 'Tab alignment'),
      col('activeColor', 'Active colour'),
    ],
    defaults: { items: [{ title: 'Recruitment', icon: 'Users', content: '<p>Permanent, contract and executive hiring across every sector.</p>' }, { title: 'Outsourcing', icon: 'Briefcase', content: '<p>Fully managed staff on our visa and payroll.</p>' }, { title: 'PRO services', icon: 'Stamp', content: '<p>Government transactions handled quickly and correctly.</p>' }], layout: 'horizontal', style: 'pills', align: 'left', activeColor: '' },
    html: ['items.content'],
    links: ['items.image'],
  },
  {
    type: 'countdown', label: 'Countdown', icon: 'Timer', category: 'Interactive', description: 'Count down to a date & time', keywords: 'timer launch event',
    fields: [{ key: 'date', type: 'datetime', label: 'Ends at (local time)' }, sel('style', 'Style', [['boxes', 'Boxes'], ['plain', 'Plain'], ['circles', 'Circles']]), tog('showDays', 'Days'), tog('showHours', 'Hours'), tog('showMinutes', 'Minutes'), tog('showSeconds', 'Seconds'), text('expiredText', 'Text after it ends'), align(), col('color', 'Number colour'), col('boxBg', 'Box colour')],
    defaults: { date: '', style: 'boxes', showDays: true, showHours: true, showMinutes: true, showSeconds: true, expiredText: 'This offer has ended.', align: 'center', color: '', boxBg: '' },
  },
  {
    type: 'modalButton', label: 'Popup', icon: 'PictureInPicture2', category: 'Interactive', description: 'A button that opens a popup with content', keywords: 'modal lightbox dialog',
    fields: [text('label', 'Button text'), sel('variant', 'Button style', BTN_VARIANTS.filter(([v]) => v !== 'custom')), align(), text('title', 'Popup title'), rich('content', 'Popup content'), sel('width', 'Popup width', [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']])],
    defaults: { label: 'Read more', variant: 'primary', align: 'left', title: 'More details', content: '<p>Popup content goes here.</p>', width: 'md' },
    html: ['content'],
  },
  {
    type: 'ticker', label: 'Ticker', icon: 'MoveHorizontal', category: 'Interactive', description: 'Scrolling text banner', keywords: 'marquee scrolling announcement',
    fields: [area('items', 'Items', { hint: 'One per line' }), icon('separator', 'Separator icon'), range('speed', 'Seconds per loop', 8, 120, { unit: 's' }), sel('size', 'Size', [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'Huge outline']]), tog('reverse', 'Scroll right'), tog('pauseOnHover', 'Pause on hover')],
    defaults: { items: 'Recruitment\nOutsourcing\nPRO Services\nVisa Processing\nPayroll & WPS\nExecutive Search', separator: 'Sparkles', speed: 30, size: 'md', reverse: false, pauseOnHover: true },
    style: { desktop: { pt: '14', pb: '14' } },
  },
  {
    type: 'social', label: 'Social icons', icon: 'Share2', category: 'Interactive', description: 'Links to your social profiles',
    fields: [list('items', 'Profiles', [sel('network', 'Network', [['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X / Twitter'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['phone', 'Phone'], ['website', 'Website']]), link('url', 'URL')], { network: 'linkedin', url: '' }, 'network', { max: 12 }), sel('shape', 'Shape', [['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square'], ['plain', 'Plain']]), sel('colors', 'Colours', [['brand', 'Network colours'], ['theme', 'Theme'], ['mono', 'Monochrome'], ['outline', 'Outline']]), range('size', 'Size', 14, 48, { unit: 'px' }), align()],
    defaults: { items: [{ network: 'linkedin', url: 'https://linkedin.com' }, { network: 'instagram', url: 'https://instagram.com' }, { network: 'facebook', url: 'https://facebook.com' }, { network: 'whatsapp', url: 'https://wa.me/971' }], shape: 'circle', colors: 'theme', size: 18, align: 'left' },
    links: ['items.url'],
  },

  /* Marketing */
  {
    type: 'cta', label: 'Call to action', icon: 'Megaphone', category: 'Marketing', description: 'Title, text and buttons in a banner', keywords: 'banner promo',
    fields: [text('eyebrow', 'Eyebrow'), area('title', 'Title'), area('text', 'Text'), list('buttons', 'Buttons', buttonItem, { label: 'Contact us', href: '/contact', variant: 'white' }, 'label', { max: 3 }), sel('layout', 'Layout', [['inline', 'Text left, buttons right'], ['stacked', 'Centred & stacked']]), sel('look', 'Look', [['brand', 'Brand gradient'], ['dark', 'Dark'], ['gold', 'Gold'], ['light', 'Light sand'], ['image', 'Background image'], ['none', 'Transparent']]), img('image', 'Background image', show('look', 'image')), tog('pattern', 'Decorative pattern')],
    defaults: { eyebrow: 'Ready when you are', title: 'Let’s build your team in the UAE', text: 'Tell us what you need — we’ll come back within one business day.', buttons: [{ label: 'Hire talent', href: '/enquiry', variant: 'gold', icon: 'ArrowRight' }, { label: 'Call us', href: 'tel:+971', variant: 'white' }], layout: 'inline', look: 'brand', image: '', pattern: true },
    style: { desktop: { radius: '24', overflow: 'hidden' } },
    links: ['buttons.href', 'image'],
  },
  {
    type: 'hero', label: 'Hero banner', icon: 'PanelsTopLeft', category: 'Marketing', description: 'Large headline with background and buttons',
    fields: [text('eyebrow', 'Eyebrow'), area('title', 'Headline', { hint: 'Wrap words in *asterisks* to highlight them' }), area('text', 'Supporting text'), list('buttons', 'Buttons', buttonItem, { label: 'Learn more', href: '/services', variant: 'white' }, 'label', { max: 3 }), img('image', 'Background image'), img('imageMobile', 'Mobile background (optional)'), range('overlay', 'Darken image', 0, 95, { unit: '%' }), sel('overlayStyle', 'Overlay', [['flat', 'Flat'], ['left', 'Fade from left'], ['bottom', 'Fade from bottom'], ['brand', 'Brand tint']]), range('height', 'Min height', 280, 1000, { unit: 'px' }), sel('align', 'Text position', [['left', 'Left'], ['center', 'Centre']]), list('badges', 'Trust badges', [icon('icon', 'Icon'), text('text', 'Text')], { icon: 'BadgeCheck', text: 'Badge' }, 'text', { max: 4 }), tog('scrollHint', 'Scroll indicator')],
    defaults: { eyebrow: 'Al Khadim · UAE', title: 'The right people for *every* ambition', text: 'Recruitment, outsourcing and PRO services trusted by leading UAE organisations since 2017.', buttons: [{ label: 'Hire talent', href: '/enquiry', variant: 'gold', icon: 'ArrowRight' }, { label: 'Find a job', href: '/careers', variant: 'white' }], image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=2000&q=80', imageMobile: '', overlay: 60, overlayStyle: 'left', height: 620, align: 'left', badges: [{ icon: 'ShieldCheck', text: 'MOHRE licensed' }, { icon: 'Users', text: '1,800+ placed' }], scrollHint: false },
    style: { desktop: { radius: '0' } },
    links: ['buttons.href', 'image', 'imageMobile'],
  },
  {
    type: 'stats', label: 'Stats row', icon: 'BarChart3', category: 'Marketing', description: 'Several animated numbers in a row',
    fields: [list('items', 'Stats', [text('number', 'Number'), text('suffix', 'Suffix'), text('label', 'Label'), icon('icon', 'Icon (optional)')], { number: '10', suffix: '+', label: 'Label' }, 'label', { max: 8 }), ...responsiveCols('cols'), sel('style', 'Style', [['plain', 'Plain'], ['divided', 'Dividers'], ['cards', 'Cards'], ['dark', 'Dark band']]), align(), col('color', 'Number colour')],
    defaults: { items: [{ number: '2017', suffix: '', label: 'Founded' }, { number: '36', suffix: '+', label: 'Corporate clients' }, { number: '1800', suffix: '+', label: 'Candidates placed' }, { number: '7', suffix: '', label: 'Emirates served' }], cols: '4', colsTablet: '2', colsMobile: '2', style: 'divided', align: 'center', color: '' },
  },
  {
    type: 'featureGrid', label: 'Feature grid', icon: 'Grid3x3', category: 'Marketing', description: 'Many icon boxes in a responsive grid',
    fields: [list('items', 'Features', [icon('icon', 'Icon'), text('title', 'Title'), area('text', 'Text'), link('href', 'Link (optional)')], { icon: 'Sparkles', title: 'Feature' }, 'title', { max: 24 }), ...responsiveCols('cols'), sel('card', 'Card style', CARD_STYLES), sel('layout', 'Icon position', [['top', 'Top'], ['left', 'Left']]), sel('shape', 'Icon shape', SHAPES), align(), range('gap', 'Gap', 0, 48, { unit: 'px' }), tog('numbered', 'Number the items')],
    defaults: { items: [{ icon: 'Users', title: 'Recruitment', text: 'Permanent and contract hiring at every level.' }, { icon: 'Briefcase', title: 'Outsourcing', text: 'Managed staff on our visa and payroll.' }, { icon: 'Stamp', title: 'PRO services', text: 'Government paperwork handled for you.' }, { icon: 'Plane', title: 'Visa processing', text: 'Employment, family and visit visas.' }, { icon: 'Wallet', title: 'Payroll & WPS', text: 'Accurate, compliant monthly payroll.' }, { icon: 'GraduationCap', title: 'Training', text: 'Upskilling and induction programmes.' }], cols: '3', colsTablet: '2', colsMobile: '1', card: 'bordered', layout: 'top', shape: 'rounded', align: 'left', gap: 20, numbered: false },
    links: ['items.href'],
  },

  /* Forms & data */
  {
    type: 'form', label: 'Form', icon: 'ClipboardList', category: 'Forms & data', description: 'Contact / enquiry form — submissions arrive in CRM → Enquiries', keywords: 'contact enquiry lead',
    fields: [
      text('title', 'Form title (optional)'), area('intro', 'Intro text (optional)'),
      list('fields', 'Fields', [
        text('label', 'Label'),
        sel('map', 'Saves to', [['contactName', 'Contact name'], ['email', 'Email'], ['phone', 'Phone'], ['companyName', 'Company'], ['designation', 'Designation'], ['service', 'Service'], ['message', 'Message'], ['custom', 'Other (added to message)']]),
        sel('type', 'Input type', [['text', 'Text'], ['email', 'Email'], ['tel', 'Phone'], ['textarea', 'Paragraph'], ['select', 'Dropdown'], ['radio', 'Choice buttons'], ['checkbox', 'Checkbox'], ['date', 'Date'], ['number', 'Number']]),
        text('placeholder', 'Placeholder'), area('options', 'Options (one per line)', show('type', 'select', 'radio')),
        tog('required', 'Required'), sel('width', 'Width', [['full', 'Full'], ['half', 'Half']]),
      ], { label: 'New field', map: 'custom', type: 'text', width: 'full' }, 'label', { max: 20 }),
      h('Submit'),
      text('submitLabel', 'Button text'), sel('submitVariant', 'Button style', BTN_VARIANTS.filter(([v]) => v !== 'custom')), tog('submitFull', 'Full-width button'),
      text('successTitle', 'Success title'), area('successText', 'Success message'), link('redirect', 'Redirect after submit (optional)'),
      text('consent', 'Consent checkbox text (optional)', { placeholder: 'I agree to be contacted about my enquiry.' }),
      h('Design'), sel('look', 'Field style', [['outlined', 'Outlined'], ['filled', 'Filled'], ['underline', 'Underline'], ['dark', 'On dark background']]), sel('labels', 'Labels', [['above', 'Above fields'], ['floating', 'Inside (placeholder only)']]), sel('card', 'Container', [['none', 'None'], ['card', 'White card'], ['glass', 'Glass']]),
    ],
    defaults: {
      title: 'Send us an enquiry', intro: 'We reply within one business day.',
      fields: [
        { label: 'Full name', map: 'contactName', type: 'text', required: true, width: 'half' },
        { label: 'Company', map: 'companyName', type: 'text', required: true, width: 'half' },
        { label: 'Email', map: 'email', type: 'email', required: true, width: 'half' },
        { label: 'Phone', map: 'phone', type: 'tel', required: true, width: 'half' },
        { label: 'Service', map: 'service', type: 'select', options: 'Recruitment\nOutsourcing\nPRO services\nVisa processing\nOther', width: 'full' },
        { label: 'How can we help?', map: 'message', type: 'textarea', width: 'full' },
      ],
      submitLabel: 'Send enquiry', submitVariant: 'primary', submitFull: false, successTitle: 'Thank you!', successText: 'Your enquiry has been received. Our team will be in touch shortly.', redirect: '', consent: '', look: 'outlined', labels: 'above', card: 'card',
    },
    links: ['redirect'],
  },
  {
    type: 'jobs', label: 'Live jobs', icon: 'Briefcase', category: 'Forms & data', description: 'Latest open jobs from the ATS', keywords: 'careers vacancies dynamic',
    fields: [range('limit', 'Number of jobs', 1, 24), ...responsiveCols('cols'), text('ctaLabel', 'Button text'), link('ctaHref', 'Button link'), text('emptyText', 'Text when there are no jobs')],
    defaults: { limit: 6, cols: '3', colsTablet: '2', colsMobile: '1', ctaLabel: 'View all jobs', ctaHref: '/careers', emptyText: 'New roles are added every week — check back soon.' },
    links: ['ctaHref'],
  },
  {
    type: 'html', label: 'Custom HTML', icon: 'Code2', category: 'Forms & data', description: 'Embed code or hand-written HTML (scripts are removed)', keywords: 'embed iframe code',
    fields: [{ key: 'code', type: 'code', label: 'HTML', hint: 'Scripts and event handlers are stripped when saved. iframes (YouTube, Google Forms, Calendly…) are allowed.', wide: true }],
    defaults: { code: '<div style="padding:24px;border:1px dashed #cbd5e1;border-radius:12px;text-align:center">Custom HTML</div>' },
    html: ['code'],
  },
];

export const ELEMENT_BY_TYPE: Record<string, ElementDef> = Object.fromEntries(
  [SECTION_DEF, COLUMN_DEF, ...ELEMENTS].map(d => [d.type, d]),
);

export const CATEGORIES: ElementCategory[] = ['Basic', 'Media', 'Content', 'Interactive', 'Marketing', 'Forms & data'];

/** Entrance animations (keys map to keyframes in the renderer's stylesheet). */
export const ANIMATIONS: [string, string][] = [
  ['', 'None'], ['fadeIn', 'Fade in'], ['fadeUp', 'Fade up'], ['fadeDown', 'Fade down'], ['fadeLeft', 'Fade from left'],
  ['fadeRight', 'Fade from right'], ['zoomIn', 'Zoom in'], ['zoomOut', 'Zoom out'], ['flipUp', 'Flip up'],
  ['slideUp', 'Slide up'], ['blurIn', 'Blur in'], ['rotateIn', 'Rotate in'], ['bounceIn', 'Bounce in'], ['revealRight', 'Wipe reveal'],
];

/** Column layouts offered when adding a section (percent widths). */
export const LAYOUTS: number[][] = [
  [100], [50, 50], [33.333, 33.333, 33.334], [25, 25, 25, 25],
  [66.666, 33.334], [33.334, 66.666], [60, 40], [40, 60], [75, 25], [25, 75],
  [25, 50, 25], [20, 20, 20, 20, 20], [16.666, 16.666, 16.667, 16.667, 16.667, 16.667],
];
