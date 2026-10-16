'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import {
  COLUMN_KEYS, DEFAULT_DESIGN, DEFAULT_LABELS, LABEL_KEYS, formatInvoiceNumber, normalizeDesign,
  type ColumnKey, type InvoiceDesignOptions, type LabelKey,
} from '@/lib/invoiceDesign';

const COLUMN_NAMES: Record<ColumnKey, string> = {
  slNo: 'Serial number', description: 'Description', period: 'From / To dates', qty: 'Quantity',
  rate: 'Rate', amount: 'Amount', vat: 'VAT per line', total: 'Line total',
};
const LABEL_NAMES: Record<LabelKey, string> = {
  slNo: 'Serial no. column', description: 'Description column', fromDate: 'From date column', toDate: 'To date column',
  qty: 'Quantity column', rate: 'Rate column', amount: 'Amount column', vat: 'VAT column', total: 'Line total column',
  customer: 'Customer heading', name: 'Customer name', address: 'Customer address', tel: 'Customer phone', trn: 'Customer TRN',
  invoiceNo: 'Invoice number', invoiceDate: 'Invoice date', paymentTerms: 'Payment terms', dueDate: 'Due date',
  subtotal: 'Taxable total', vatLine: 'VAT line', grandTotal: 'Grand total',
};

const NUMBER_PRESETS = [
  { label: 'System default (INV-2026-0001)', value: '' },
  { label: '0019/09/26-27 (Al Khadim)', value: '{SEQ:4}/{MM}/{FY}' },
  { label: 'AK/26-27/0019', value: 'AK/{FY}/{SEQ:4}' },
  { label: 'INV-2026-09-0019', value: '{PREFIX}-{YYYY}-{MM}-{SEQ:4}' },
];

const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button type="button" onClick={() => onChange(!checked)}
        className={`mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative ${checked ? 'bg-primary-400' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span>
        <span className="block text-sm text-gray-700">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Layout options stored as `designOptions`: title, columns, labels, amount in
 * words, stamp, payment note and invoice-number format. Used by the invoice
 * builder and the template studio.
 */
export default function DesignOptionsPanel({ value, onChange, letterhead, currency, taxRate }: {
  value: any; onChange: (v: InvoiceDesignOptions) => void; letterhead: boolean; currency: string; taxRate: number;
}) {
  const d = normalizeDesign(value);
  const set = <K extends keyof InvoiceDesignOptions>(k: K, v: InvoiceDesignOptions[K]) => onChange({ ...d, [k]: v });
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadStamp(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      fd.append('makeDefault', 'false');
      const { data } = await api.post('/invoices/logo', fd);
      set('stampUrl', data.logoUrl);
      toast.success('Stamp uploaded');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  let numberExample = '';
  try { numberExample = d.numberFormat ? formatInvoiceNumber(d.numberFormat, Math.max(1, d.numberStart), new Date()) : 'INV-2026-0001'; } catch { /* invalid while typing */ }

  return (
    <div className="space-y-4">
      {/* Document */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700">Document & numbering</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Title, invoice-number format and tax-number line.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Document title</label>
            <input value={d.docTitle} onChange={e => set('docTitle', e.target.value)} placeholder="Automatic (TAX INVOICE / QUOTATION…)" className={input} />
          </div>
          <div className="flex items-end pb-1">
            <Toggle checked={d.showTrn} onChange={v => set('showTrn', v)} label="Show TRN under the title" hint="Uses your Tax / TRN number" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Invoice number format</label>
            <select value={NUMBER_PRESETS.some(p => p.value === d.numberFormat) ? d.numberFormat : '__custom'}
              onChange={e => e.target.value !== '__custom' && set('numberFormat', e.target.value)} className={input}>
              {NUMBER_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              <option value="__custom">Custom…</option>
            </select>
            <input value={d.numberFormat} onChange={e => set('numberFormat', e.target.value)} placeholder="{SEQ:4}/{MM}/{FY}"
              className={`${input} mt-2 font-mono text-xs`} />
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Tokens: <code>{'{SEQ:4}'}</code> sequence (padded), <code>{'{MM}'}</code> month, <code>{'{YYYY}'}</code>/<code>{'{YY}'}</code> year,
              <code> {'{FY}'}</code> financial year (Apr–Mar), <code>{'{PREFIX}'}</code>. The sequence restarts each year / financial year.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Start numbering from</label>
            <input type="number" min={1} value={d.numberStart} onChange={e => set('numberStart', Math.max(1, Number(e.target.value) || 1))} className={input} disabled={!d.numberFormat} />
            <p className="text-[11px] text-gray-400 mt-1">Continue an existing sequence, e.g. 19 if 18 invoices were already issued.</p>
            <p className="text-xs mt-2">Next number looks like: <span className="font-mono font-bold text-gray-800">{numberExample || '—'}</span></p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-700">Item table</h3>
          {!letterhead && <p className="text-[11px] text-amber-600 mt-0.5">Columns and labels apply to the Letterhead layout.</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {COLUMN_KEYS.filter(k => k !== 'description').map(k => (
            <Toggle key={k} checked={d.columns[k]} onChange={v => set('columns', { ...d.columns, [k]: v })} label={COLUMN_NAMES[k]}
              hint={k === 'qty' || k === 'rate' ? 'Left blank on single-unit lines' : undefined} />
          ))}
        </div>
        <Toggle checked={d.lineTotalIncludesVat} onChange={v => set('lineTotalIncludesVat', v)} label="Line total includes VAT"
          hint="Off: the line total repeats the amount before VAT" />

        <button type="button" onClick={() => setLabelsOpen(o => !o)} className="flex items-center gap-1.5 text-xs font-bold text-primary-500">
          <ChevronDown size={13} className={`transition-transform ${labelsOpen ? 'rotate-180' : ''}`} /> Rename labels
        </button>
        {labelsOpen && (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400"><code>{'{currency}'}</code> and <code>{'{rate}'}</code> are replaced, e.g. “Amount {'{currency}'}” → “Amount {currency}”.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {LABEL_KEYS.map(k => (
                <div key={k}>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{LABEL_NAMES[k]}</label>
                  <input value={d.labels[k]} onChange={e => set('labels', { ...d.labels, [k]: e.target.value })} placeholder={DEFAULT_LABELS[k]} className={`${input} py-1.5 text-xs`} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set('labels', { ...DEFAULT_LABELS })} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
              <RotateCcw size={11} /> Reset labels
            </button>
          </div>
        )}
      </div>

      {/* Totals, notes, signature */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-700">Totals, notes & signature</h3>
        <Toggle checked={d.amountInWords} onChange={v => set('amountInWords', v)} label="Amount in words"
          hint={`e.g. “${currency}: ${d.currencyMajor || 'Dirham'} One Hundred Only”`} />
        {d.amountInWords && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Currency word</label>
              <input value={d.currencyMajor} onChange={e => set('currencyMajor', e.target.value)} placeholder="Dirham" className={input} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Sub-unit word</label>
              <input value={d.currencyMinor} onChange={e => set('currencyMinor', e.target.value)} placeholder="Fils" className={input} />
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Note heading</label>
            <input value={d.noteHeading} onChange={e => set('noteHeading', e.target.value)} placeholder="Note" className={input} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Line above bank details</label>
            <input value={d.paymentNote} onChange={e => set('paymentNote', e.target.value)} placeholder="Payment to be made by online transfer at below" className={input} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-3">
          <label className="block text-xs font-bold text-gray-500 mb-2">Stamp / signature image</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-32 h-20 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {d.stampUrl ? <img src={`/${d.stampUrl}`} alt="Stamp" className="max-h-[72px] max-w-[120px] object-contain" /> : <span className="text-[10px] text-gray-400">No stamp</span>}
            </div>
            <label className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer bg-primary-400 text-white hover:bg-primary-500 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {d.stampUrl ? 'Change' : 'Upload stamp'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadStamp(f); e.target.value = ''; }} />
            </label>
            {d.stampUrl && <button type="button" onClick={() => set('stampUrl', '')} className="text-xs font-semibold text-gray-500 hover:text-red-500">Remove</button>}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">A photo or scan of your company stamp. Without one, a signature line is printed.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Signatory label</label>
            <input value={d.signatoryLabel} onChange={e => set('signatoryLabel', e.target.value)} className={input} />
          </div>
          <div className="space-y-2">
            <Toggle checked={d.showReceivedBy} onChange={v => set('showReceivedBy', v)} label="“Received By” area" />
            {d.showReceivedBy && <input value={d.receivedByLabel} onChange={e => set('receivedByLabel', e.target.value)} className={input} />}
          </div>
        </div>
      </div>

      {letterhead && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Letterhead</h3>
          <div className="flex items-center gap-3">
            <input type="color" value={d.bandColor} onChange={e => set('bandColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            <div>
              <p className="text-sm text-gray-700">Band accent colour</p>
              <p className="text-[11px] text-gray-400">The lighter slanted stripe in the header and footer bands (the dark part uses the brand colour).</p>
            </div>
          </div>
          <Toggle checked={d.showBoxContacts} onChange={v => set('showBoxContacts', v)} label="Repeat contacts in the box’s top-right corner" />
          <button type="button" onClick={() => onChange({ ...DEFAULT_DESIGN, stampUrl: d.stampUrl, numberFormat: d.numberFormat, numberStart: d.numberStart })}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
            <RotateCcw size={11} /> Reset layout options (keeps stamp and numbering)
          </button>
        </div>
      )}
    </div>
  );
}
