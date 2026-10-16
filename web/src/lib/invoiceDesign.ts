/**
 * Invoice layout options that go beyond the invoice's own design columns:
 * document title, column labels and visibility, amount in words, stamp,
 * payment note and number format. Stored as `designOptions` (JSON) on an
 * invoice and inside a template's data. Isomorphic: used by the print engine,
 * the builder and the API's validation.
 */

export const COLUMN_KEYS = ['slNo', 'description', 'period', 'qty', 'rate', 'amount', 'vat', 'total'] as const;
export type ColumnKey = typeof COLUMN_KEYS[number];

export const LABEL_KEYS = [
  // table
  'slNo', 'description', 'fromDate', 'toDate', 'qty', 'rate', 'amount', 'vat', 'total',
  // header block
  'customer', 'name', 'address', 'tel', 'trn', 'invoiceNo', 'invoiceDate', 'paymentTerms', 'dueDate',
  // totals
  'subtotal', 'vatLine', 'grandTotal',
] as const;
export type LabelKey = typeof LABEL_KEYS[number];

export interface InvoiceDesignOptions {
  /** Title printed on the document; empty uses the document type ("TAX INVOICE" on the letterhead). */
  docTitle: string;
  /** Prints "TRN: <your tax number>" under the title. */
  showTrn: boolean;
  labels: Record<LabelKey, string>;
  columns: Record<ColumnKey, boolean>;
  /** A line's total column includes its VAT (otherwise it repeats the amount before VAT). */
  lineTotalIncludesVat: boolean;
  amountInWords: boolean;
  currencyMajor: string;
  currencyMinor: string;
  noteHeading: string;
  /** Line above the bank details, e.g. "Payment to be made by online transfer at below". */
  paymentNote: string;
  /** Uploaded stamp / signature image (uploads/images/…). */
  stampUrl: string;
  signatoryLabel: string;
  showReceivedBy: boolean;
  receivedByLabel: string;
  /** Letterhead: second (lighter) colour of the header and footer bands. */
  bandColor: string;
  /** Letterhead: repeat contact details in the top-right corner of the bordered box. */
  showBoxContacts: boolean;
  /** Invoice number pattern, e.g. "{SEQ:4}/{MM}/{FY}"; empty keeps the system default. */
  numberFormat: string;
  /** Lowest sequence number to issue (continue numbering from another system). */
  numberStart: number;
  /** Date format used when printing (DD/MM/YYYY, DD-MM-YYYY, …); empty uses the layout default. */
  dateFormat: string;
}

export const DEFAULT_LABELS: Record<LabelKey, string> = {
  slNo: 'Sl. No.', description: 'Summary', fromDate: 'From Date', toDate: 'To Date', qty: 'Qty',
  rate: 'Rate', amount: 'Amount {currency}', vat: 'VAT', total: 'Total Amount',
  customer: 'Customer Details', name: 'Name', address: 'Address', tel: 'Tel No', trn: 'TRN',
  invoiceNo: 'Tax Invoice No.', invoiceDate: 'Tax Invoice Date', paymentTerms: 'Payment Terms', dueDate: 'Due Date',
  subtotal: 'Total', vatLine: 'VAT {rate}% On Taxable Amount', grandTotal: 'Total Amount',
};

export const DEFAULT_DESIGN: InvoiceDesignOptions = {
  docTitle: '',
  showTrn: true,
  labels: { ...DEFAULT_LABELS },
  columns: { slNo: true, description: true, period: true, qty: true, rate: true, amount: true, vat: true, total: true },
  lineTotalIncludesVat: true,
  amountInWords: true,
  currencyMajor: 'Dirham',
  currencyMinor: 'Fils',
  noteHeading: 'Note',
  paymentNote: '',
  stampUrl: '',
  signatoryLabel: 'Authorized Signatory',
  showReceivedBy: true,
  receivedByLabel: 'Received By',
  bandColor: '#5FA8C6',
  showBoxContacts: true,
  numberFormat: '',
  numberStart: 1,
  dateFormat: '',
};

const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

/** Stored (possibly partial or older) options merged over the defaults. */
export function normalizeDesign(raw: any): InvoiceDesignOptions {
  const v = isObj(raw) ? raw : {};
  return {
    ...DEFAULT_DESIGN,
    ...v,
    labels: { ...DEFAULT_LABELS, ...(isObj(v.labels) ? v.labels : {}) },
    columns: { ...DEFAULT_DESIGN.columns, ...(isObj(v.columns) ? v.columns : {}) },
  };
}

/**
 * Server-side cleaning: known keys only, typed, length-capped. `imageOk` checks
 * the stamp path (only uploaded images are printed into invoice HTML).
 */
export function cleanDesign(raw: any, imageOk: (path: string) => boolean): InvoiceDesignOptions | null {
  if (raw === undefined || raw === null) return null;
  if (!isObj(raw)) throw Object.assign(new Error('designOptions must be an object'), { status: 400 });
  const d = normalizeDesign(raw);
  const text = (s: any, max = 300) => (typeof s === 'string' ? s.slice(0, max) : '');
  const out: InvoiceDesignOptions = {
    docTitle: text(d.docTitle, 80),
    showTrn: !!d.showTrn,
    labels: Object.fromEntries(LABEL_KEYS.map(k => [k, text(d.labels[k], 80) || DEFAULT_LABELS[k]])) as any,
    columns: Object.fromEntries(COLUMN_KEYS.map(k => [k, d.columns[k] !== false])) as any,
    lineTotalIncludesVat: !!d.lineTotalIncludesVat,
    amountInWords: !!d.amountInWords,
    currencyMajor: text(d.currencyMajor, 30),
    currencyMinor: text(d.currencyMinor, 30),
    noteHeading: text(d.noteHeading, 60),
    paymentNote: text(d.paymentNote, 300),
    stampUrl: text(d.stampUrl, 200),
    signatoryLabel: text(d.signatoryLabel, 80),
    showReceivedBy: !!d.showReceivedBy,
    receivedByLabel: text(d.receivedByLabel, 60),
    bandColor: /^#[0-9a-f]{6}$/i.test(d.bandColor) ? d.bandColor : DEFAULT_DESIGN.bandColor,
    showBoxContacts: !!d.showBoxContacts,
    numberFormat: text(d.numberFormat, 60),
    numberStart: Number.isFinite(Number(d.numberStart)) ? Math.min(1e9, Math.max(1, Math.floor(Number(d.numberStart)))) : 1,
    dateFormat: /^(DD|MM|YYYY|MMM)[\/\- ](DD|MM|MMM)[\/\- ](DD|YYYY)$/.test(String(d.dateFormat)) ? d.dateFormat : '',
  };
  out.columns.description = true; // a line without a description is meaningless
  if (out.stampUrl && !imageOk(out.stampUrl)) throw Object.assign(new Error('Invalid stamp image'), { status: 400 });
  if (out.numberFormat && !/\{SEQ(:\d)?\}/.test(out.numberFormat)) {
    throw Object.assign(new Error('The number format must include {SEQ} (or {SEQ:4} for zero-padding)'), { status: 400 });
  }
  return out;
}

/** Fills {currency} / {rate} in a label. */
export function fillLabel(label: string, vars: { currency?: string; rate?: number | string }) {
  return String(label || '')
    .replace(/\{currency\}/gi, vars.currency ?? '')
    .replace(/\{rate\}/gi, vars.rate !== undefined ? String(vars.rate) : '');
}

/* ─── Amount in words ───────────────────────────────────────────────────── */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function under1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '')); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const groups: string[] = [];
  for (let i = 0; n > 0 && i < SCALES.length; i++, n = Math.floor(n / 1000)) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${under1000(chunk)}${SCALES[i] ? ` ${SCALES[i]}` : ''}`);
  }
  return groups.join(' ');
}

/** "Dirham Two Hundred Twenty Six and Twenty Fils Only" */
export function amountInWords(amount: number, major = 'Dirham', minor = 'Fils'): string {
  const total = Math.round((Number(amount) || 0) * 100);
  const whole = Math.floor(total / 100), cents = total % 100;
  const head = `${major ? `${major} ` : ''}${numberToWords(whole)}`;
  return `${head}${cents ? ` and ${numberToWords(cents)}${minor ? ` ${minor}` : ''}` : ''} Only`;
}

/* ─── Invoice number formats ────────────────────────────────────────────── */

/** UAE / India style financial year (April–March) as "26-27". */
export function financialYear(d: Date): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(y % 100).padStart(2, '0')}-${String((y + 1) % 100).padStart(2, '0')}`;
}

function dateTokens(d: Date): Record<string, string> {
  return {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear() % 100).padStart(2, '0'),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    FY: financialYear(d),
  };
}

/** Formats a number pattern: {SEQ}, {SEQ:4}, {YYYY}, {YY}, {MM}, {DD}, {FY}, {PREFIX}. */
export function formatInvoiceNumber(pattern: string, seq: number, date: Date, prefix = 'INV'): string {
  const t = { ...dateTokens(date), PREFIX: prefix };
  return pattern
    .replace(/\{SEQ(?::(\d))?\}/g, (_m, pad) => String(seq).padStart(Number(pad || 0), '0'))
    .replace(/\{(YYYY|YY|MM|DD|FY|PREFIX)\}/g, (_m, k) => (t as any)[k]);
}

/**
 * A regular expression matching numbers this pattern produces in the current
 * numbering period, with the sequence captured. Year tokens ({YYYY}, {YY},
 * {FY}) are fixed to `date`, so the sequence restarts each year / financial
 * year; month and day tokens match any value, so it runs on across months.
 */
export function invoiceNumberRegex(pattern: string, date: Date, prefix = 'INV'): string {
  const t = { ...dateTokens(date), PREFIX: prefix };
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = '';
  let rest = pattern;
  const re = /\{(SEQ(?::\d)?|YYYY|YY|MM|DD|FY|PREFIX)\}/;
  for (let m = rest.match(re); m; m = rest.match(re)) {
    out += esc(rest.slice(0, m.index));
    out += m[1].startsWith('SEQ') ? '(\\d+)' : m[1] === 'MM' || m[1] === 'DD' ? '\\d{2}' : esc((t as any)[m[1]]);
    rest = rest.slice((m.index || 0) + m[0].length);
  }
  return `^${out}${esc(rest)}$`;
}
