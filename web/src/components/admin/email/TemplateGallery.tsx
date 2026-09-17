'use client';
import { useMemo, useState } from 'react';
import { FilePlus2, Search, FileText, Megaphone } from 'lucide-react';

export interface TemplateSummary {
  id: string;
  name: string;
  category: 'TRANSACTIONAL' | 'CAMPAIGN';
  module: string;
  subject: string;
  recipientType?: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface TemplateGalleryProps {
  templates: TemplateSummary[];
  isLoading?: boolean;
  loadingTemplateId?: string | null;
  onSelectTemplate: (template: TemplateSummary) => void;
  onStartBlank: () => void;
}

const CATEGORY_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'CAMPAIGN', label: 'Campaign' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
] as const;

/**
 * Step 1 of the Compose flow: pick a starting point before touching the
 * editor at all. A visual gallery (with search/category filtering) reads far
 * more "pick one of these" than a plain <select>, and a blank start is always
 * one click away at the top rather than buried as just another option.
 */
export default function TemplateGallery({ templates, isLoading, loadingTemplateId, onSelectTemplate, onStartBlank }: TemplateGalleryProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]['value']>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter(t => t.isActive)
      .filter(t => category === 'ALL' || t.category === category)
      .filter(t => !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q));
  }, [templates, search, category]);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onStartBlank}
        className="w-full flex items-center gap-3 bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50/40 transition-colors p-4 text-left">
        <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
          <FilePlus2 size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Start blank</p>
          <p className="text-xs text-gray-400">Write a one-off email from scratch</p>
        </div>
      </button>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {CATEGORY_TABS.map(tab => (
            <button key={tab.value} type="button" onClick={() => setCategory(tab.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                category === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="input pl-8 py-1.5 text-xs" />
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-gray-400 text-sm">No templates match — try a different search, or start blank above.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(t => {
            const isPicking = loadingTemplateId === t.id;
            return (
              <button key={t.id} type="button" disabled={isPicking} onClick={() => onSelectTemplate(t)}
                className="text-left bg-white rounded-2xl border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all p-4 space-y-2 disabled:opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    t.category === 'CAMPAIGN' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {t.category === 'CAMPAIGN' ? <Megaphone size={9} /> : <FileText size={9} />}
                    {t.category === 'CAMPAIGN' ? 'Campaign' : 'Transactional'}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{t.module}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 leading-snug">{t.name}</p>
                <p className="text-xs text-gray-400 truncate">{t.subject}</p>
                {isPicking && <p className="text-[11px] font-semibold text-primary-500">Loading…</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
