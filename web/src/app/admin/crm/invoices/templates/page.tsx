'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Copy, Download, FilePlus2, LayoutTemplate, Pencil, Plus, Search, Star, Trash2, Upload,
} from 'lucide-react';
import PrintPreview from '../_components/PrintPreview';
import { formatInvoiceNumber, normalizeDesign } from '@/lib/invoiceDesign';

const DOC_LABELS: Record<string, string> = { INVOICE: 'Invoice', PROFORMA_INVOICE: 'Proforma', QUOTATION: 'Quotation' };
const LAYOUTS: Record<string, string> = { letterhead: 'Letterhead', classic: 'Classic', modern: 'Modern', minimal: 'Minimal', corporate: 'Corporate' };

/** A template's data rendered with sample customer and lines, for the card thumbnail. */
function sampleInvoice(d: any) {
  const items = d.items?.length ? d.items : [
    { description: 'Sample service — monthly manpower supply', qty: 1, unitPrice: 1500 },
    { description: 'Sample service charges', qty: 1, unitPrice: 150 },
  ];
  const subtotal = items.reduce((s: number, i: any) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const rate = Number(d.taxRate) || 0;
  const design = normalizeDesign(d.designOptions);
  const today = new Date().toISOString().split('T')[0];
  return {
    ...d,
    invoiceNo: design.numberFormat ? formatInvoiceNumber(design.numberFormat, design.numberStart, new Date()) : 'INV-0001',
    status: 'DRAFT', currency: d.currency || 'AED', issueDate: today, dueDate: today,
    billingName: 'Sample Customer LLC', billingAddress: 'Office 1201, Business Bay\nDubai, UAE',
    items: items.map((i: any) => ({ ...i, total: (Number(i.qty) || 0) * (Number(i.unitPrice) || 0) })),
    subtotal, discount: 0, discountType: 'FIXED', taxRate: rate, tax: subtotal * rate / 100, totalAmount: subtotal * (1 + rate / 100),
  };
}

export default function InvoiceTemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['invoice-templates'],
    queryFn: () => api.get('/invoice-templates').then(r => r.data as any[]),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['invoice-templates'] });
  const onError = (e: any) => toast.error(e.response?.data?.error || 'Something went wrong');

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => api.put(`/invoice-templates/${id}`, patch),
    onSuccess: (_r, { patch }) => {
      toast.success(patch.isDefault === true ? 'Set as default template' : patch.isDefault === false ? 'Default removed' : 'Template updated');
      refresh();
    },
    onError,
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => api.post(`/invoice-templates/${id}/duplicate`),
    onSuccess: (r) => { toast.success(`Duplicated as "${r.data.name}"`); refresh(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/invoice-templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); refresh(); },
    onError,
  });

  function exportTemplate(t: any) {
    const blob = new Blob([JSON.stringify({ kind: 'al-khadim/invoice-template', name: t.name, description: t.description, data: t.data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importTemplate(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw?.data || typeof raw.data !== 'object') throw new Error('This file is not an invoice template');
      const taken = new Set(templates.map((t: any) => t.name));
      let name = String(raw.name || 'Imported template').slice(0, 90);
      for (let i = 2; taken.has(name); i++) name = `${String(raw.name || 'Imported template').slice(0, 85)} (${i})`;
      const { data } = await api.post('/invoice-templates', { name, description: raw.description || '', data: raw.data });
      toast.success(`Imported "${data.name}"`);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Could not import that file');
    }
  }

  const shown = templates.filter((t: any) => !q || `${t.name} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="w-full p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push('/admin/crm/invoices')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <div className="mr-auto">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Templates</h1>
          <p className="text-xs text-gray-400 mt-0.5">Design reusable layouts with your letterhead, bank details, terms, numbering and stamp. Each new document still gets its own number.</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates"
            className="border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 w-48" />
        </div>
        <button onClick={() => importRef.current?.click()}
          className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50">
          <Upload size={15} /> Import
        </button>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importTemplate(f); }} />
        <button onClick={() => router.push('/admin/crm/invoices/templates/new')}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl">
          <Plus size={15} /> New template
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !templates.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <LayoutTemplate size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No templates yet</p>
          <p className="text-xs text-gray-400 mt-1">Create one with <strong>New template</strong>, or click <strong>Save as template</strong> in any invoice.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {shown.map((t: any) => {
            const d = t.data || {};
            return (
              <div key={t.id} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-xl hover:border-primary-200 transition-all">
                <button onClick={() => router.push(`/admin/crm/invoices/templates/${t.id}`)} title="Edit template"
                  className="relative block bg-gray-100 px-6 pt-5 h-64 overflow-hidden text-left">
                  <PrintPreview invoice={sampleInvoice(d)} className="pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-100 to-transparent" />
                  <span className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 shadow text-xs font-bold text-gray-700 px-2.5 py-1 rounded-lg">
                    <Pencil size={11} /> Edit
                  </span>
                </button>
                <div className="p-4 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900">{t.name}</p>
                    {t.isDefault && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                        <Star size={10} /> Default
                      </span>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>}
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-gray-500">
                    {d.docType && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{DOC_LABELS[d.docType] || d.docType}</span>}
                    {d.template && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{LAYOUTS[d.template] || d.template} layout</span>}
                    {d.currency && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{d.currency}</span>}
                    {d.taxRate ? <span className="bg-gray-100 px-2 py-0.5 rounded-full">{d.taxLabel || 'Tax'} {d.taxRate}%</span> : null}
                    {d.items?.length > 0 && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{d.items.length} line item{d.items.length === 1 ? '' : 's'}</span>}
                    {d.designOptions?.numberFormat && <span className="bg-gray-100 px-2 py-0.5 rounded-full font-mono">{d.designOptions.numberFormat}</span>}
                  </div>
                  <p className="text-[10px] text-gray-300">
                    Updated {new Date(t.updatedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {t.createdBy?.name && <> · by {t.createdBy.name}</>}
                  </p>
                </div>
                <div className="border-t border-gray-100 p-2 flex items-center gap-1">
                  <button onClick={() => router.push(`/admin/crm/invoices/new?template=${t.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-bold bg-primary-400 hover:bg-primary-500 text-white py-2 rounded-xl">
                    <FilePlus2 size={12} /> Use
                  </button>
                  <button title="Edit" onClick={() => router.push(`/admin/crm/invoices/templates/${t.id}`)}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700"><Pencil size={14} /></button>
                  <button title={t.isDefault ? 'Stop using as default' : 'Use automatically for new documents'}
                    onClick={() => update.mutate({ id: t.id, patch: { isDefault: !t.isDefault } })}
                    className={`p-2 rounded-xl hover:bg-amber-50 ${t.isDefault ? 'text-amber-500' : 'text-gray-400'}`}><Star size={14} /></button>
                  <button title="Duplicate" onClick={() => duplicate.mutate(t.id)} disabled={duplicate.isPending}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"><Copy size={14} /></button>
                  <button title="Export as a file" onClick={() => exportTemplate(t)}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700"><Download size={14} /></button>
                  <button title="Delete" onClick={() => { if (confirm(`Delete the template "${t.name}"? Invoices already made from it are not affected.`)) remove.mutate(t.id); }}
                    className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
