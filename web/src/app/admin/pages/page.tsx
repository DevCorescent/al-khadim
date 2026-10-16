'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Copy, ExternalLink, Eye, FileText, LayoutTemplate, Loader2, MoreHorizontal, PencilLine, Plus, Search, Trash2, Upload, UploadCloud, X, EyeOff,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PAGE_TEMPLATES } from '@/lib/pageBuilder/templates';
import { slugError, slugify } from '@/lib/pageBuilder/types';

interface PageRow {
  id: string; title: string; slug: string; status: string; publishedAt: string | null; updatedAt: string; createdAt: string;
  sections: number; hasUnpublishedChanges: boolean;
}

const ago = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TEMPLATE_ART: Record<string, string> = {
  blank: '', landing: '▇▇▇▇\n▂ ▂ ▂\n▆▆ ▆▆\n▇▇▇▇', about: '▇▇▇▇\n▆▆ ▂▂\n▂ ▂ ▂', services: '▆▆ ▇▇\n▂ ▂ ▂\n▃ ▇ ▃', contact: '▇▇▇▇\n▂▂ ▆▆\n▇▇▇▇', campaign: '▇▇▇▇\n▂▆▆▂\n▆▆ ▆▆',
};

function NewPageModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState('landing');
  const finalSlug = slugTouched ? slug : slugify(title);
  const err = title ? slugError(finalSlug) : null;
  const create = useMutation({
    mutationFn: () => api.post('/pages', { title, slug: finalSlug, template }).then(r => r.data),
    onSuccess: p => { qc.invalidateQueries({ queryKey: ['pb-pages'] }); router.push(`/admin/pages/${p.id}/edit`); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Could not create the page'),
  });
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-gray-950/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden" onSubmit={e => { e.preventDefault(); if (title.trim() && !err) create.mutate(); }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-lg">Create a page</p>
            <p className="text-[12.5px] text-gray-500">Pick a starting point — everything can be changed in the builder.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">Page title</span>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Healthcare Recruitment"
                className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20" />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">URL</span>
              <div className={`mt-1 flex h-10 rounded-lg border ${err ? 'border-red-300' : 'border-gray-200'} overflow-hidden focus-within:ring-2 focus-within:ring-teal-600/20`}>
                <span className="px-3 grid place-items-center text-sm text-gray-400 bg-gray-50 border-r border-gray-200">/</span>
                <input value={finalSlug} onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value) || e.target.value.toLowerCase()); }} placeholder="healthcare-recruitment" className="flex-1 min-w-0 px-3 text-sm font-mono outline-none" />
              </div>
              {err && <span className="text-[11px] text-red-600 mt-1 block">{err}</span>}
            </label>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-gray-700 mb-2">Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PAGE_TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                  className={`text-left rounded-xl border p-3 transition ${template === t.id ? 'border-teal-600 ring-2 ring-teal-600/20 bg-teal-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`h-16 rounded-lg mb-2.5 grid place-items-center text-[10px] leading-[1.15] whitespace-pre font-mono ${t.id === 'blank' ? 'border-2 border-dashed border-gray-200 text-gray-300' : 'bg-gradient-to-br from-[#0A3D4C] to-[#0F5468] text-white/70'}`}>
                    {t.id === 'blank' ? <Plus size={18} /> : TEMPLATE_ART[t.id]}
                  </div>
                  <p className="text-[12.5px] font-bold text-gray-800">{t.label}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={!title.trim() || !!err || create.isPending} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50">
            {create.isPending && <Loader2 size={15} className="animate-spin" />} Create & open builder
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PagesListPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const can = useAuth(s => s.can);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [menu, setMenu] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['pb-pages'], queryFn: () => api.get('/pages').then(r => r.data as PageRow[]) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['pb-pages'] });

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); } catch (e: any) { toast.error(e?.response?.data?.error || 'Something went wrong'); }
  };

  const pages = useMemo(() => (data || []).filter(p =>
    (filter === 'all' || p.status === filter) && (!q || `${p.title} ${p.slug}`.toLowerCase().includes(q.toLowerCase()))), [data, q, filter]);
  const counts = { all: data?.length || 0, published: data?.filter(p => p.status === 'published').length || 0, draft: data?.filter(p => p.status !== 'published').length || 0 };

  const importFile = async (f: File) => {
    try {
      const json = JSON.parse(await f.text());
      const doc = json?.doc ?? json;
      const title = String(json?.title || f.name.replace(/\.page\.json$|\.json$/i, '') || 'Imported page');
      const base = slugify(json?.slug || title) || 'imported-page';
      const taken = new Set((data || []).map(p => p.slug));
      let slug = base, i = 2;
      while (taken.has(slug)) slug = `${base}-${i++}`;
      const { data: p } = await api.post('/pages', { title, slug, doc });
      refresh();
      toast.success('Page imported');
      router.push(`/admin/pages/${p.id}/edit`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'That file is not a page export');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design landing pages, service pages and campaigns with the drag-and-drop builder. Published pages live at <span className="font-mono text-gray-700">/your-slug</span>.</p>
        </div>
        <div className="flex gap-2">
          {can('pages', 'create') && <>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"><Upload size={15} /> Import</button>
            <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 shadow-sm"><Plus size={16} /> New page</button>
          </>}
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex p-1 rounded-xl bg-white border border-gray-200">
          {(['all', 'published', 'draft'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`h-8 px-3.5 rounded-lg text-[12.5px] font-semibold capitalize transition ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {f} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages" className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 grid place-items-center text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : !pages.length ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <LayoutTemplate className="mx-auto text-teal-600 mb-3" size={34} />
          <p className="text-lg font-bold text-gray-800">{data?.length ? 'No pages match' : 'No pages yet'}</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">{data?.length ? 'Try a different search or filter.' : 'Create your first page from a template or a blank canvas.'}</p>
          {!data?.length && can('pages', 'create') && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold"><Plus size={16} /> New page</button>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(p => {
            const live = p.status === 'published';
            return (
              <div key={p.id} className="group relative rounded-2xl bg-white border border-gray-200 hover:border-teal-300 hover:shadow-lg transition overflow-hidden">
                <Link href={`/admin/pages/${p.id}/edit`} className="block">
                  <div className="h-28 bg-gradient-to-br from-[#0A3D4C] via-[#0F5468] to-[#061E26] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:16px_16px]" />
                    <div className="absolute left-5 right-5 top-6 space-y-2">
                      <span className="block h-2.5 w-2/3 rounded-full bg-white/80" />
                      <span className="block h-1.5 w-1/2 rounded-full bg-white/40" />
                      <div className="flex gap-1.5 pt-1"><span className="h-3 w-12 rounded bg-[#C6A15B]" /><span className="h-3 w-10 rounded bg-white/30" /></div>
                    </div>
                    <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold ${live ? (p.hasUnpublishedChanges ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') : 'bg-white/90 text-gray-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${live ? (p.hasUnpublishedChanges ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-400'}`} />
                      {live ? (p.hasUnpublishedChanges ? 'Live · edited' : 'Live') : 'Draft'}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-gray-900 truncate">{p.title}</p>
                    <p className="text-[12px] font-mono text-teal-700 truncate">/{p.slug}</p>
                    <p className="text-[11.5px] text-gray-500 mt-2">{p.sections} section{p.sections === 1 ? '' : 's'} · edited {ago(p.updatedAt)}</p>
                  </div>
                </Link>
                <div className="absolute bottom-3 right-3 flex items-center gap-1">
                  {live && <a href={`/${p.slug}`} target="_blank" rel="noreferrer" title="View live" className="grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"><ExternalLink size={15} /></a>}
                  <button type="button" onClick={() => setMenu(menu === p.id ? null : p.id)} className="grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"><MoreHorizontal size={16} /></button>
                </div>
                {menu === p.id && (
                  <div className="absolute right-3 bottom-12 z-20 w-48 rounded-xl bg-white shadow-2xl border border-gray-200 py-1.5 text-[13px]" onMouseLeave={() => setMenu(null)}>
                    <Link href={`/admin/pages/${p.id}/edit`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><PencilLine size={14} /> Open builder</Link>
                    <a href={`/page-preview/${p.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><Eye size={14} /> Preview draft</a>
                    {can('pages', 'create') && <button type="button" onClick={() => { setMenu(null); act(() => api.post(`/pages/${p.id}/duplicate`), 'Page duplicated'); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><Copy size={14} /> Duplicate</button>}
                    {can('pages', 'publish') && (live
                      ? <button type="button" onClick={() => { setMenu(null); act(() => api.post(`/pages/${p.id}/unpublish`), 'Page unpublished'); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><EyeOff size={14} /> Unpublish</button>
                      : <button type="button" onClick={() => { setMenu(null); act(() => api.post(`/pages/${p.id}/publish`), 'Page published'); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><UploadCloud size={14} /> Publish</button>)}
                    {can('pages', 'delete') && <button type="button" onClick={() => { setMenu(null); if (window.confirm(`Delete “${p.title}”? This removes the page and its history permanently.`)) act(() => api.delete(`/pages/${p.id}`), 'Page deleted'); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600"><Trash2 size={14} /> Delete</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[12px] text-gray-400 flex items-center gap-1.5"><FileText size={13} /> Add a published page to the main menu from Homepage Builder → Navigation.</p>
      {creating && <NewPageModal onClose={() => setCreating(false)} />}
    </div>
  );
}
