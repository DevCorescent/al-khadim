/**
 * Turns an email design (or a bare HTML fragment) into a complete, email-safe
 * HTML document in the brand theme: table layout, inline styles, Outlook
 * conditionals, a hidden preheader and a mobile stylesheet. Also produces the
 * plain-text alternative that every message is sent with.
 *
 * {{mergeTags}} pass through untouched; they are filled in at send time.
 */
import type { EmailTheme } from './theme';
import { normalizeDesign, type EmailBlock, type EmailDesign } from './blocks';

export interface RenderEmailOptions {
  /** Origin used to make root-relative image URLs absolute (mail clients need full URLs). */
  assetBase?: string;
  subject?: string;
  preheader?: string;
  /** Builder preview only: tag each block so clicks in the preview can select it. */
  annotate?: boolean;
}

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function abs(url: string, base?: string) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(https?:|data:|\{\{)/i.test(u)) return u;
  if (!base) return u;
  return `${base.replace(/\/+$/, '')}/${u.replace(/^\/+/, '')}`;
}

function safeUrl(url: string) {
  const u = String(url || '').trim();
  if (u.startsWith('{{') || /^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith('/')) return u;
  return u ? `https://${u.replace(/^\/+/, '')}` : '#';
}

/** Small, safe markdown subset → inline-styled HTML (text is escaped first). */
export function mdToHtml(src: string, t: EmailTheme, opts: { color?: string; size?: number; align?: string } = {}): string {
  const color = opts.color || t.text;
  const size = opts.size || 15;
  const pStyle = `margin:0 0 14px;font-family:${t.fontFamily};font-size:${size}px;line-height:1.65;color:${color};text-align:${opts.align || 'left'}`;
  const inline = (s: string) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\b_(.+?)_\b/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_m, label, url) =>
      `<a href="${esc(safeUrl(url.replace(/&amp;/g, '&')))}" style="color:${t.primary};text-decoration:underline;font-weight:600">${label}</a>`);
  const blocks = String(src || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-•]\s+/.test(l))) {
      return `<ul style="margin:0 0 14px;padding-left:22px;font-family:${t.fontFamily};font-size:${size}px;line-height:1.65;color:${color}">${
        lines.map(l => `<li style="margin:0 0 6px">${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p style="${pStyle}">${lines.map(inline).join('<br/>')}</p>`;
  }).join('');
}

const TONES: Record<string, { bg: string; border: string; title: string }> = {
  info: { bg: '#EEF5FB', border: '#3B82C4', title: '#1E4E79' },
  success: { bg: '#EEF8F1', border: '#2E9B5B', title: '#1D6B3E' },
  warning: { bg: '#FFF7E8', border: '#D99A1E', title: '#8A5A00' },
  neutral: { bg: '#F4F5F6', border: '#9AA5AB', title: '#3B474D' },
};

function blockBackground(b: EmailBlock, t: EmailTheme) {
  if (b.background === 'soft') return '#F5F7F8';
  if (b.background === 'brand') return t.primary;
  if (b.background === 'custom') return b.bgColor || '#F5F7F8';
  return '';
}

function renderBlock(b: EmailBlock, t: EmailTheme, base?: string): string {
  const onBrand = b.background === 'brand';
  const text = onBrand ? '#FFFFFF' : t.text;
  const muted = onBrand ? 'rgba(255,255,255,0.75)' : t.muted;
  const align = b.align || 'left';
  const font = `font-family:${t.fontFamily}`;
  switch (b.type) {
    case 'heading': {
      const sizes: Record<string, number> = { h1: 28, h2: 22, h3: 17 };
      const size = sizes[b.level] || 22;
      return `<h${b.level === 'h1' ? 1 : b.level === 'h3' ? 3 : 2} style="margin:0;font-family:${t.headingFontFamily};font-size:${size}px;line-height:1.3;font-weight:700;color:${b.color || (onBrand ? '#FFFFFF' : t.text)};text-align:${align}">${esc(b.text).replace(/\n/g, '<br/>')}</h${b.level === 'h1' ? 1 : b.level === 'h3' ? 3 : 2}>`;
    }
    case 'text': {
      const size = b.size === 'sm' ? 13 : b.size === 'lg' ? 17 : 15;
      return mdToHtml(b.text, t, { color: b.color || text, size, align });
    }
    case 'button': {
      const bg = b.style === 'accent' ? t.accent : b.style === 'outline' ? 'transparent' : (onBrand ? t.accent : t.primary);
      const fg = b.style === 'outline' ? (onBrand ? '#FFFFFF' : t.primary) : b.style === 'accent' ? '#1A1A1A' : '#FFFFFF';
      const border = b.style === 'outline' ? `border:2px solid ${onBrand ? '#FFFFFF' : t.primary};` : `border:2px solid ${bg};`;
      const url = esc(safeUrl(b.url));
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${b.fullWidth ? 'width="100%"' : ''} align="${align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'}" style="margin:${align === 'center' ? '0 auto' : '0'}" class="ak-btn">
        <tr><td align="center" bgcolor="${bg === 'transparent' ? '' : bg}" style="border-radius:${t.buttonRadius}px;${bg === 'transparent' ? '' : `background:${bg};`}">
          <a href="${url}" target="_blank" style="display:inline-block;${border}border-radius:${t.buttonRadius}px;padding:13px 28px;${font};font-size:15px;font-weight:700;line-height:1.2;color:${fg};text-decoration:none;${b.fullWidth ? 'display:block;' : ''}">${esc(b.label)}</a>
        </td></tr>
      </table>${b.note ? `<div style="clear:both"></div><p style="margin:10px 0 0;${font};font-size:12px;line-height:1.5;color:${muted};text-align:${align};word-break:break-all">${esc(b.note)}</p>` : '<div style="clear:both"></div>'}`;
    }
    case 'image': {
      const src = abs(b.src, base);
      if (!src) return '';
      const width = Math.round(((Number(b.width) || 100) / 100) * (t.contentWidth - 80));
      const img = `<img src="${esc(src)}" alt="${esc(b.alt || '')}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;${b.rounded ? `border-radius:${t.radius}px;` : ''}${align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin-left:auto;' : ''}"/>`;
      return b.url ? `<a href="${esc(safeUrl(b.url))}" target="_blank">${img}</a>` : img;
    }
    case 'code':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:#F5F7F8;border:1px dashed ${t.accent};border-radius:${t.radius}px;padding:22px 16px">
        ${b.label ? `<p style="margin:0 0 8px;${font};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${t.muted}">${esc(b.label)}</p>` : ''}
        <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${t.primary}">${esc(b.code)}</p>
        ${b.note ? `<p style="margin:10px 0 0;${font};font-size:12px;color:${t.muted}">${esc(b.note)}</p>` : ''}
      </td></tr></table>`;
    case 'details': {
      const rows = (Array.isArray(b.rows) ? b.rows : []).filter((r: any) => r?.label || r?.value);
      if (!rows.length) return '';
      return `${b.title ? `<p style="margin:0 0 10px;${font};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${t.primary}">${esc(b.title)}</p>` : ''}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${t.border};border-radius:${t.radius}px;border-collapse:separate;overflow:hidden">
        ${rows.map((r: any, i: number) => `<tr>
          <td style="padding:11px 16px;${font};font-size:13px;color:${t.muted};width:38%;vertical-align:top;${i ? `border-top:1px solid ${t.border};` : ''}background:#FAFBFB">${esc(r.label)}</td>
          <td style="padding:11px 16px;${font};font-size:14px;font-weight:600;color:${t.text};vertical-align:top;${i ? `border-top:1px solid ${t.border};` : ''}">${esc(r.value)}</td>
        </tr>`).join('')}</table>`;
    }
    case 'callout': {
      const tone = b.tone === 'brand' ? { bg: '#EEF5F7', border: t.primary, title: t.primary } : TONES[b.tone] || TONES.neutral;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${tone.bg};border-left:4px solid ${tone.border};border-radius:${Math.min(t.radius, 8)}px;padding:16px 18px">
        ${b.title ? `<p style="margin:0 0 6px;${font};font-size:14px;font-weight:700;color:${tone.title}">${esc(b.title)}</p>` : ''}
        ${mdToHtml(b.text, t, { size: 14 }).replace(/margin:0 0 14px/g, 'margin:0 0 8px')}
      </td></tr></table>`;
    }
    case 'list': {
      const items = (Array.isArray(b.items) ? b.items : []).filter((i: any) => i?.text);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((it: any, i: number) => `<tr>
        <td width="26" valign="top" style="padding:3px 0 8px;${font};font-size:15px;font-weight:700;color:${t.accent}">${b.style === 'number' ? `${i + 1}.` : b.style === 'bullet' ? '&bull;' : '&#10003;'}</td>
        <td valign="top" style="padding:3px 0 8px;${font};font-size:15px;line-height:1.55;color:${text}">${esc(it.text)}</td></tr>`).join('')}</table>`;
    }
    case 'quote':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${t.accent};padding:4px 0 4px 18px">
        ${mdToHtml(b.text, t, { size: 15, color: t.text }).replace(/margin:0 0 14px/g, 'margin:0 0 6px;font-style:italic')}
        ${b.author ? `<p style="margin:6px 0 0;${font};font-size:13px;font-weight:700;color:${t.muted}">— ${esc(b.author)}</p>` : ''}
      </td></tr></table>`;
    case 'columns': {
      const col = (title: string, body: string) => `${title ? `<p style="margin:0 0 8px;${font};font-size:15px;font-weight:700;color:${text}">${esc(title)}</p>` : ''}${mdToHtml(body, t, { size: 14, color: text })}`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="ak-col" width="50%" valign="top" style="padding-right:12px">${col(b.leftTitle, b.left)}</td>
        <td class="ak-col" width="50%" valign="top" style="padding-left:12px">${col(b.rightTitle, b.right)}</td>
      </tr></table>`;
    }
    case 'divider': {
      const w = Math.min(100, Math.max(10, Number(b.width) || 100));
      return `<table role="presentation" width="${w}%" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:${Math.max(1, Number(b.thickness) || 1)}px solid ${b.color || t.border};font-size:0;line-height:0">&nbsp;</td></tr></table>`;
    }
    case 'spacer':
      return `<div style="height:${Math.max(4, Number(b.height) || 24)}px;line-height:${Math.max(4, Number(b.height) || 24)}px;font-size:0">&nbsp;</div>`;
    case 'signature':
      return `<p style="margin:0;${font};font-size:15px;line-height:1.6;color:${text}">${esc(b.closing)}${b.name ? `<br/><strong>${esc(b.name)}</strong>` : ''}${b.title ? `<br/><span style="color:${muted};font-size:13px">${esc(b.title)}</span>` : ''}</p>`;
    case 'social': {
      const links = socialLinks(t);
      if (!links) return '';
      return `${b.label ? `<p style="margin:0 0 8px;${font};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${muted};text-align:${align}">${esc(b.label)}</p>` : ''}<p style="margin:0;${font};font-size:13px;text-align:${align}">${links}</p>`;
    }
    case 'html':
      return String(b.html || '');
    default:
      return '';
  }
}

const SOCIAL_LABELS: Record<string, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', twitter: 'X', youtube: 'YouTube', whatsapp: 'WhatsApp' };
function socialLinks(t: EmailTheme, color = t.primary) {
  return Object.entries(t.socials || {}).filter(([, u]) => u)
    .map(([k, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" style="color:${color};text-decoration:none;font-weight:600">${SOCIAL_LABELS[k] || k}</a>`)
    .join(`&nbsp;&nbsp;&middot;&nbsp;&nbsp;`);
}

/** The branded frame: header, flag stripe, body, footer. */
function frame(t: EmailTheme, body: string, o: RenderEmailOptions & { showHeader?: boolean; showFooter?: boolean }) {
  const W = t.contentWidth;
  const font = `font-family:${t.fontFamily}`;
  const logo = abs(t.logoUrl, o.assetBase);
  const band = t.headerStyle === 'band';
  const header = o.showHeader === false ? '' : `
    <tr><td class="ak-px" align="${t.headerStyle === 'minimal' ? 'center' : 'left'}" bgcolor="${band ? t.primary : t.surface}" style="background:${band ? t.primary : t.surface};padding:${band ? '22px 36px' : '28px 36px 8px'};border-radius:${t.radius}px ${t.radius}px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${t.headerStyle === 'minimal' ? 'align="center"' : ''}><tr>
        ${logo ? `<td valign="middle" style="padding-right:${t.headerStyle === 'minimal' ? 0 : 14}px"><img src="${esc(logo)}" width="${t.logoWidth}" alt="${esc(t.brandName)}" style="display:block;width:${t.logoWidth}px;height:auto;border:0;${band ? '' : ''}border-radius:50%"/></td>` : ''}
        ${t.headerStyle === 'minimal' ? '' : `<td valign="middle">
          <p style="margin:0;font-family:${t.headingFontFamily};font-size:19px;font-weight:700;letter-spacing:0.3px;color:${band ? '#FFFFFF' : t.primary}">${esc(t.brandName)}</p>
          ${t.tagline ? `<p style="margin:3px 0 0;${font};font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:${band ? t.accent : t.muted}">${esc(t.tagline)}</p>` : ''}
        </td>`}
      </tr></table>
    </td></tr>
    ${t.showFlagStripe ? `<tr><td style="font-size:0;line-height:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="25%" height="4" bgcolor="#C8102E" style="background:#C8102E;font-size:0;line-height:0">&nbsp;</td>
        <td width="25%" height="4" bgcolor="#00732F" style="background:#00732F;font-size:0;line-height:0">&nbsp;</td>
        <td width="25%" height="4" bgcolor="#FFFFFF" style="background:#FFFFFF;font-size:0;line-height:0">&nbsp;</td>
        <td width="25%" height="4" bgcolor="#000000" style="background:#000000;font-size:0;line-height:0">&nbsp;</td>
      </tr></table></td></tr>` : ''}`;

  const contact = [t.footerPhone, t.footerEmail && `<a href="mailto:${esc(t.footerEmail)}" style="color:${t.muted};text-decoration:none">${esc(t.footerEmail)}</a>`,
    t.footerWebsite && `<a href="${esc(safeUrl(t.footerWebsite))}" style="color:${t.muted};text-decoration:none">${esc(t.footerWebsite)}</a>`].filter(Boolean);
  const social = socialLinks(t);
  const footer = o.showFooter === false ? '' : `
    <tr><td class="ak-px" align="center" style="padding:26px 36px 8px;${font};font-size:12px;line-height:1.6;color:${t.muted}">
      ${t.footerCompany ? `<p style="margin:0 0 4px;font-weight:700;color:${t.text}">${esc(t.footerCompany)}</p>` : ''}
      ${t.footerAddress ? `<p style="margin:0 0 4px">${esc(t.footerAddress)}</p>` : ''}
      ${contact.length ? `<p style="margin:0 0 10px">${contact.map(c => typeof c === 'string' && !c.startsWith('<') ? esc(c) : c).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</p>` : ''}
      ${social ? `<p style="margin:0 0 10px">${social}</p>` : ''}
      ${t.footerNote ? `<p style="margin:0;font-size:11px;color:#8A9599">${esc(t.footerNote)}</p>` : ''}
    </td></tr>`;

  const pre = o.preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(o.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light only"/>
<title>${esc(o.subject || t.brandName)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic}
  a{color:${t.primary}}
  .ak-body p{margin:0 0 14px;font-family:${t.fontFamily};font-size:15px;line-height:1.65;color:${t.text}}
  @media only screen and (max-width:${W + 20}px){
    .ak-container{width:100%!important;max-width:100%!important}
    .ak-px{padding-left:22px!important;padding-right:22px!important}
    .ak-col{display:block!important;width:100%!important;padding:0 0 12px!important}
    .ak-btn{width:100%!important}
    .ak-btn a{display:block!important}
    .ak-hide-mobile{display:none!important;max-height:0!important;overflow:hidden!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${t.background}">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.background}" style="background:${t.background}">
<tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="${W}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="ak-container" width="${W}" cellpadding="0" cellspacing="0" border="0" style="width:${W}px;max-width:${W}px">
  ${header}
  <tr><td class="ak-px ak-body" bgcolor="${t.surface}" style="background:${t.surface};padding:30px 36px 34px;border-radius:${o.showHeader === false ? `${t.radius}px ${t.radius}px` : '0 0'} ${t.radius}px ${t.radius}px;${font};font-size:15px;line-height:1.65;color:${t.text}">
    ${body}
  </td></tr>
  ${footer}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** A builder design → complete email document. */
export function renderEmail(design: EmailDesign | any, theme: EmailTheme, o: RenderEmailOptions = {}): string {
  const d = normalizeDesign(design);
  const body = d.blocks.map(b => {
    const inner = renderBlock(b, theme, o.assetBase);
    if (!inner) return '';
    const bg = blockBackground(b, theme);
    const pt = Math.max(0, Number(b.paddingTop) || 0), pb = Math.max(0, Number(b.paddingBottom) || 0);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${b.hideOnMobile ? ' class="ak-hide-mobile"' : ''}${o.annotate ? ` data-ak-block="${esc(b.id)}"` : ''}><tr><td style="padding:${pt}px ${bg ? '20px' : '0'} ${pb}px;${bg ? `background:${bg};border-radius:${Math.min(theme.radius, 10)}px;` : ''}">${inner}</td></tr></table>`;
  }).join('\n');
  return frame(theme, body, { ...o, preheader: o.preheader ?? d.settings.preheader, showHeader: d.settings.showHeader, showFooter: d.settings.showFooter });
}

/** A bare HTML fragment (older templates, emails built in code) → the branded frame. */
export function wrapEmailHtml(fragment: string, theme: EmailTheme, o: RenderEmailOptions = {}): string {
  return frame(theme, fragment, o);
}

export function isFullHtmlDocument(html: string) {
  return /<html[\s>]/i.test(html || '');
}

/** Plain-text alternative for an HTML email (sent alongside it; improves deliverability). */
export function htmlToText(html: string): string {
  let s = String(html || '');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return href.startsWith('mailto:') || href === text || !text ? text || href : `${text} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|tr|table|ul|ol)>/gi, '\n\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, '·').replace(/&bull;/g, '•').replace(/&#10003;/g, '✓')
    .replace(/&#847;|&zwnj;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
