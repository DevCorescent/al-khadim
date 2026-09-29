'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Star, Trash2, Pencil, FilePlus2, LayoutTemplate, Check, X } from 'lucide-react';

const DOC_LABELS: Record<string, string> = { INVOICE: 'Invoice', PROFORMA_INVOICE: 'Proforma', QUOTATION: 'Quotation' };

export default function InvoiceTemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', description: '' });

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
      setEditing(null);
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

  return (
    <div className="w-full p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push('/admin/crm/invoices')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <div className="mr-auto">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Templates</h1>
          <p className="text-xs text-gray-400 mt-0.5">Reusable sender, bank, terms and design settings. Each new document still gets its own number.</p>
        </div>
        <button onClick={() => router.push('/admin/crm/invoices/new?type=INVOICE')}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl">
          <FilePlus2 size={15} /> New invoice
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !templates.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <LayoutTemplate size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No templates yet</p>
          <p className="text-xs text-gray-400 mt-1">Open any invoice in the builder and click <strong>Save as template</strong>.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {templates.map((t: any) => {
            const d = t.data || {};
            const itemCount = d.items?.length || 0;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
                <div className="h-2" style={{ background: d.primaryColor || '#6366f1' }} />
                <div className="p-4 flex-1 space-y-2">
                  {editing === t.id ? (
                    <div className="space-y-2">
                      <input autoFocus value={draft.name} maxLength={100} onChange={e => setDraft(x => ({ ...x, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      <input value={draft.description} maxLength={500} placeholder="Description" onChange={e => setDraft(x => ({ ...x, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                      <div className="flex gap-1.5">
                        <button onClick={() => update.mutate({ id: t.id, patch: draft })} disabled={!draft.name.trim() || update.isPending}
                          className="flex items-center gap-1 text-xs font-bold bg-primary-400 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"><Check size={12} /> Save</button>
                        <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 px-2 py-1.5"><X size={12} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900">{t.name}</p>
                        {t.isDefault && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                            <Star size={10} /> Default
                          </span>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                    </>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-gray-500">
                    {d.docType && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{DOC_LABELS[d.docType] || d.docType}</span>}
                    {d.template && <span className="bg-gray-100 px-2 py-0.5 rounded-full capitalize">{d.template} layout</span>}
                    {d.currency && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{d.currency}</span>}
                    {d.taxRate ? <span className="bg-gray-100 px-2 py-0.5 rounded-full">{d.taxLabel || 'Tax'} {d.taxRate}%</span> : null}
                    {itemCount > 0 && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{itemCount} line item{itemCount === 1 ? '' : 's'}</span>}
                    {d.logoUrl && <span className="bg-gray-100 px-2 py-0.5 rounded-full">Logo</span>}
                  </div>
                  {d.fromName && <p className="text-[11px] text-gray-400">From: {d.fromName}</p>}
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
                  <button title={t.isDefault ? 'Stop using as default' : 'Use automatically for new documents'}
                    onClick={() => update.mutate({ id: t.id, patch: { isDefault: !t.isDefault } })}
                    className={`p-2 rounded-xl hover:bg-amber-50 ${t.isDefault ? 'text-amber-500' : 'text-gray-400'}`}><Star size={14} /></button>
                  <button title="Rename" onClick={() => { setEditing(t.id); setDraft({ name: t.name, description: t.description || '' }); }}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700"><Pencil size={14} /></button>
                  <button title="Duplicate" onClick={() => duplicate.mutate(t.id)} disabled={duplicate.isPending}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"><Copy size={14} /></button>
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
