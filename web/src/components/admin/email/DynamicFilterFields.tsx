'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'multiselect' | 'multiselect-remote' | 'tags';
  options?: string[];
  source?: string;
}

interface DynamicFilterFieldsProps {
  recipientType: string;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
}

/**
 * Renders one input per `filter-meta` field for a recipient type. Extracted
 * from AudiencePicker so it can be reused inside the recipient directory's
 * per-tab search/filter bar as well as AudiencePicker's own Filter mode.
 */
export default function DynamicFilterFields({ recipientType, filters, onFiltersChange }: DynamicFilterFieldsProps) {
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ['campaign-filter-meta', recipientType],
    queryFn: () => api.get(`/emails/campaigns/filter-meta/${recipientType}`).then(r => r.data),
    enabled: !!recipientType,
  });

  const fields: FilterField[] = meta?.fields || [];

  function setField(key: string, value: any) {
    onFiltersChange({ ...filters, [key]: value });
  }

  if (metaLoading) {
    return <div className="text-xs text-gray-400 py-4 text-center">Loading filters…</div>;
  }

  if (fields.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-4 text-center">
        No filters for this recipient type — every {recipientType.toLowerCase().replace('_', ' ')} will be targeted
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {fields.map(f => (
        <FilterInput key={f.key} field={f} value={filters[f.key]} onChange={(v) => setField(f.key, v)} />
      ))}
    </div>
  );
}

function FilterInput({ field, value, onChange }: { field: FilterField; value: any; onChange: (v: any) => void }) {
  // Some list endpoints (e.g. /categories, /industries) return a bare array;
  // others (e.g. /clients) return a paginated `{data, total, ...}` envelope —
  // normalize both shapes here instead of assuming one.
  const { data: remoteOptions } = useQuery({
    queryKey: ['filter-remote-options', field.source],
    queryFn: () => api.get(field.source as string).then((r) => {
      const body = r.data;
      return Array.isArray(body) ? body : (body?.data ?? []);
    }),
    enabled: field.type === 'multiselect-remote' && !!field.source,
  });

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
        <input type="number" className="input text-sm w-full" value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      </div>
    );
  }

  if (field.type === 'tags') {
    const arr: string[] = Array.isArray(value) ? value : [];
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
        <input type="text" className="input text-sm w-full" defaultValue={arr.join(', ')}
          placeholder="comma separated"
          onBlur={e => {
            const parsed = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            onChange(parsed.length ? parsed : undefined);
          }} />
      </div>
    );
  }

  if (field.type === 'multiselect' || field.type === 'multiselect-remote') {
    const options: { value: string; label: string }[] = field.type === 'multiselect-remote'
      ? (remoteOptions || []).map((o: any) => ({ value: o.id, label: o.name || o.companyName }))
      : (field.options || []).map(o => ({ value: o, label: o }));
    const selected: string[] = Array.isArray(value) ? value : [];

    const toggle = (v: string) => {
      onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    };

    return (
      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">{field.label}</label>
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {options.length === 0 ? (
            <span className="text-xs text-gray-400">No options</span>
          ) : options.map(o => (
            <button key={o.value} type="button" onClick={() => toggle(o.value)}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                selected.includes(o.value) ? 'bg-primary-400 border-primary-400 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // text (default)
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
      <input type="text" className="input text-sm w-full" value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)} />
    </div>
  );
}
