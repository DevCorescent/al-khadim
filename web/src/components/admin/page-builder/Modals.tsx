'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookmarkPlus, Eye, History, Loader2, RotateCcw, Save, X } from 'lucide-react';
import api from '@/lib/api';
import { inputCls } from './controls';

function Shell({ title, icon, onClose, children, width = 'max-w-lg' }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div data-pb-modal role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[300] grid place-items-center bg-gray-950/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${width} rounded-2xl bg-white shadow-2xl overflow-hidden`}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-teal-50 text-teal-700">{icon}</span>
          <p className="font-bold text-gray-900 flex-1">{title}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fmt = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function RevisionsModal({ pageId, onClose, onRestore, onSnapshot }: {
  pageId: string; onClose: () => void; onRestore: (revId: string) => Promise<void>; onSnapshot: (label: string) => Promise<void>;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pb-revisions', pageId],
    queryFn: () => api.get(`/pages/${pageId}/revisions`).then(r => r.data as { id: string; label: string | null; title: string; createdAt: string; by: string | null }[]),
  });
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Shell title="Version history" icon={<History size={16} />} onClose={onClose} width="max-w-xl">
      <div className="p-5 space-y-4">
        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); setBusy('snap'); try { await onSnapshot(label.trim() || 'Manual save'); setLabel(''); await refetch(); } finally { setBusy(null); } }}>
          <input className={`${inputCls} h-9 flex-1`} placeholder="Name this version (optional), e.g. Before Ramadan campaign" value={label} onChange={e => setLabel(e.target.value)} />
          <button type="submit" disabled={busy === 'snap'} className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-teal-700 text-white text-[12.5px] font-semibold hover:bg-teal-800 disabled:opacity-60">
            {busy === 'snap' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save version
          </button>
        </form>
        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {isLoading && <div className="py-10 grid place-items-center text-gray-400"><Loader2 className="animate-spin" /></div>}
          {data && !data.length && <p className="text-center text-sm text-gray-400 py-10">No saved versions yet. Versions are created when you publish, save a named version, or restore.</p>}
          {data?.map(r => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 hover:border-gray-300">
              <span className={`w-2 h-2 rounded-full shrink-0 ${r.label === 'Published' ? 'bg-emerald-500' : r.label === 'Before restore' ? 'bg-amber-500' : 'bg-teal-600'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{r.label || 'Saved version'}</p>
                <p className="text-[11px] text-gray-500">{fmt(r.createdAt)}{r.by ? ` · ${r.by}` : ''}</p>
              </div>
              <a href={`/page-preview/${pageId}?rev=${r.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-gray-200 text-[11.5px] font-semibold text-gray-600 hover:bg-gray-50"><Eye size={12} /> View</a>
              <button type="button" disabled={!!busy} onClick={async () => {
                if (!window.confirm('Replace the current draft with this version? The current draft is kept in history.')) return;
                setBusy(r.id);
                try { await onRestore(r.id); onClose(); } finally { setBusy(null); }
              }} className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-900 text-white text-[11.5px] font-semibold hover:bg-gray-700 disabled:opacity-50">
                {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function SaveBlockModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, category: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Saved');
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Save section as a block" icon={<BookmarkPlus size={16} />} onClose={onClose}>
      <form className="p-5 space-y-3" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; setBusy(true); try { await onSave(name.trim(), category.trim()); onClose(); } finally { setBusy(false); } }}>
        <p className="text-[12.5px] text-gray-500">Saved blocks appear under Blocks → Saved and can be dropped into any page.</p>
        <label className="block"><span className="text-[12px] font-semibold text-gray-700">Name</span><input autoFocus className={`${inputCls} h-9 mt-1`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Contact band with form" /></label>
        <label className="block"><span className="text-[12px] font-semibold text-gray-700">Category</span><input className={`${inputCls} h-9 mt-1`} value={category} onChange={e => setCategory(e.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-700 text-white text-[13px] font-semibold disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save block</button>
        </div>
      </form>
    </Shell>
  );
}

export function ConflictModal({ by, onReload, onOverwrite, onClose }: { by?: string | null; onReload: () => void; onOverwrite: () => void; onClose: () => void }) {
  return (
    <Shell title="This page changed elsewhere" icon={<AlertTriangle size={16} />} onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-[13px] text-gray-600 leading-relaxed">
          {by ? <><b>{by}</b> saved this page</> : 'This page was saved in another tab or by someone else'} after you opened it. Autosave is paused so nobody’s work is lost.
        </p>
        <div className="grid gap-2">
          <button type="button" onClick={onReload} className="h-10 rounded-lg bg-teal-700 text-white text-[13px] font-semibold hover:bg-teal-800">Load their latest version (discard my unsaved changes)</button>
          <button type="button" onClick={onOverwrite} className="h-10 rounded-lg border border-red-200 text-red-700 text-[13px] font-semibold hover:bg-red-50">Keep mine and overwrite theirs</button>
        </div>
        <p className="text-[11px] text-gray-400">Either way, the overwritten version can be recovered from Version history if it was published or saved as a version.</p>
      </div>
    </Shell>
  );
}
