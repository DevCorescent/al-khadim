'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ClipboardCheck, Plus, Save, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react';

interface Item { id?: string; title: string; description: string; dueInDays: string }

const SUGGESTIONS = [
  { title: 'Trade Licence', description: 'Valid copy, all pages', dueInDays: '7' },
  { title: 'VAT Registration Certificate', description: '', dueInDays: '7' },
  { title: 'Memorandum of Association', description: '', dueInDays: '14' },
  { title: 'Emirates ID of Authorised Signatory', description: 'Front and back', dueInDays: '7' },
  { title: 'Signed Service Agreement', description: '', dueInDays: '14' },
];

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30';

export default function OnboardingDocumentsPage() {
  const qc = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [autoApply, setAutoApply] = useState(true);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-documents'],
    queryFn: () => api.get('/onboarding-documents').then(r => r.data),
  });

  useEffect(() => {
    if (!data) return;
    setAutoApply(data.autoApply);
    setItems(data.items.map((i: any) => ({ id: i.id, title: i.title, description: i.description || '', dueInDays: i.dueInDays ? String(i.dueInDays) : '' })));
    setDirty(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/onboarding-documents', {
      autoApply,
      items: items.map(i => ({ id: i.id, title: i.title, description: i.description, dueInDays: i.dueInDays || null })),
    }),
    onSuccess: (r) => {
      qc.setQueryData(['onboarding-documents'], r.data);
      toast.success('Onboarding checklist saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  function update(i: number, patch: Partial<Item>) {
    setItems(list => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    setDirty(true);
  }
  function add(item: Item = { title: '', description: '', dueInDays: '' }) {
    setItems(list => [...list, item]);
    setDirty(true);
  }
  function remove(i: number) {
    setItems(list => list.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function move(i: number, by: number) {
    setItems(list => {
      const next = [...list];
      const j = i + by;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  const have = new Set(items.map(i => i.title.trim().toLowerCase()));
  const unused = SUGGESTIONS.filter(s => !have.has(s.title.toLowerCase()));

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Onboarding Documents</h1>
            <p className="text-xs text-gray-400">Business documents every new client must upload through the company portal</p>
          </div>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending || isLoading || !dirty}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2 disabled:opacity-60">
          <Save size={14} />{save.isPending ? 'Saving…' : 'Save Checklist'}
        </button>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="grid grid-cols-[1fr_1.4fr_110px_auto] gap-2 text-[10px] font-bold uppercase text-gray-400 px-1">
            <span>Document *</span><span>Instructions for the company</span><span>Due in (days)</span><span />
          </div>
          {items.map((it, i) => (
            <div key={it.id || i} className="grid grid-cols-[1fr_1.4fr_110px_auto] gap-2 items-center">
              <input className={INPUT} value={it.title} placeholder="e.g. Trade Licence" onChange={e => update(i, { title: e.target.value })} />
              <input className={INPUT} value={it.description} placeholder="Optional" onChange={e => update(i, { description: e.target.value })} />
              <input className={INPUT} type="number" min={1} max={365} value={it.dueInDays} placeholder="None"
                onChange={e => update(i, { dueInDays: e.target.value })} />
              <div className="flex items-center">
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={13} /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down" className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={13} /></button>
                <button onClick={() => remove(i)} title="Remove" className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {!items.length && !isLoading && (
            <p className="text-sm text-gray-400 py-6 text-center">No documents yet. Add your first one below, or pick a suggestion.</p>
          )}
          <button onClick={() => add()} className="flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:underline">
            <Plus size={14} /> Add document
          </button>
        </section>

        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={autoApply} onChange={e => { setAutoApply(e.target.checked); setDirty(true); }}
                className="w-4 h-4 mt-0.5 rounded accent-primary-500" />
              <span>
                <span className="block text-sm font-bold text-gray-800">Request automatically for new clients</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  When a client is added, approved after self-registration, or created from an enquiry, these documents are requested and the company is emailed.
                </span>
              </span>
            </label>
          </section>

          {unused.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-bold text-gray-900">Common documents</h2>
              <div className="flex flex-wrap gap-2">
                {unused.map(s => (
                  <button key={s.title} onClick={() => add({ ...s })}
                    className="flex items-center gap-1 text-xs font-semibold border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-primary-300 hover:text-primary-600">
                    <Plus size={11} /> {s.title}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-xs text-gray-500 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>Changes apply to new clients. For an existing client, open it and use <strong>Apply onboarding checklist</strong> on its Documents tab. Documents it was already asked for are skipped.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
