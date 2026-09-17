'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Search, CheckSquare, Square, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import DynamicFilterFields from './DynamicFilterFields';
import { RECIPIENT_TYPES, RecipientTypeValue } from './recipientTypes';

export interface DirectorySelection {
  recipientType: RecipientTypeValue;
  recipientId: string;
  name: string;
  email: string;
}

export interface RecipientDirectoryProps {
  open: boolean;
  onClose: () => void;
  /** Primary footer action. */
  onConfirm: (selection: DirectorySelection[]) => void;
  /** Defaults to "Use N Selected" (N interpolated live). */
  confirmLabel?: string;
  /** Optional 2nd footer button, e.g. "Save as New Group". */
  secondaryAction?: { label: string; onClick: (selection: DirectorySelection[]) => void };
}

interface TabState {
  filters: Record<string, any>;
  page: number;
}

const LIMIT = 20;

function emptyTabState(): TabState {
  return { filters: {}, page: 1 };
}

function keyFor(recipientType: RecipientTypeValue, recipientId: string) {
  return `${recipientType}:${recipientId}`;
}

/**
 * Full-viewport directory of every registered user across all 5 recipient
 * types, for hand-picking a custom campaign audience. Modal.tsx's largest
 * size ('xl' = max-w-4xl) is too cramped for tabs + filters + a paginated
 * table + a sticky selection footer all at once, so this builds its own
 * overlay matching Modal.tsx's Tailwind conventions (backdrop, rounded-2xl
 * card, border/shadow treatment) but sized for the extra content.
 */
export default function RecipientDirectory({ open, onClose, onConfirm, confirmLabel, secondaryAction }: RecipientDirectoryProps) {
  const [activeTab, setActiveTab] = useState<RecipientTypeValue>('CANDIDATES');
  const [tabState, setTabState] = useState<Record<RecipientTypeValue, TabState>>(() => {
    const init = {} as Record<RecipientTypeValue, TabState>;
    RECIPIENT_TYPES.forEach(rt => { init[rt.value] = emptyTabState(); });
    return init;
  });
  // Persisted across tab switches, page changes and filter changes — keyed
  // by `${recipientType}:${recipientId}` so the same person picked from two
  // different tabs (shouldn't happen, but types are distinct) never collides.
  const [selection, setSelection] = useState<Map<string, DirectorySelection>>(new Map());

  const state = tabState[activeTab];

  // Debounce filter/search changes into the audience-preview call, same pattern as AudiencePicker.
  const [debouncedFilters, setDebouncedFilters] = useState(state.filters);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(state.filters), 400);
    return () => clearTimeout(t);
  }, [state.filters]);

  const { data, isFetching } = useQuery({
    queryKey: ['recipient-directory', activeTab, JSON.stringify(debouncedFilters), state.page],
    queryFn: () => api.post('/emails/campaigns/audience-preview', {
      targetMode: 'FILTER', recipientType: activeTab, filters: debouncedFilters, page: state.page, limit: LIMIT,
    }).then(r => r.data),
    enabled: open,
    placeholderData: (prev: any) => prev,
  });

  const rows: { id: string; name: string; email: string }[] = data?.sample || [];
  const total = data?.total ?? 0;

  // Live total-count badge for every OTHER tab (the active tab reuses `total`
  // above, which already tracks its own debounced filters — avoids double
  // requests on every keystroke while typing into the active tab's filters).
  const otherTypes = RECIPIENT_TYPES.filter(rt => rt.value !== activeTab);
  const badgeQueries = useQueries({
    queries: otherTypes.map(rt => ({
      queryKey: ['recipient-directory-count', rt.value, JSON.stringify(tabState[rt.value].filters)],
      queryFn: () => api.post('/emails/campaigns/audience-preview', {
        targetMode: 'FILTER', recipientType: rt.value, filters: tabState[rt.value].filters, page: 1, limit: 1,
      }).then(r => r.data),
      enabled: open,
    })),
  });
  const badgeCounts: Record<string, number | undefined> = { [activeTab]: total };
  otherTypes.forEach((rt, i) => { badgeCounts[rt.value] = badgeQueries[i]?.data?.total; });

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function patchTab(patch: Partial<TabState>) {
    setTabState(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], ...patch } }));
  }

  function toggleRow(row: { id: string; name: string; email: string }) {
    const key = keyFor(activeTab, row.id);
    setSelection(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { recipientType: activeTab, recipientId: row.id, name: row.name, email: row.email });
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every(r => selection.has(keyFor(activeTab, r.id)));

  function toggleAllOnPage() {
    setSelection(prev => {
      const next = new Map(prev);
      if (allOnPageSelected) {
        rows.forEach(r => next.delete(keyFor(activeTab, r.id)));
      } else {
        rows.forEach(r => next.set(keyFor(activeTab, r.id), { recipientType: activeTab, recipientId: r.id, name: r.name, email: r.email }));
      }
      return next;
    });
  }

  const selectionArray = () => Array.from(selection.values());
  const activeLabel = RECIPIENT_TYPES.find(r => r.value === activeTab)?.label || activeTab;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-primary-500" /> Recipient Directory
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-gray-100 shrink-0 overflow-x-auto">
          {RECIPIENT_TYPES.map(rt => (
            <button key={rt.value} type="button" onClick={() => setActiveTab(rt.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === rt.value ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {rt.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === rt.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {badgeCounts[rt.value] ?? '…'}
              </span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={state.filters.search ?? ''}
              onChange={e => patchTab({ filters: { ...state.filters, search: e.target.value || undefined }, page: 1 })}
              placeholder={`Search ${activeLabel.toLowerCase()}…`}
              className="input pl-8 text-sm w-full sm:w-80"
            />
          </div>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
            <DynamicFilterFields
              recipientType={activeTab}
              filters={state.filters}
              onFiltersChange={(filters) => patchTab({ filters, page: 1 })}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <button onClick={toggleAllOnPage} className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
                {allOnPageSelected ? <CheckSquare size={15} className="text-primary-500" /> : <Square size={15} className="text-gray-400" />}
                Select all on page
              </button>
              <span className="text-xs text-gray-400">{total} match{total === 1 ? '' : 'es'}</span>
            </div>
            <div className="divide-y divide-gray-50 min-h-[200px] max-h-[360px] overflow-y-auto">
              {isFetching && rows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No matches</div>
              ) : rows.map(row => {
                const checked = selection.has(keyFor(activeTab, row.id));
                return (
                  <label key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={checked} onChange={() => toggleRow(row)} className="shrink-0" />
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {row.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{row.name}</p>
                      <p className="text-xs text-gray-400 truncate">{row.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Page {state.page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => patchTab({ page: Math.max(1, state.page - 1) })} disabled={state.page <= 1}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => patchTab({ page: Math.min(totalPages, state.page + 1) })} disabled={state.page >= totalPages}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">{selection.size} selected</span>
            {selection.size > 0 && (
              <button onClick={() => setSelection(new Map())} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                <X size={11} /> Clear selection
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {secondaryAction && (
              <button onClick={() => secondaryAction.onClick(selectionArray())} disabled={selection.size === 0}
                className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {secondaryAction.label}
              </button>
            )}
            <button onClick={() => onConfirm(selectionArray())} disabled={selection.size === 0}
              className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50">
              {confirmLabel || `Use ${selection.size} Selected`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
