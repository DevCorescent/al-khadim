// Standalone HTML print engine — generates a complete print-ready document
// from invoice data + design settings. No DOM capture.
import { amountInWords, fillLabel, normalizeDesign, type InvoiceDesignOptions } from '@/lib/invoiceDesign';

export interface PrintInvoice {
  invoiceNo: string; docType: string; status: string; currency: string;
  issueDate: string; dueDate?: string; validUntil?: string;
  subject?: string; description?: string;
  fromName?: string; fromAddress?: string; fromEmail?: string; fromPhone?: string;
  fromTaxNo?: string; fromRegNo?: string;
  billingName?: string; billingAddress?: string; billingEmail?: string; billingPhone?: string; billingHsnSac?: string;
  billingTaxNo?: string; paymentTerms?: string; fromWebsite?: string; fromEmailAlt?: string;
  bankAccountName?: string; bankBranch?: string;
  designOptions?: Partial<InvoiceDesignOptions> | null;
  subtotal: number; discount: number; discountType: string; taxRate: number;
  tax: number; totalAmount: number; taxLabel?: string;
  paymentMethod?: string; paymentRef?: string;
  bankName?: string; bankAccount?: string; bankIBAN?: string; bankSwift?: string;
  bankRoutingNo?: string; bankSortCode?: string;
  terms?: string; notes?: string;
  items: { description: string; qty: number; unit?: string; unitPrice: number; total: number; fromDate?: string | null; toDate?: string | null }[];
  // Design
  template?: string; primaryColor?: string; accentColor?: string; fontFamily?: string;
  logoText?: string; logoUrl?: string | null; logoShape?: string; tableStyle?: string;
  watermark?: string; watermarkOpacity?: number;
  showHeader?: boolean; showFooter?: boolean; showSignature?: boolean; footerText?: string;
  dateFormat?: string;
}

const FONT_STACK: Record<string, string> = {
  helvetica: "'Helvetica Neue', Arial, sans-serif",
  georgia:   "Georgia, 'Times New Roman', serif",
  courier:   "'Courier New', Courier, monospace",
  trebuchet: "'Trebuchet MS', Tahoma, Geneva, sans-serif",
  inter:     "Inter, 'Helvetica Neue', Arial, sans-serif",
  calibri:   "Calibri, Carlito, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
};

const DOC_LABELS: Record<string,string> = {
  INVOICE:'INVOICE', PROFORMA_INVOICE:'PROFORMA INVOICE', QUOTATION:'QUOTATION',
};

function hex2rgb(hex: string): string {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `${r},${g},${b}`;
}

function isDark(hex: string): boolean {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 < 128;
}

function fmtN(n: number): string {
  return (n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function fmtDate(iso: string, fmt = 'DD/MM/YYYY'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd   = String(d.getDate()).padStart(2,'0');
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = String(d.getFullYear());
  const mon  = d.toLocaleString('default',{month:'short'});
  return fmt.replace('DD',dd).replace('MMM',mon).replace('MM',mm).replace('YYYY',yyyy);
}

/** Uploaded logo image, sized to sit where the initials box would; '' when there is none. */
function logoImage(inv: PrintInvoice, height: number): string {
  if (!inv.logoUrl) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src = `${origin}/${String(inv.logoUrl).replace(/^\/+/, '').replace(/"/g, '')}`;
  return `<img src="${src}" alt="" style="display:block;max-height:${height}px;max-width:${height * 3.5}px;object-fit:contain" />`;
}

function logoRadius(shape = 'rounded'): string {
  return shape === 'circle' ? '50%' : shape === 'square' ? '4px' : '10px';
}

// ─── Template: Classic ──────────────────────────────────────────────────────
function templateClassic(inv: PrintInvoice, pc: string, ac: string, font: string): string {
  const onPc  = isDark(pc) ? '#ffffff' : '#111111';
  const dateLabel = inv.docType === 'QUOTATION' ? 'Valid Until' : 'Due Date';
  const exDate    = inv.dueDate || inv.validUntil || '';
  const senderName = inv.fromName || 'Company Name';

  const tableRows = inv.items.map((it,i) => {
    const bg = inv.tableStyle === 'striped' && i%2===0 ? `background:#f9f9fb` : '';
    return `<tr style="${bg}">
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">${it.description}</td>
      <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f0f0f0">${it.qty}${it.unit?' '+it.unit:''}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${inv.currency} ${fmtN(it.unitPrice)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f0">${inv.currency} ${fmtN(it.total)}</td>
    </tr>`;
  }).join('');

  const tableBorder = inv.tableStyle === 'bordered' ? `border:1px solid #e5e7eb;border-collapse:collapse` : `border-collapse:collapse`;

  return `
  <div style="border-bottom:4px solid ${pc};padding:36px 48px 24px">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td>
          ${logoImage(inv, 56) || `<div style="width:52px;height:52px;background:${pc};border-radius:${logoRadius(inv.logoShape)};display:flex;align-items:center;justify-content:center;color:${onPc};font-size:22px;font-weight:900;text-align:center;line-height:52px">
            ${(inv.logoText||senderName[0]||'?').toUpperCase()}
          </div>`}
          <div style="margin-top:10px">
            <div style="font-size:18px;font-weight:800;color:#111">${senderName}</div>
            ${inv.fromAddress?`<div style="color:#666;font-size:11px;margin-top:3px;white-space:pre-line">${inv.fromAddress}</div>`:''}
            ${inv.fromEmail  ?`<div style="color:#666;font-size:11px">${inv.fromEmail}</div>`:''}
            ${inv.fromPhone  ?`<div style="color:#666;font-size:11px">${inv.fromPhone}</div>`:''}
            ${inv.fromTaxNo  ?`<div style="color:#888;font-size:11px;margin-top:4px">Tax No: ${inv.fromTaxNo}</div>`:''}
            ${inv.fromRegNo  ?`<div style="color:#888;font-size:11px">Reg No: ${inv.fromRegNo}</div>`:''}
          </div>
        </td>
        <td style="text-align:right;vertical-align:top">
          <div style="font-size:28px;font-weight:900;color:${pc};letter-spacing:3px">${DOC_LABELS[inv.docType]||'INVOICE'}</div>
          <div style="font-size:14px;color:#555;margin-top:4px;font-family:monospace">${inv.invoiceNo}</div>
          <div style="display:inline-block;margin-top:8px;background:${pc}18;color:${pc};padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px">${inv.status}</div>
          <table style="border-collapse:collapse;margin-top:16px;margin-left:auto">
            <tr><td style="color:#888;font-size:11px;padding:2px 8px 2px 0;text-align:right;font-weight:600;text-transform:uppercase">Issue Date</td><td style="font-size:12px;font-weight:700;color:#222">${fmtDate(inv.issueDate,inv.dateFormat)}</td></tr>
            ${exDate?`<tr><td style="color:#888;font-size:11px;padding:2px 8px 2px 0;text-align:right;font-weight:600;text-transform:uppercase">${dateLabel}</td><td style="font-size:12px;font-weight:700;color:#c0392b">${fmtDate(exDate,inv.dateFormat)}</td></tr>`:''}
          </table>
        </td>
      </tr>
    </table>
  </div>

  <div style="background:#f8f8fc;padding:20px 48px;border-bottom:1px solid #eee">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="width:50%;vertical-align:top">
          <div style="font-size:10px;font-weight:800;color:${pc};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Bill To</div>
          <div style="font-size:14px;font-weight:700;color:#111">${inv.billingName||'—'}</div>
          ${inv.billingEmail   ?`<div style="color:#555;font-size:12px;margin-top:2px">${inv.billingEmail}</div>`:''}
          ${inv.billingPhone   ?`<div style="color:#555;font-size:12px">${inv.billingPhone}</div>`:''}
          ${inv.billingAddress ?`<div style="color:#777;font-size:12px;margin-top:4px;white-space:pre-line">${inv.billingAddress}</div>`:''}
          ${inv.billingHsnSac  ?`<div style="color:#777;font-size:12px;margin-top:2px">HSN/SAC: ${inv.billingHsnSac}</div>`:''}
        </td>
        <td style="vertical-align:top;text-align:right">
          ${inv.subject?`<div style="font-size:13px;font-weight:700;color:#222">${inv.subject}</div>`:''}
          ${inv.description?`<div style="font-size:11px;color:#888;margin-top:2px">${inv.description}</div>`:''}
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:24px 48px">
    <table width="100%" style="${tableBorder}">
      <thead>
        <tr style="background:${pc}">
          <th style="color:${onPc};text-align:left;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Description</th>
          <th style="color:${onPc};text-align:center;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;width:80px">Qty</th>
          <th style="color:${onPc};text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;width:110px">Unit Price</th>
          <th style="color:${onPc};text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;width:110px">Total</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <table width="100%" style="border-collapse:collapse;margin-top:16px">
      <tr><td></td><td style="width:300px">
        <table width="100%" style="border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#666;font-size:12px">Subtotal</td><td style="text-align:right;font-size:12px;font-weight:600;color:#222">${inv.currency} ${fmtN(inv.subtotal)}</td></tr>
          ${inv.discount>0?`<tr><td style="padding:5px 0;color:#666;font-size:12px">Discount</td><td style="text-align:right;font-size:12px;color:#e53e3e">- ${inv.currency} ${fmtN(inv.discount>0&&inv.discountType==='PERCENT'?inv.subtotal*(inv.discount/100):inv.discount)}</td></tr>`:''}
          ${inv.tax>0?`<tr><td style="padding:5px 0;color:#666;font-size:12px">${inv.taxLabel||'Tax'} (${inv.taxRate}%)</td><td style="text-align:right;font-size:12px;color:#222">${inv.currency} ${fmtN(inv.tax)}</td></tr>`:''}
          <tr style="border-top:2px solid #111"><td style="padding:10px 0 4px;font-size:14px;font-weight:900;color:#111">TOTAL</td><td style="text-align:right;font-size:18px;font-weight:900;color:${pc};padding-top:10px">${inv.currency} ${fmtN(inv.totalAmount)}</td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

// ─── Template: Modern ───────────────────────────────────────────────────────
function templateModern(inv: PrintInvoice, pc: string, ac: string, font: string): string {
  const onPc  = isDark(pc) ? '#ffffff' : '#111111';
  const rgb   = hex2rgb(pc);
  const dateLabel = inv.docType === 'QUOTATION' ? 'Valid Until' : 'Due Date';
  const exDate    = inv.dueDate || inv.validUntil || '';
  const senderName = inv.fromName || 'Company Name';

  const tableRows = inv.items.map((it,i) => {
    const bg = inv.tableStyle !== 'minimal' && i%2===0 ? `rgba(${rgb},0.04)` : 'transparent';
    return `<tr>
      <td style="padding:12px 16px;background:${bg};border-bottom:1px solid rgba(${rgb},0.08)">${it.description}</td>
      <td style="padding:12px 16px;text-align:center;background:${bg};border-bottom:1px solid rgba(${rgb},0.08)">${it.qty}${it.unit?' '+it.unit:''}</td>
      <td style="padding:12px 16px;text-align:right;background:${bg};border-bottom:1px solid rgba(${rgb},0.08)">${inv.currency} ${fmtN(it.unitPrice)}</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;background:${bg};border-bottom:1px solid rgba(${rgb},0.08)">${inv.currency} ${fmtN(it.total)}</td>
    </tr>`;
  }).join('');

  return `
  <div style="background:linear-gradient(135deg,${pc} 0%,rgba(${rgb},0.7) 100%);padding:40px 48px 32px">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="vertical-align:top">
          ${inv.logoUrl ? `<div style="display:inline-block;background:#fff;border-radius:10px;padding:6px 10px">${logoImage(inv, 48)}</div>` : `<div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.18);border-radius:${logoRadius(inv.logoShape)};text-align:center;line-height:56px;font-size:24px;font-weight:900;color:#fff;border:2px solid rgba(255,255,255,0.3)">
            ${(inv.logoText||senderName[0]||'?').toUpperCase()}
          </div>`}
          <div style="margin-top:12px;color:rgba(255,255,255,0.95)">
            <div style="font-size:20px;font-weight:800">${senderName}</div>
            ${inv.fromAddress?`<div style="font-size:11px;opacity:0.8;margin-top:3px;white-space:pre-line">${inv.fromAddress}</div>`:''}
            ${inv.fromEmail  ?`<div style="font-size:11px;opacity:0.8">${inv.fromEmail}</div>`:''}
            ${inv.fromPhone  ?`<div style="font-size:11px;opacity:0.8">${inv.fromPhone}</div>`:''}
            ${inv.fromTaxNo  ?`<div style="font-size:11px;opacity:0.65;margin-top:4px">Tax: ${inv.fromTaxNo}</div>`:''}
            ${inv.fromRegNo  ?`<div style="font-size:11px;opacity:0.65">Reg: ${inv.fromRegNo}</div>`:''}
          </div>
        </td>
        <td style="vertical-align:top;text-align:right">
          <div style="font-size:32px;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:4px;line-height:1">${DOC_LABELS[inv.docType]||'INVOICE'}</div>
          <div style="color:#fff;font-size:14px;font-family:monospace;margin-top:4px;opacity:0.9">${inv.invoiceNo}</div>
          <div style="margin-top:16px;text-align:right">
            <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Total Due</div>
            <div style="color:#fff;font-size:28px;font-weight:900;line-height:1.1">${inv.currency} ${fmtN(inv.totalAmount)}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div style="display:flex;background:#fff;padding:24px 48px;border-bottom:1px solid #f0f0f0;gap:24px">
    <div style="flex:1;background:#f9f9fc;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:800;color:${pc};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Bill To</div>
      <div style="font-size:13px;font-weight:700;color:#111">${inv.billingName||'—'}</div>
      ${inv.billingEmail   ?`<div style="color:#555;font-size:11px;margin-top:2px">${inv.billingEmail}</div>`:''}
      ${inv.billingPhone   ?`<div style="color:#555;font-size:11px">${inv.billingPhone}</div>`:''}
      ${inv.billingAddress ?`<div style="color:#777;font-size:11px;margin-top:4px;white-space:pre-line">${inv.billingAddress}</div>`:''}
      ${inv.billingHsnSac  ?`<div style="color:#777;font-size:11px;margin-top:2px">HSN/SAC: ${inv.billingHsnSac}</div>`:''}
    </div>
    <div style="flex:0 0 auto;background:#f9f9fc;border-radius:10px;padding:16px;min-width:180px">
      <table style="border-collapse:collapse">
        <tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 16px 3px 0">Issue Date</td><td style="font-size:12px;font-weight:700;color:#222">${fmtDate(inv.issueDate,inv.dateFormat)}</td></tr>
        ${exDate?`<tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 16px 3px 0">${dateLabel}</td><td style="font-size:12px;font-weight:700;color:#c0392b">${fmtDate(exDate,inv.dateFormat)}</td></tr>`:''}
        <tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 16px 3px 0;padding-top:8px">Status</td><td style="padding-top:8px"><span style="background:${pc}18;color:${pc};padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">${inv.status}</span></td></tr>
      </table>
    </div>
  </div>

  <div style="padding:24px 48px">
    ${inv.subject?`<div style="font-size:14px;font-weight:700;color:#222;margin-bottom:16px">${inv.subject}${inv.description?` <span style="font-weight:400;color:#888;font-size:12px">— ${inv.description}</span>`:''}</div>`:''}
    <table width="100%" style="border-collapse:collapse;border-radius:10px;overflow:hidden">
      <thead>
        <tr>
          <th style="background:${pc};color:${onPc};text-align:left;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase">Description</th>
          <th style="background:${pc};color:${onPc};text-align:center;padding:10px 16px;font-size:11px;width:80px">Qty</th>
          <th style="background:${pc};color:${onPc};text-align:right;padding:10px 16px;font-size:11px;width:110px">Rate</th>
          <th style="background:${pc};color:${onPc};text-align:right;padding:10px 16px;font-size:11px;width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:20px">
      <div style="background:#f9f9fc;border-radius:12px;padding:20px 24px;min-width:280px">
        <table width="100%" style="border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#666;font-size:12px">Subtotal</td><td style="text-align:right;color:#222;font-size:12px">${inv.currency} ${fmtN(inv.subtotal)}</td></tr>
          ${inv.discount>0?`<tr><td style="padding:4px 0;color:#666;font-size:12px">Discount</td><td style="text-align:right;color:#e53e3e;font-size:12px">- ${inv.currency} ${fmtN(inv.discount>0&&inv.discountType==='PERCENT'?inv.subtotal*(inv.discount/100):inv.discount)}</td></tr>`:''}
          ${inv.tax>0?`<tr><td style="padding:4px 0;color:#666;font-size:12px">${inv.taxLabel||'Tax'} ${inv.taxRate}%</td><td style="text-align:right;color:#222;font-size:12px">${inv.currency} ${fmtN(inv.tax)}</td></tr>`:''}
          <tr><td colspan="2" style="padding-top:12px"><div style="border-top:2px solid ${pc};margin-bottom:8px"></div></td></tr>
          <tr><td style="font-size:14px;font-weight:900;color:#111">TOTAL</td><td style="text-align:right;font-size:20px;font-weight:900;color:${pc}">${inv.currency} ${fmtN(inv.totalAmount)}</td></tr>
        </table>
      </div>
    </div>
  </div>`;
}

// ─── Template: Minimal ──────────────────────────────────────────────────────
function templateMinimal(inv: PrintInvoice, pc: string, ac: string, font: string): string {
  const dateLabel  = inv.docType === 'QUOTATION' ? 'Valid Until' : 'Due Date';
  const exDate     = inv.dueDate || inv.validUntil || '';
  const senderName = inv.fromName || 'Company Name';

  const tableRows = inv.items.map(it => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #eee;font-size:13px;color:#333">${it.description}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eee;text-align:center;color:#666;font-size:12px">${it.qty}${it.unit?' '+it.unit:''}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eee;text-align:right;color:#666;font-size:12px">${inv.currency} ${fmtN(it.unitPrice)}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;font-size:13px;color:#111">${inv.currency} ${fmtN(it.total)}</td>
    </tr>`).join('');

  return `
  <div style="padding:48px 56px 32px">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="vertical-align:top">
          ${inv.logoUrl ? `<div style="margin-bottom:12px">${logoImage(inv, 48)}</div>` : ''}
          <div style="font-size:22px;font-weight:900;color:#111;letter-spacing:-0.5px">${senderName}</div>
          ${inv.fromAddress?`<div style="color:#888;font-size:12px;margin-top:4px;white-space:pre-line">${inv.fromAddress}</div>`:''}
          ${inv.fromEmail  ?`<div style="color:#888;font-size:12px">${inv.fromEmail}</div>`:''}
          ${inv.fromPhone  ?`<div style="color:#888;font-size:12px">${inv.fromPhone}</div>`:''}
          ${inv.fromTaxNo  ?`<div style="color:#aaa;font-size:11px;margin-top:4px">Tax: ${inv.fromTaxNo}</div>`:''}
        </td>
        <td style="text-align:right;vertical-align:top">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:${pc}">${DOC_LABELS[inv.docType]||'INVOICE'}</div>
          <div style="font-size:24px;font-weight:900;color:#111;margin-top:4px;letter-spacing:-0.5px">${inv.invoiceNo}</div>
          <div style="margin-top:12px">
            <div style="color:#888;font-size:11px">${fmtDate(inv.issueDate,inv.dateFormat)}</div>
            ${exDate?`<div style="color:#c0392b;font-size:11px;font-weight:600">${dateLabel}: ${fmtDate(exDate,inv.dateFormat)}</div>`:''}
          </div>
        </td>
      </tr>
    </table>

    <div style="height:2px;background:${pc};margin:28px 0"></div>

    <table width="100%" style="border-collapse:collapse;margin-bottom:28px">
      <tr>
        <td style="vertical-align:top;width:50%">
          <div style="font-size:10px;color:${pc};font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Billed To</div>
          <div style="font-size:13px;font-weight:700;color:#111">${inv.billingName||'—'}</div>
          ${inv.billingEmail   ?`<div style="color:#666;font-size:12px;margin-top:2px">${inv.billingEmail}</div>`:''}
          ${inv.billingPhone   ?`<div style="color:#666;font-size:12px">${inv.billingPhone}</div>`:''}
          ${inv.billingAddress ?`<div style="color:#888;font-size:12px;margin-top:4px;white-space:pre-line">${inv.billingAddress}</div>`:''}
          ${inv.billingHsnSac  ?`<div style="color:#888;font-size:12px;margin-top:2px">HSN/SAC: ${inv.billingHsnSac}</div>`:''}
        </td>
        ${inv.subject?`<td style="vertical-align:top;text-align:right"><div style="font-size:13px;font-weight:600;color:#333">${inv.subject}</div></td>`:''}
      </tr>
    </table>

    <table width="100%" style="border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #111">
          <th style="text-align:left;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666">Description</th>
          <th style="text-align:center;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;width:80px">Qty</th>
          <th style="text-align:right;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;width:110px">Rate</th>
          <th style="text-align:right;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;color:#666;width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <table width="100%" style="border-collapse:collapse;margin-top:20px">
      <tr><td></td><td style="width:260px">
        <table width="100%" style="border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#888;font-size:12px">Subtotal</td><td style="text-align:right;font-size:12px;color:#444">${inv.currency} ${fmtN(inv.subtotal)}</td></tr>
          ${inv.discount>0?`<tr><td style="padding:4px 0;color:#888;font-size:12px">Discount</td><td style="text-align:right;font-size:12px;color:#c0392b">- ${inv.currency} ${fmtN(inv.discount>0&&inv.discountType==='PERCENT'?inv.subtotal*(inv.discount/100):inv.discount)}</td></tr>`:''}
          ${inv.tax>0?`<tr><td style="padding:4px 0;color:#888;font-size:12px">${inv.taxLabel||'Tax'} ${inv.taxRate}%</td><td style="text-align:right;font-size:12px;color:#444">${inv.currency} ${fmtN(inv.tax)}</td></tr>`:''}
          <tr><td style="padding-top:10px;font-size:15px;font-weight:900;color:#111;border-top:2px solid #111">Total</td><td style="text-align:right;font-size:20px;font-weight:900;color:${pc};border-top:2px solid #111;padding-top:10px">${inv.currency} ${fmtN(inv.totalAmount)}</td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

// ─── Template: Corporate ────────────────────────────────────────────────────
function templateCorporate(inv: PrintInvoice, pc: string, ac: string, font: string): string {
  const onPc  = isDark(pc) ? '#ffffff' : '#111111';
  const rgb   = hex2rgb(pc);
  const dateLabel  = inv.docType === 'QUOTATION' ? 'Valid Until' : 'Due Date';
  const exDate     = inv.dueDate || inv.validUntil || '';
  const senderName = inv.fromName || 'Company Name';

  const tableRows = inv.items.map((it,i) => {
    const bg = inv.tableStyle === 'striped' && i%2!==0 ? `#f4f6fa` : '#fff';
    return `<tr style="background:${bg}">
      <td style="padding:11px 14px;border:1px solid #e8eaed;font-size:12px">${it.description}</td>
      <td style="padding:11px 14px;border:1px solid #e8eaed;text-align:center;font-size:12px;color:#555">${it.qty}${it.unit?' '+it.unit:''}</td>
      <td style="padding:11px 14px;border:1px solid #e8eaed;text-align:right;font-size:12px;color:#555">${inv.currency} ${fmtN(it.unitPrice)}</td>
      <td style="padding:11px 14px;border:1px solid #e8eaed;text-align:right;font-weight:700;font-size:12px">${inv.currency} ${fmtN(it.total)}</td>
    </tr>`;
  }).join('');

  return `
  <div style="background:${pc};padding:0">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="padding:32px 40px;vertical-align:middle">
          <div style="display:inline-flex;align-items:center;gap:14px">
            ${inv.logoUrl ? `<div style="background:#fff;border-radius:10px;padding:6px 10px">${logoImage(inv, 44)}</div>` : `<div style="width:50px;height:50px;background:rgba(255,255,255,0.2);border-radius:${logoRadius(inv.logoShape)};text-align:center;line-height:50px;font-size:20px;font-weight:900;color:${onPc};border:2px solid rgba(255,255,255,0.35)">
              ${(inv.logoText||senderName[0]||'?').toUpperCase()}
            </div>`}
            <div>
              <div style="font-size:17px;font-weight:800;color:${onPc}">${senderName}</div>
              ${inv.fromAddress?`<div style="font-size:10px;color:rgba(${hex2rgb(onPc)},0.7);white-space:pre-line">${inv.fromAddress}</div>`:''}
            </div>
          </div>
        </td>
        <td style="padding:32px 40px;text-align:right;vertical-align:middle">
          <div style="font-size:26px;font-weight:900;color:${onPc};letter-spacing:2px;opacity:0.95">${DOC_LABELS[inv.docType]||'INVOICE'}</div>
          <div style="color:${onPc};font-size:13px;font-family:monospace;opacity:0.8;margin-top:2px">${inv.invoiceNo}</div>
        </td>
      </tr>
    </table>
  </div>

  <div style="background:#f4f6fa;padding:0 40px">
    <table width="100%" style="border-collapse:collapse">
      <tr>
        <td style="padding:20px 0;border-right:1px solid #e8eaed;width:40%;vertical-align:top;padding-right:24px">
          <div style="font-size:10px;color:${pc};font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Bill To</div>
          <div style="font-size:13px;font-weight:700;color:#111">${inv.billingName||'—'}</div>
          ${inv.billingEmail   ?`<div style="color:#555;font-size:11px;margin-top:2px">${inv.billingEmail}</div>`:''}
          ${inv.billingPhone   ?`<div style="color:#555;font-size:11px">${inv.billingPhone}</div>`:''}
          ${inv.billingAddress ?`<div style="color:#777;font-size:11px;margin-top:4px;white-space:pre-line">${inv.billingAddress}</div>`:''}
          ${inv.billingHsnSac  ?`<div style="color:#777;font-size:11px;margin-top:2px">HSN/SAC: ${inv.billingHsnSac}</div>`:''}
        </td>
        <td style="padding:20px 0 20px 24px;vertical-align:top">
          <table style="border-collapse:collapse">
            <tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 20px 3px 0">Issue Date</td><td style="font-weight:700;font-size:12px;color:#111">${fmtDate(inv.issueDate,inv.dateFormat)}</td></tr>
            ${exDate?`<tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 20px 3px 0">${dateLabel}</td><td style="font-weight:700;font-size:12px;color:#c0392b">${fmtDate(exDate,inv.dateFormat)}</td></tr>`:''}
            <tr><td style="color:#888;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 20px 3px 0;padding-top:10px">Status</td><td style="padding-top:10px"><span style="background:${pc}22;color:${pc};padding:3px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1px">${inv.status}</span></td></tr>
          </table>
        </td>
        <td style="padding:20px 0 20px 0;vertical-align:middle;text-align:right;padding-left:24px;border-left:1px solid #e8eaed">
          <div style="font-size:10px;color:${pc};font-weight:800;text-transform:uppercase;letter-spacing:1px">Total Amount</div>
          <div style="font-size:26px;font-weight:900;color:${pc};line-height:1.1;margin-top:4px">${inv.currency} ${fmtN(inv.totalAmount)}</div>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:28px 40px">
    ${inv.subject?`<div style="font-size:13px;font-weight:700;color:#333;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #eee">${inv.subject}</div>`:''}
    <table width="100%" style="border-collapse:collapse">
      <thead>
        <tr style="background:${pc}12;border-top:2px solid ${pc};border-bottom:2px solid ${pc}">
          <th style="text-align:left;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:${pc};letter-spacing:0.5px">Description</th>
          <th style="text-align:center;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:${pc};width:80px">Qty</th>
          <th style="text-align:right;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:${pc};width:110px">Rate</th>
          <th style="text-align:right;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:${pc};width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr><td colspan="4" style="padding:12px 0"></td></tr>
        <tr><td colspan="2"></td>
          <td style="text-align:right;padding:6px 14px;font-size:12px;color:#666;border-top:1px solid #eee">Subtotal</td>
          <td style="text-align:right;padding:6px 14px;font-size:12px;color:#333;border-top:1px solid #eee">${inv.currency} ${fmtN(inv.subtotal)}</td>
        </tr>
        ${inv.discount>0?`<tr><td colspan="2"></td><td style="text-align:right;padding:4px 14px;font-size:12px;color:#666">Discount</td><td style="text-align:right;padding:4px 14px;font-size:12px;color:#c0392b">- ${inv.currency} ${fmtN(inv.discount>0&&inv.discountType==='PERCENT'?inv.subtotal*(inv.discount/100):inv.discount)}</td></tr>`:''}
        ${inv.tax>0?`<tr><td colspan="2"></td><td style="text-align:right;padding:4px 14px;font-size:12px;color:#666">${inv.taxLabel||'Tax'} ${inv.taxRate}%</td><td style="text-align:right;padding:4px 14px;font-size:12px;color:#333">${inv.currency} ${fmtN(inv.tax)}</td></tr>`:''}
        <tr><td colspan="2"></td>
          <td style="text-align:right;padding:12px 14px;font-size:13px;font-weight:900;color:#111;border-top:2px solid ${pc}">TOTAL</td>
          <td style="text-align:right;padding:12px 14px;font-size:18px;font-weight:900;color:${pc};border-top:2px solid ${pc}">${inv.currency} ${fmtN(inv.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}


// ─── Template: Letterhead (Al Khadim tax invoice) ──────────────────────────
const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl2br = (v: any) => esc(v).replace(/\n/g, '<br/>');

/** Small line icons for the letterhead contact list (Lucide paths). */
const ICON: Record<string, string> = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
const icon = (name: string, size = 13) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#1f2937" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${ICON[name]}</svg>`;

function assetSrc(path?: string | null): string {
  if (!path) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${String(path).replace(/^\/+/, '').replace(/"/g, '')}`;
}

function docTitle(inv: PrintInvoice, d: InvoiceDesignOptions): string {
  if (d.docTitle) return d.docTitle;
  if (inv.docType === 'QUOTATION') return 'QUOTATION';
  if (inv.docType === 'PROFORMA_INVOICE') return 'PROFORMA INVOICE';
  return inv.taxRate > 0 ? 'TAX INVOICE' : 'INVOICE';
}

/** The decorative band at the top and bottom of the letterhead: dark bar with a lighter slanted piece. */
function band(pc: string, light: string, height: number, content = '') {
  return `<div style="position:relative;height:${height}px;background:${pc};overflow:hidden">
    <div style="position:absolute;left:14%;top:0;bottom:0;width:13%;background:${light};transform:skewX(-35deg);opacity:.85"></div>
    <div style="position:absolute;left:0;top:0;bottom:0;width:17%;background:${pc}"></div>
    ${content ? `<div style="position:relative;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;letter-spacing:.4px;text-transform:uppercase">${content}</div>` : ''}
  </div>`;
}

function templateLetterhead(inv: PrintInvoice, pc: string): string {
  const d = normalizeDesign(inv.designOptions);
  const L = (k: keyof InvoiceDesignOptions['labels']) => esc(fillLabel(d.labels[k], { currency: inv.currency, rate: inv.taxRate }));
  const c = d.columns;
  const df = inv.dateFormat;
  const name = inv.fromName || 'Company Name';
  const addrLines = String(inv.fromAddress || '').split('\n').map(x => x.trim().replace(/,+$/, '')).filter(Boolean);
  const officeLine = addrLines.join(', ');
  const city = addrLines.slice(-1)[0] || '';
  const rate = Number(inv.taxRate) || 0;
  const td = 'border:1px solid #111;padding:6px 7px;vertical-align:middle';

  // Header: logo + name on the left, contact list on the right.
  const logo = inv.logoUrl
    ? `<img src="${assetSrc(inv.logoUrl)}" alt="" style="width:118px;height:118px;object-fit:contain;border-radius:50%"/>`
    : `<div style="width:96px;height:96px;border-radius:50%;background:${pc};color:#fff;font-size:34px;font-weight:800;line-height:96px;text-align:center">${esc((inv.logoText || name[0] || '?').toUpperCase())}</div>`;
  const contacts = [
    inv.fromPhone && ['phone', inv.fromPhone],
    inv.fromWebsite && ['globe', inv.fromWebsite],
    inv.fromEmail && ['mail', inv.fromEmail],
    inv.fromEmailAlt && ['mail', inv.fromEmailAlt],
  ].filter(Boolean) as [string, string][];

  const header = !inv.showHeader ? '' : `
  <div style="padding:38px 52px 0">
    ${band(pc, d.bandColor, 22)}
    <table width="100%" style="margin-top:16px"><tr>
      <td style="vertical-align:middle;width:58%">
        <table><tr>
          <td style="padding-right:18px">${logo}</td>
          <td style="font-size:30px;font-weight:800;color:${pc};letter-spacing:.5px;text-transform:uppercase">${esc(name)}</td>
        </tr></table>
      </td>
      <td style="vertical-align:middle;text-align:right">
        ${contacts.map(([i, v]) => `<div style="font-size:14px;font-weight:700;color:#111;line-height:1.75">${icon(i)}&nbsp;&nbsp;${esc(v)}</div>`).join('')}
        ${officeLine ? `<div style="font-size:13px;font-weight:700;color:#111;margin-top:8px">${icon('pin')}&nbsp;Office: ${esc(officeLine)}</div>` : ''}
      </td>
    </tr></table>
    <div style="height:2px;background:${pc};margin-top:10px;opacity:.85"></div>
  </div>`;

  // Item table columns.
  const cols: { key: string; label: string; width?: number; align: string }[] = [];
  if (c.slNo) cols.push({ key: 'slNo', label: L('slNo'), width: 46, align: 'center' });
  cols.push({ key: 'description', label: L('description'), align: 'left' });
  if (c.period) cols.push({ key: 'fromDate', label: L('fromDate'), width: 62, align: 'center' }, { key: 'toDate', label: L('toDate'), width: 58, align: 'center' });
  if (c.qty) cols.push({ key: 'qty', label: L('qty'), width: 28, align: 'center' });
  if (c.rate) cols.push({ key: 'rate', label: L('rate'), width: 48, align: 'right' });
  if (c.amount) cols.push({ key: 'amount', label: L('amount'), width: 66, align: 'right' });
  if (c.vat) cols.push({ key: 'vat', label: L('vat'), width: 58, align: 'right' });
  if (c.total) cols.push({ key: 'total', label: L('total'), width: 80, align: 'right' });

  const rows = inv.items.map((it, i) => {
    const amount = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
    const vat = amount * rate / 100;
    const cell: Record<string, string> = {
      slNo: String(i + 1),
      description: nl2br(it.description),
      fromDate: it.fromDate ? fmtDate(String(it.fromDate), df) : '',
      toDate: it.toDate ? fmtDate(String(it.toDate), df) : '',
      qty: it.qty && Number(it.qty) !== 1 ? `${it.qty}${it.unit ? ' ' + esc(it.unit) : ''}` : (it.unit ? `1 ${esc(it.unit)}` : ''),
      rate: Number(it.qty) !== 1 ? fmtN(it.unitPrice) : '',
      amount: fmtN(amount),
      vat: rate ? fmtN(vat) : '',
      total: fmtN(d.lineTotalIncludesVat ? amount + vat : amount),
    };
    return `<tr>${cols.map(col => `<td style="${td};text-align:${col.align};height:44px">${cell[col.key]}</td>`).join('')}</tr>`;
  }).join('');

  const n = cols.length;
  const labelSpan = Math.min(3, Math.max(1, n - 2));
  const wordsSpan = Math.max(1, n - labelSpan - 1);
  const discountAmt = inv.discount > 0 ? (inv.discountType === 'PERCENT' ? inv.subtotal * inv.discount / 100 : inv.discount) : 0;
  const totalsRows: [string, string, boolean][] = [
    ...(discountAmt > 0 ? [['Gross Amount', fmtN(inv.subtotal), false], ['Discount', `- ${fmtN(discountAmt)}`, false]] as [string, string, boolean][] : []),
    [L('subtotal'), fmtN(inv.subtotal - discountAmt), false],
    ...(rate ? [[L('vatLine'), fmtN(inv.tax), false] as [string, string, boolean]] : []),
    [L('grandTotal'), fmtN(inv.totalAmount), true],
  ];
  const words = d.amountInWords ? `${esc(inv.currency)}: ${esc(amountInWords(inv.totalAmount, d.currencyMajor, d.currencyMinor))}` : '';
  const totals = totalsRows.map(([label, value, strong], i) => `<tr>
      ${i === 0 ? `<td colspan="${wordsSpan}" rowspan="${totalsRows.length}" style="${td};text-align:center;font-weight:700;font-size:12.5px">${words}</td>` : ''}
      <td colspan="${labelSpan}" style="border:1px solid #111;padding:3px 7px;text-align:center;font-size:12px">${label}</td>
      <td style="border:1px solid #111;padding:3px 7px;text-align:right;font-size:12px;${strong ? 'font-weight:800' : ''}">${value}</td>
    </tr>`).join('');

  const dueDate = inv.dueDate || inv.validUntil || '';
  const metaRow = (label: string, value: string) => value
    ? `<tr><td style="padding:1px 0;font-size:12px;width:120px">${label}</td><td style="padding:1px 0 1px 12px;font-size:12px">${esc(value)}</td></tr>` : '';
  const bankLines = [
    inv.bankAccountName && `<div style="font-weight:700">${esc(inv.bankAccountName)}</div>`,
    inv.bankName && `<div><b>BANK NAME:</b>&nbsp;&nbsp;&nbsp;<b>${esc(inv.bankName)}</b></div>`,
    inv.bankAccount && `<div><b>Account No.</b>&nbsp;&nbsp;&nbsp;<b>${esc(inv.bankAccount)}</b></div>`,
    inv.bankIBAN && `<div><b>IBAN:</b>&nbsp;&nbsp;<b>${esc(inv.bankIBAN)}</b></div>`,
    inv.bankSwift && `<div><b>SWIFT CODE:</b> <b>${esc(inv.bankSwift)}</b></div>`,
    inv.bankBranch && `<div><b>Branch:</b>&nbsp;&nbsp;&nbsp;<b>${esc(inv.bankBranch)}</b></div>`,
  ].filter(Boolean).join('');
  const paymentNote = d.paymentNote || inv.paymentRef || '';
  const stamp = d.stampUrl
    ? `<img src="${assetSrc(d.stampUrl)}" alt="" style="max-width:190px;max-height:140px;object-fit:contain;display:block;margin:0 auto"/>`
    : `<div style="width:190px;border-top:1px solid #555;margin:60px auto 0"></div>`;

  return `
  ${header}
  <div style="margin:22px 52px 0;border:1.5px solid #111;font-size:12.5px;color:#111">
    ${d.showBoxContacts ? `<div style="text-align:right;padding:5px 6px 0;font-size:11px;line-height:1.45">
      ${inv.fromPhone ? `<div>M : ${esc(inv.fromPhone)}</div>` : ''}
      ${officeLine ? `<div style="font-weight:700">Office : ${esc(officeLine)}</div>` : ''}
      ${inv.fromEmail ? `<div style="font-weight:700">${esc(inv.fromEmail)}</div>` : ''}
    </div>` : ''}
    <div style="text-align:center;font-weight:800;font-size:13px;padding:${d.showBoxContacts ? '10px' : '16px'} 0 4px">${esc(docTitle(inv, d))}</div>
    ${d.showTrn && inv.fromTaxNo ? `<div style="text-align:center;font-weight:800;font-size:12.5px;padding-bottom:6px">TRN: ${esc(inv.fromTaxNo)}</div>` : ''}

    <table width="100%" style="border-top:1.5px solid #111">
      <tr>
        <td style="width:61%;vertical-align:top;padding:4px 6px 8px">
          <div style="font-weight:800;text-decoration:underline;margin-bottom:3px">${L('customer')}</div>
          <table width="100%">
            <tr><td style="width:70px;vertical-align:top;padding:1px 0">${L('name')} :</td><td style="padding:1px 0">${esc(inv.billingName || '')}</td></tr>
            <tr><td style="vertical-align:top;padding:1px 0">${L('address')} :</td><td style="padding:1px 0;line-height:1.5">${nl2br(inv.billingAddress || '')}</td></tr>
            <tr><td style="padding:6px 0 1px">${L('tel')}:</td><td style="padding:6px 0 1px">${esc(inv.billingPhone || '')}</td></tr>
            <tr><td style="padding:1px 0">${L('trn')}:</td><td style="padding:1px 0">${esc(inv.billingTaxNo || '')}</td></tr>
          </table>
        </td>
        <td style="vertical-align:top;border-left:1.5px solid #111;padding:4px 8px 8px">
          <div style="font-weight:800">${esc(name)}</div>
          ${city ? `<div style="font-weight:700;margin-bottom:10px">${esc(city)}</div>` : '<div style="height:10px"></div>'}
          <table>
            ${metaRow(L('invoiceNo'), inv.invoiceNo)}
            ${metaRow(L('invoiceDate'), fmtDate(inv.issueDate, df))}
            ${metaRow(L('paymentTerms'), inv.paymentTerms || '')}
            ${dueDate ? `<tr><td colspan="2" style="height:14px"></td></tr>${metaRow(L('dueDate'), fmtDate(dueDate, df))}` : ''}
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" style="border-top:1.5px solid #111;table-layout:auto">
      <thead><tr>${cols.map(col => `<th style="border:1px solid #111;padding:5px 6px;font-size:12px;font-weight:800;text-align:center${col.width ? `;width:${col.width}px` : ''}">${col.label}</th>`).join('')}</tr></thead>
      <tbody>${rows}${totals}</tbody>
    </table>

    <div style="padding:14px 4px 10px;line-height:1.5">
      ${inv.notes || d.noteHeading ? `<div style="font-weight:800;text-decoration:underline">${esc(d.noteHeading)}</div>` : ''}
      ${inv.notes ? `<div style="margin-bottom:16px">${nl2br(inv.notes)}</div>` : ''}
      ${paymentNote ? `<div style="margin-bottom:14px">${esc(paymentNote)}</div>` : ''}
      <table width="100%"><tr>
        <td style="vertical-align:top;padding-left:14px;width:52%;line-height:1.6">
          ${bankLines}
          ${d.showReceivedBy ? `<div style="font-weight:800;margin:46px 0 0 50px">${esc(d.receivedByLabel)}</div>` : ''}
        </td>
        <td style="vertical-align:bottom;text-align:center">
          ${stamp}
          ${d.stampUrl ? '' : `<div style="font-size:11px;margin-top:4px">${esc(d.signatoryLabel)}<br/>${esc(name)}</div>`}
        </td>
      </tr></table>
      ${inv.terms ? `<div style="margin-top:12px;font-size:10.5px;color:#444;white-space:pre-line">${esc(inv.terms)}</div>` : ''}
    </div>
  </div>`;
}

function letterheadFooter(inv: PrintInvoice, pc: string): string {
  if (!inv.showFooter) return '';
  const d = normalizeDesign(inv.designOptions);
  return `<div style="margin-top:auto;padding:24px 52px 34px">${band(pc, d.bandColor, 40, esc(inv.footerText || ''))}</div>`;
}

// ─── Bank + Terms + Footer ──────────────────────────────────────────────────
function bankAndTerms(inv: PrintInvoice, pc: string): string {
  const hasBankDetails = inv.bankName || inv.bankIBAN || inv.bankAccount;
  return `
  ${hasBankDetails ? `
  <div style="margin:0 ${inv.template==='minimal'?'56px':'40px'};padding:16px 20px;background:#f9f9fb;border-radius:8px;border:1px solid #eee;margin-bottom:20px">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${pc};margin-bottom:10px">Payment Details</div>
    <table style="border-collapse:collapse">
      ${inv.bankName     ?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0;min-width:100px">Bank</td><td style="font-size:11px;color:#333;font-weight:500">${inv.bankName}</td></tr>`:''}
      ${inv.bankAccount  ?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0">Account No.</td><td style="font-size:11px;color:#333;font-family:monospace">${inv.bankAccount}</td></tr>`:''}
      ${inv.bankIBAN     ?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0">IBAN</td><td style="font-size:11px;color:#333;font-family:monospace">${inv.bankIBAN}</td></tr>`:''}
      ${inv.bankSwift    ?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0">SWIFT/BIC</td><td style="font-size:11px;color:#333;font-family:monospace">${inv.bankSwift}</td></tr>`:''}
      ${inv.bankRoutingNo?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0">Routing No.</td><td style="font-size:11px;color:#333;font-family:monospace">${inv.bankRoutingNo}</td></tr>`:''}
      ${inv.bankSortCode ?`<tr><td style="font-size:11px;color:#888;font-weight:600;padding:3px 20px 3px 0">Sort Code</td><td style="font-size:11px;color:#333;font-family:monospace">${inv.bankSortCode}</td></tr>`:''}
    </table>
    ${inv.paymentRef?`<div style="font-size:11px;color:#888;font-style:italic;margin-top:8px">${inv.paymentRef}</div>`:''}
  </div>` : ''}

  ${inv.terms ? `
  <div style="margin:0 ${inv.template==='minimal'?'56px':'40px'};padding:14px 20px;border-left:3px solid ${pc}20;margin-bottom:20px">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:6px">Terms & Conditions</div>
    <div style="font-size:11px;color:#888;line-height:1.7;white-space:pre-line">${inv.terms}</div>
  </div>` : ''}

  ${inv.notes ? `
  <div style="margin:0 ${inv.template==='minimal'?'56px':'40px'};padding:12px 16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;margin-bottom:20px">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;margin-bottom:4px">Notes</div>
    <div style="font-size:11px;color:#92400e">${inv.notes}</div>
  </div>` : ''}

  ${inv.showSignature ? `
  <div style="margin:0 ${inv.template==='minimal'?'56px':'40px'};padding:20px;display:flex;gap:48px;margin-bottom:20px">
    <div style="flex:1;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:11px;color:#888">Authorised Signature</div>
    <div style="flex:1;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:11px;color:#888">Client Signature</div>
  </div>` : ''}`;
}

function footer(inv: PrintInvoice, pc: string): string {
  const text = inv.footerText || `Thank you for your business · ${inv.fromName||''}`;
  return inv.showFooter ? `
  <div style="background:${pc};padding:14px 40px;text-align:center;margin-top:auto">
    <div style="font-size:11px;color:${isDark(pc)?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.5)'}">
      ${text}
    </div>
  </div>` : '';
}

function watermarkOverlay(inv: PrintInvoice): string {
  if (!inv.watermark) return '';
  const op = (inv.watermarkOpacity || 12) / 100;
  return `
  <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
    font-size:96px;font-weight:900;color:rgba(0,0,0,${op});
    letter-spacing:6px;text-transform:uppercase;pointer-events:none;white-space:nowrap;
    z-index:0;user-select:none">
    ${inv.watermark}
  </div>`;
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function buildPrintHTML(inv: PrintInvoice): string {
  const pc   = inv.primaryColor  || '#6366f1';
  const ac   = inv.accentColor   || '#ffffff';
  const font = FONT_STACK[inv.fontFamily || 'helvetica'] || FONT_STACK.helvetica;
  const tmpl = inv.template || 'classic';

  const letterhead = tmpl === 'letterhead';
  let body = '';
  if      (letterhead)           body = templateLetterhead(inv, pc);
  else if (tmpl === 'modern')    body = templateModern(inv, pc, ac, font);
  else if (tmpl === 'minimal')   body = templateMinimal(inv, pc, ac, font);
  else if (tmpl === 'corporate') body = templateCorporate(inv, pc, ac, font);
  else                           body = templateClassic(inv, pc, ac, font);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${inv.invoiceNo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#fff;font-family:${font};font-size:13px;color:#333;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:0;size:A4}
    @media print{html,body{width:210mm;min-height:297mm}}
    table{border-collapse:collapse}
  </style>
</head>
<body style="position:relative;min-height:100vh;display:flex;flex-direction:column">
  ${watermarkOverlay(inv)}
  <div style="position:relative;z-index:1;flex:1">
    ${body}
    ${letterhead ? '' : bankAndTerms(inv, pc)}
  </div>
  ${letterhead ? letterheadFooter(inv, pc) : footer(inv, pc)}
</body>
</html>`;
}
