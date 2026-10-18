/**
 * Invoice downloads: PDF and PNG are rendered from the exact print HTML (so
 * they match the preview), Word is built as a real editable .docx, Excel as a
 * workbook of the line items and totals, and HTML is the print document itself.
 * Heavy libraries are loaded on demand.
 */
import { amountInWords, fillLabel, normalizeDesign } from '@/lib/invoiceDesign';
import type { Paragraph as DocxParagraph, Table as DocxTable } from 'docx';
import { buildPrintHTML, docTitle, type PrintInvoice } from './printEngine';

export type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'png' | 'html';

const A4_W = 794;   // CSS px at 96 dpi
const A4_H = 1123;

const DOC_LABELS: Record<string, string> = { INVOICE: 'INVOICE', PROFORMA_INVOICE: 'PROFORMA INVOICE', QUOTATION: 'QUOTATION' };

/** The title the chosen layout prints (the letterhead adds "TAX" when VAT applies). */
function titleOf(inv: PrintInvoice): string {
  const d = normalizeDesign(inv.designOptions);
  if (inv.template === 'letterhead') return docTitle(inv, d);
  return d.docTitle || DOC_LABELS[inv.docType] || 'INVOICE';
}

const safeName = (s: string) => String(s || 'invoice').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
export const fileBase = (inv: PrintInvoice) => `${safeName(titleOf(inv).replace(/\s+/g, '-'))}_${safeName(inv.invoiceNo)}`;

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(iso?: string, fmt = 'DD/MM/YYYY') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return fmt.replace('DD', String(d.getDate()).padStart(2, '0'))
    .replace('MMM', d.toLocaleString('en-GB', { month: 'short' }))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('YYYY', String(d.getFullYear()));
}

const GENERIC_LABELS = {
  slNo: '#', description: 'Description', fromDate: 'From', toDate: 'To', qty: 'Qty', rate: 'Unit Price', amount: 'Amount',
  vat: 'VAT', total: 'Total', customer: 'Bill To', name: 'Name', address: 'Address', tel: 'Tel', trn: 'TRN',
  invoiceNo: 'Number', invoiceDate: 'Issue Date', paymentTerms: 'Payment Terms', dueDate: 'Due Date',
  subtotal: 'Subtotal', vatLine: 'VAT ({rate}%)', grandTotal: 'Total',
};

/**
 * Wording and columns for the file: the letterhead uses its own design
 * options (labels, column switches, amount in words); the other layouts
 * use plain invoice wording and the columns they print.
 */
function layoutOf(inv: PrintInvoice) {
  const d = normalizeDesign(inv.designOptions);
  const letterhead = inv.template === 'letterhead';
  const rate = Number(inv.taxRate) || 0;
  const raw: Record<string, string> = letterhead ? d.labels : { ...GENERIC_LABELS, ...(inv.docType === 'QUOTATION' ? { invoiceNo: 'Quotation No.' } : { invoiceNo: 'Invoice No.' }) };
  const L = (k: keyof typeof d.labels) => fillLabel(raw[k] ?? d.labels[k], { currency: inv.currency, rate });
  const columns = letterhead ? d.columns : { slNo: true, description: true, period: inv.items.some(i => i.fromDate || i.toDate), qty: true, rate: true, amount: true, vat: false, total: false };
  return { d, letterhead, rate, L, columns, words: letterhead && d.amountInWords, lineTotalIncludesVat: d.lineTotalIncludesVat };
}

function totals(inv: PrintInvoice) {
  const discount = inv.discount > 0 ? (inv.discountType === 'PERCENT' ? inv.subtotal * inv.discount / 100 : inv.discount) : 0;
  return { discount, taxable: inv.subtotal - discount, tax: inv.tax, total: inv.totalAmount };
}

/* ─── Rendering the print HTML to canvas ────────────────────────────────── */

/** Renders the print document off-screen and returns one canvas per A4 page. */
async function renderPages(inv: PrintInvoice, scale = 2): Promise<HTMLCanvasElement[]> {
  const html2canvas = (await import('html2canvas')).default;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${A4_W}px;height:${A4_H}px;border:0;visibility:hidden`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(buildPrintHTML(inv));
    doc.close();
    await new Promise(r => (doc.readyState === 'complete' ? r(null) : frame.addEventListener('load', () => r(null), { once: true })));
    const imgs = Array.from(doc.images);
    await Promise.race([
      Promise.all(imgs.map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })))),
      new Promise(r => setTimeout(r, 4000)),
    ]);
    await (doc as any).fonts?.ready?.catch?.(() => {});
    await new Promise(r => setTimeout(r, 150));

    const total = Math.max(A4_H, doc.documentElement.scrollHeight);
    // Places a page may end without cutting through a line: below table rows and blocks.
    const breaks = Array.from(doc.querySelectorAll('tr, p, h1, h2, h3, li, body > div > div, table'))
      .map(el => Math.round((el as HTMLElement).getBoundingClientRect().bottom))
      .filter(y => y > 0 && y < total)
      .sort((a, b) => a - b);

    const full = await html2canvas(doc.body, {
      scale, useCORS: true, backgroundColor: '#ffffff', logging: false,
      width: A4_W, height: total, windowWidth: A4_W, windowHeight: total,
    });

    const pages: HTMLCanvasElement[] = [];
    let start = 0;
    while (start < total - 2) {
      let end = Math.min(total, start + A4_H);
      if (end < total) {
        const ok = breaks.filter(b => b > start + A4_H * 0.5 && b <= end);
        if (ok.length) end = ok[ok.length - 1];
      }
      const page = document.createElement('canvas');
      page.width = A4_W * scale;
      page.height = A4_H * scale;
      const ctx = page.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.drawImage(full, 0, start * scale, A4_W * scale, (end - start) * scale, 0, 0, A4_W * scale, (end - start) * scale);
      pages.push(page);
      start = end;
    }
    return pages;
  } finally {
    frame.remove();
  }
}

async function exportPdf(inv: PrintInvoice) {
  const { jsPDF } = await import('jspdf');
  const pages = await renderPages(inv, 2.5);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.setProperties({ title: `${titleOf(inv)} ${inv.invoiceNo}`, subject: inv.subject || '', author: inv.fromName || '', creator: 'Al Khadim' });
  pages.forEach((c, i) => {
    if (i) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });
  pdf.save(`${fileBase(inv)}.pdf`);
}

async function exportPng(inv: PrintInvoice) {
  const pages = await renderPages(inv, 2);
  // One tall image with all pages stacked.
  const out = document.createElement('canvas');
  out.width = pages[0].width;
  out.height = pages.reduce((h, p) => h + p.height, 0);
  const ctx = out.getContext('2d')!;
  let y = 0;
  for (const p of pages) { ctx.drawImage(p, 0, y); y += p.height; }
  const blob = await new Promise<Blob>(r => out.toBlob(b => r(b!), 'image/png'));
  save(blob, `${fileBase(inv)}.png`);
}

function exportHtml(inv: PrintInvoice) {
  // Make relative image paths absolute so the file works when opened locally.
  const html = buildPrintHTML(inv).replace(/src="\/(?!\/)/g, `src="${window.location.origin}/`);
  save(new Blob([html], { type: 'text/html;charset=utf-8' }), `${fileBase(inv)}.html`);
}

/* ─── Excel ─────────────────────────────────────────────────────────────── */

async function exportXlsx(inv: PrintInvoice) {
  const XLSX = await import('xlsx');
  const { d, L, rate, columns: c, words } = layoutOf(inv);
  const fmt = inv.dateFormat || d.dateFormat || 'DD/MM/YYYY';
  const t = totals(inv);

  const rows: any[][] = [
    [titleOf(inv)],
    [],
    ['From', inv.fromName || ''], ['TRN', inv.fromTaxNo || ''],
    ['Bill to', inv.billingName || ''], ['Address', inv.billingAddress || ''], ['Customer TRN', inv.billingTaxNo || ''],
    [L('invoiceNo'), inv.invoiceNo], [L('invoiceDate'), fmtDate(inv.issueDate, fmt)],
    ...(inv.dueDate ? [[L('dueDate'), fmtDate(inv.dueDate, fmt)]] : []),
    ...(inv.paymentTerms ? [[L('paymentTerms'), inv.paymentTerms]] : []),
    ['Currency', inv.currency],
    [],
  ];
  type XCol = { label: string; wch: number; money?: boolean; get: (it: PrintInvoice['items'][number], i: number, amount: number) => any };
  const cols: XCol[] = [];
  if (c.slNo) cols.push({ label: L('slNo'), wch: 7, get: (_, i) => i + 1 });
  if (c.description) cols.push({ label: L('description'), wch: 46, get: it => it.description });
  if (c.period) cols.push({ label: L('fromDate'), wch: 12, get: it => fmtDate(it.fromDate || undefined, fmt) }, { label: L('toDate'), wch: 12, get: it => fmtDate(it.toDate || undefined, fmt) });
  if (c.qty) cols.push({ label: L('qty'), wch: 8, get: it => Number(it.qty) || 0 });
  if (c.rate) cols.push({ label: L('rate'), wch: 13, money: true, get: it => Number(it.unitPrice) || 0 });
  if (c.amount) cols.push({ label: L('amount'), wch: 15, money: true, get: (_, __, a) => a });
  if (c.vat) cols.push({ label: L('vat'), wch: 12, money: true, get: (_, __, a) => a * rate / 100 });
  if (c.total) cols.push({ label: L('total'), wch: 16, money: true, get: (_, __, a) => (layoutOf(inv).lineTotalIncludesVat ? a * (1 + rate / 100) : a) });
  // Totals sit in the last two columns.
  const n = Math.max(cols.length, 2);
  const tot = (label: string, v: number) => [...Array(n - 2).fill(''), label, v];
  rows.push(cols.map(x => x.label));
  const first = rows.length;
  inv.items.forEach((it, i) => {
    const amount = Number(it.total) || (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
    rows.push(cols.map(x => x.get(it, i, amount)));
  });
  rows.push([]);
  if (t.discount > 0) rows.push(tot('Gross amount', inv.subtotal), tot('Discount', -t.discount));
  rows.push(tot(L('subtotal'), t.taxable));
  if (rate > 0 || t.tax) rows.push(tot(L('vatLine'), t.tax));
  rows.push(tot(`${L('grandTotal')} (${inv.currency})`, t.total));
  if (words) rows.push([], [`${inv.currency}: ${amountInWords(inv.totalAmount, d.currencyMajor, d.currencyMinor)}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = cols.map((x, i) => ({ wch: i === n - 2 ? Math.max(x.wch, 26) : x.wch }));
  // Money format for amounts in the item rows and the totals column.
  for (let r = first; r < rows.length; r++) {
    for (let col = 0; col < n; col++) {
      const ref = XLSX.utils.encode_cell({ r, c: col });
      const isMoney = r < first + inv.items.length ? cols[col]?.money : col === n - 1;
      if (isMoney && ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0.00';
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
  XLSX.writeFile(wb, `${fileBase(inv)}.xlsx`);
}

/* ─── Word ──────────────────────────────────────────────────────────────── */

async function fetchImage(path?: string | null): Promise<{ data: ArrayBuffer; type: 'png' | 'jpg'; w: number; h: number } | null> {
  if (!path) return null;
  try {
    const url = /^https?:/i.test(path) ? path : `${window.location.origin}/${String(path).replace(/^\/+/, '')}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Re-encode as PNG (handles webp/svg) and read the natural size.
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    const png = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'));
    return { data: await png.arrayBuffer(), type: 'png', w: bmp.width, h: bmp.height };
  } catch {
    return null;
  }
}

async function exportDocx(inv: PrintInvoice) {
  const D = await import('docx');
  const {
    AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
    TableRow, TextRun, VerticalAlign, WidthType,
  } = D;
  const { d, L, rate, columns, words, letterhead } = layoutOf(inv);
  const fmt = inv.dateFormat || d.dateFormat || 'DD/MM/YYYY';
  const pc = (inv.primaryColor || '#0F5468').replace('#', '').slice(0, 6).toUpperCase();
  const t = totals(inv);
  const font = 'Calibri';
  // Content width of an A4 page with 0.625" margins, in twentieths of a point.
  const PAGE = 11906 - 900 * 2;
  const dxa = (pct: number, of = PAGE) => Math.round((pct / 100) * of);
  /** Fixed-layout table: Word, Google Docs, LibreOffice and Quick Look all honour explicit column widths. */
  const table = (pcts: number[], rows: any[], o: { widthPct?: number; borders?: any; align?: any } = {}) => {
    const total = dxa(o.widthPct ?? 100);
    return new Table({
      rows, borders: o.borders, alignment: o.align, layout: TableLayoutType.FIXED,
      width: { size: total, type: WidthType.DXA },
      columnWidths: pcts.map(p => dxa(p, total)),
    });
  };

  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: 'D9DEE3' };
  const grid = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };

  const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
    new TextRun({ text, font, size: (o.size ?? 10) * 2, bold: o.bold, color: o.color, italics: o.italics });
  const para = (children: any[] | string, o: { align?: any; after?: number; before?: number } = {}) =>
    new Paragraph({ children: typeof children === 'string' ? [run(children)] : children, alignment: o.align, spacing: { after: o.after ?? 40, before: o.before ?? 0 } });
  const lines = (text?: string, o: { size?: number; color?: string; align?: any } = {}) =>
    String(text || '').split('\n').filter(Boolean).map(l => para([run(l, { size: o.size ?? 9.5, color: o.color ?? '444444' })], { align: o.align, after: 0 }));
  const cell = (children: DocxParagraph[], o: { width?: number; shade?: string; align?: any; borders?: any; margins?: boolean } = {}) =>
    new TableCell({
      children: children.length ? children : [para('')],
      width: o.width != null ? { size: o.width, type: WidthType.DXA } : undefined,
      shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      borders: o.borders,
      margins: o.margins === false ? undefined : { top: 70, bottom: 70, left: 100, right: 100 },
    });
  const kv = (k: string, v?: string) => (v ? [para([run(`${k}: `, { bold: true, size: 9.5, color: '222222' }), run(v, { size: 9.5, color: '444444' })], { after: 0 })] : []);

  /* Header: company | document title */
  const logo = await fetchImage(inv.logoUrl);
  const left: DocxParagraph[] = [];
  if (logo) {
    const h = 56, w = Math.min(200, Math.round(logo.w * h / logo.h));
    left.push(new Paragraph({ children: [new ImageRun({ data: logo.data, type: 'png', transformation: { width: w, height: h } } as any)], spacing: { after: 80 } }));
  }
  left.push(para([run(inv.fromName || '', { bold: true, size: 15, color: pc })], { after: 40 }));
  left.push(...lines(inv.fromAddress));
  left.push(...lines([inv.fromPhone && `Tel: ${inv.fromPhone}`, inv.fromEmail, inv.fromEmailAlt, inv.fromWebsite].filter(Boolean).join('\n')));
  if (inv.fromTaxNo) left.push(...kv('TRN', inv.fromTaxNo));

  const right: DocxParagraph[] = [
    para([run(titleOf(inv), { bold: true, size: 20, color: pc })], { align: AlignmentType.RIGHT, after: 120 }),
    ...[
      [L('invoiceNo'), inv.invoiceNo], [L('invoiceDate'), fmtDate(inv.issueDate, fmt)],
      [L('dueDate'), fmtDate(inv.dueDate, fmt)], ['Valid until', fmtDate(inv.validUntil, fmt)], [L('paymentTerms'), inv.paymentTerms || ''],
    ].filter(([, v]) => v).map(([k, v]) => para([run(`${k}: `, { bold: true, size: 9.5 }), run(String(v), { size: 9.5, color: '444444' })], { align: AlignmentType.RIGHT, after: 20 })),
  ];

  const header = table([58, 42], [new TableRow({ children: [cell(left, { width: dxa(58), margins: false }), cell(right, { width: dxa(42), margins: false })] })], { borders: noBorders });

  /* Customer */
  const customer = table([100], [
      new TableRow({ children: [cell([para([run(L('customer'), { bold: true, color: 'FFFFFF' })], { after: 0 })], { shade: pc })] }),
      new TableRow({ children: [cell([
        para([run(inv.billingName || '', { bold: true, size: 11 })], { after: 20 }),
        ...lines(inv.billingAddress),
        ...kv(L('tel'), inv.billingPhone), ...kv('Email', inv.billingEmail), ...kv(L('trn'), inv.billingTaxNo),
      ])] }),
  ], { borders: grid });

  /* Items */
  const c = columns;
  type Col = { label: string; w: number; align: any; get: (it: PrintInvoice['items'][number], i: number) => string };
  const cols: Col[] = [];
  const amt = (it: PrintInvoice['items'][number]) => Number(it.total) || (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
  if (c.slNo) cols.push({ label: L('slNo'), w: 6, align: AlignmentType.CENTER, get: (_, i) => String(i + 1) });
  if (c.description) cols.push({ label: L('description'), w: 30, align: AlignmentType.LEFT, get: it => it.description || '' });
  if (c.period) cols.push(
    { label: L('fromDate'), w: 10, align: AlignmentType.CENTER, get: it => fmtDate(it.fromDate || undefined, fmt) },
    { label: L('toDate'), w: 10, align: AlignmentType.CENTER, get: it => fmtDate(it.toDate || undefined, fmt) },
  );
  if (c.qty) cols.push({ label: L('qty'), w: 6, align: AlignmentType.CENTER, get: it => String(it.qty ?? '') + (it.unit ? ` ${it.unit}` : '') });
  if (c.rate) cols.push({ label: L('rate'), w: 10, align: AlignmentType.RIGHT, get: it => money(it.unitPrice) });
  if (c.amount) cols.push({ label: L('amount'), w: 11, align: AlignmentType.RIGHT, get: it => money(amt(it)) });
  if (c.vat) cols.push({ label: L('vat'), w: 8, align: AlignmentType.RIGHT, get: it => money(amt(it) * rate / 100) });
  if (c.total) cols.push({ label: L('total'), w: 11, align: AlignmentType.RIGHT, get: it => money(d.lineTotalIncludesVat ? amt(it) * (1 + rate / 100) : amt(it)) });
  const sumW = cols.reduce((s, x) => s + x.w, 0) || 1;

  const pcts = cols.map(x => (x.w / sumW) * 100);
  const itemsTable = table(pcts, [
    new TableRow({ tableHeader: true, children: cols.map((x, k) => cell([para([run(x.label, { bold: true, size: 9, color: 'FFFFFF' })], { align: x.align, after: 0 })], { width: dxa(pcts[k]), shade: pc })) }),
    ...inv.items.map((it, i) => new TableRow({
      children: cols.map((x, k) => cell([para([run(x.get(it, i), { size: 9.5 })], { align: x.align, after: 0 })], { width: dxa(pcts[k]), shade: i % 2 ? 'F6F8FA' : undefined })),
    })),
  ], { borders: grid });

  /* Totals */
  const totalRows: [string, string, boolean][] = [
    ...(t.discount > 0 ? [['Gross amount', money(inv.subtotal), false], ['Discount', `- ${money(t.discount)}`, false]] as [string, string, boolean][] : []),
    [L('subtotal'), money(t.taxable), false],
    ...(rate > 0 || t.tax ? [[L('vatLine'), money(t.tax), false]] as [string, string, boolean][] : []),
    [`${L('grandTotal')} (${inv.currency})`, money(t.total), true],
  ];
  const tw = dxa(50);
  const totalsTable = table([62, 38], totalRows.map(([k, v, strong]) => new TableRow({ children: [
    cell([para([run(k, { bold: strong, size: strong ? 10.5 : 9.5, color: strong ? 'FFFFFF' : '333333' })], { after: 0 })], { width: dxa(62, tw), shade: strong ? pc : 'F6F8FA' }),
    cell([para([run(v, { bold: strong, size: strong ? 10.5 : 9.5, color: strong ? 'FFFFFF' : '333333' })], { align: AlignmentType.RIGHT, after: 0 })], { width: dxa(38, tw), shade: strong ? pc : undefined }),
  ] })), { widthPct: 50, borders: grid, align: AlignmentType.RIGHT });

  const body: (DocxParagraph | DocxTable)[] = [header, para('', { after: 160 }), customer, para('', { after: 120 })];
  if (inv.subject) body.push(para([run(inv.subject, { bold: true, size: 11 })], { after: 60 }));
  if (inv.description) body.push(...lines(inv.description), para('', { after: 80 }));
  body.push(itemsTable, para('', { after: 120 }), totalsTable);
  if (words) body.push(para([run(`${inv.currency}: `, { bold: true, size: 9.5 }), run(amountInWords(inv.totalAmount, d.currencyMajor, d.currencyMinor), { italics: true, size: 9.5 })], { before: 160, after: 120 }));

  const bank = [
    ['Account name', inv.bankAccountName], ['Bank', inv.bankName], ['Branch', inv.bankBranch], ['Account no.', inv.bankAccount],
    ['IBAN', inv.bankIBAN], ['SWIFT', inv.bankSwift], ['Routing no.', inv.bankRoutingNo], ['Sort code', inv.bankSortCode],
  ].filter(([, v]) => v) as [string, string][];
  if (bank.length) {
    body.push(para([run('Bank details', { bold: true, size: 10.5, color: pc })], { before: 160, after: 40 }));
    if (d.paymentNote) body.push(...lines(d.paymentNote));
    bank.forEach(([k, v]) => body.push(...kv(k, v)));
  }
  if (inv.terms) body.push(para([run('Terms & conditions', { bold: true, size: 10.5, color: pc })], { before: 160, after: 40 }), ...lines(inv.terms));
  if (inv.notes) body.push(para([run(d.noteHeading || 'Note', { bold: true, size: 10.5, color: pc })], { before: 160, after: 40 }), ...lines(inv.notes));

  /* Signatures */
  const stamp = await fetchImage(d.stampUrl);
  const showSigs = letterhead || !!stamp || inv.showSignature;
  const sigCell = (label: string, img?: typeof stamp) => !label && !img ? cell([para('')], { width: dxa(50), margins: false }) : cell([
    ...(img ? [new Paragraph({ children: [new ImageRun({ data: img.data, type: 'png', transformation: { width: Math.round(img.w * 70 / img.h), height: 70 } } as any)] })] : [para('', { after: 600 })]),
    para([run('______________________________', { color: '999999' })], { after: 0 }),
    para([run(label, { bold: true, size: 9.5 })], { after: 0 }),
  ], { width: dxa(50), margins: false });
  if (showSigs) body.push(para('', { after: 300 }), table([50, 50], [new TableRow({ children: [sigCell(d.showReceivedBy ? d.receivedByLabel : '', null), sigCell(d.signatoryLabel, stamp)] })], { borders: noBorders }));

  const document_ = new Document({
    creator: inv.fromName || 'Al Khadim',
    title: `${titleOf(inv)} ${inv.invoiceNo}`,
    styles: { default: { document: { run: { font, size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
      footers: inv.footerText || inv.fromName ? {
        default: new Footer({ children: [para([run(inv.footerText || [inv.fromName, inv.fromPhone, inv.fromEmail, inv.fromWebsite].filter(Boolean).join('  ·  '), { size: 8, color: '888888' })], { align: AlignmentType.CENTER })] }),
      } : undefined,
      children: body,
    }],
  });
  save(await Packer.toBlob(document_), `${fileBase(inv)}.docx`);
}

/* ─── Entry point ───────────────────────────────────────────────────────── */

export async function exportInvoice(inv: PrintInvoice, format: ExportFormat) {
  switch (format) {
    case 'pdf': return exportPdf(inv);
    case 'png': return exportPng(inv);
    case 'docx': return exportDocx(inv);
    case 'xlsx': return exportXlsx(inv);
    case 'html': return exportHtml(inv);
  }
}
