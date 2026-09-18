'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import IndustryTrackingSection, { TrackingSection, TrackingField } from '@/components/IndustryTrackingSection';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Save, Eye,
} from 'lucide-react';

const DEFAULT_STATUS_OPTIONS = ['Pending', 'In Progress', 'Complete', 'Not Applicable'];
const FIELD_TYPES: TrackingField['type'][] = ['text', 'textarea', 'number', 'date', 'boolean', 'select', 'checklist', 'table'];

function slugify(label: string) {
  return String(label).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'FIELD';
}

let uidSeq = 0;
function uid() { uidSeq += 1; return `tmp_${Date.now()}_${uidSeq}`; }

/**
 * New sections/fields/columns get a temporary `tmp_` key that doubles as their React key. It is
 * only turned into a slug of the label when saving: re-keying while typing remounted the input
 * and lost focus after every keystroke.
 */
function finalKeys<T extends { key: string; label: string }>(list: T[]): T[] {
  const used = new Set(list.filter((x) => !x.key.startsWith('tmp_')).map((x) => x.key));
  return list.map((x) => {
    if (!x.key.startsWith('tmp_')) return x;
    const base = slugify(x.label);
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    return { ...x, key };
  });
}

function finalizeSections(sections: TrackingSection[]): TrackingSection[] {
  return finalKeys(sections).map((sec) => ({
    ...sec,
    fields: finalKeys(sec.fields).map((f) => (f.columns ? { ...f, columns: finalKeys(f.columns) } : f)),
  }));
}

/** Comma-separated list input that keeps the raw text while typing (so "a, " isn't eaten). */
function CommaListInput({ value, onChange, className, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; className?: string; placeholder?: string;
}) {
  const parse = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);
  const [text, setText] = useState(value.join(', '));
  // Resync only when the list changed from outside (not from our own typing).
  useEffect(() => {
    setText((t) => (JSON.stringify(parse(t)) === JSON.stringify(value) ? t : value.join(', ')));
  }, [value]);
  return (
    <input
      value={text}
      onChange={(e) => { setText(e.target.value); onChange(parse(e.target.value)); }}
      className={className}
      placeholder={placeholder}
    />
  );
}

export default function IndustryTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [sections, setSections] = useState<TrackingSection[]>([]);
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [loaded, setLoaded] = useState(false);

  const { data: industry, isLoading } = useQuery({
    queryKey: ['industry', id],
    queryFn: () => api.get(`/industries/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (industry && !loaded) {
      setSections(industry.trackingSections?.length ? industry.trackingSections : []);
      setLoaded(true);
    }
  }, [industry, loaded]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/industries/${id}`, { trackingSections: finalizeSections(sections) }).then((r) => r.data),
    onSuccess: (saved: any) => {
      // Adopt the final (slugged) keys so a second save keeps them stable.
      if (Array.isArray(saved?.trackingSections)) setSections(saved.trackingSections);
      qc.invalidateQueries({ queryKey: ['industry', id] });
      qc.invalidateQueries({ queryKey: ['tracking-templates'] });
      toast.success('Template saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  function addSection() {
    setSections((s) => [...s, { key: uid(), label: 'New Section', fields: [] }]);
    setOpenSection(sections.length);
  }
  function updateSection(i: number, patch: Partial<TrackingSection>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function removeSection(i: number) {
    if (!confirm('Remove this section? Any saved data under it will no longer display.')) return;
    setSections((s) => s.filter((_, idx) => idx !== i));
    setOpenSection(null);
  }
  function moveSection(i: number, dir: -1 | 1) {
    setSections((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addField(secIdx: number) {
    const field: TrackingField = { key: uid(), label: 'New Field', type: 'text' };
    setSections((s) => s.map((sec, idx) => (idx === secIdx ? { ...sec, fields: [...sec.fields, field] } : sec)));
  }
  function updateField(secIdx: number, fieldIdx: number, patch: Partial<TrackingField>) {
    setSections((s) => s.map((sec, idx) => {
      if (idx !== secIdx) return sec;
      return { ...sec, fields: sec.fields.map((f, fi) => (fi === fieldIdx ? { ...f, ...patch } : f)) };
    }));
  }
  function removeField(secIdx: number, fieldIdx: number) {
    setSections((s) => s.map((sec, idx) => (idx === secIdx ? { ...sec, fields: sec.fields.filter((_, fi) => fi !== fieldIdx) } : sec)));
  }
  function moveField(secIdx: number, fieldIdx: number, dir: -1 | 1) {
    setSections((s) => s.map((sec, idx) => {
      if (idx !== secIdx) return sec;
      const next = [...sec.fields];
      const j = fieldIdx + dir;
      if (j < 0 || j >= next.length) return sec;
      [next[fieldIdx], next[j]] = [next[j], next[fieldIdx]];
      return { ...sec, fields: next };
    }));
  }

  if (isLoading || !loaded) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;
  if (!industry) return <div className="p-8 text-center text-red-500">Industry not found</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <button onClick={() => router.push('/admin/settings/industries')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Industries
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: industry.color }} />
            {industry.name} — Tracking Template
          </h1>
          <p className="text-xs text-gray-400 mt-1">Build the SOP/KPI checklist sections/fields shown in the Industry Tracking tab for this industry.</p>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary text-sm py-2 px-4 disabled:opacity-50 flex items-center gap-2">
          <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((sec, i) => (
          <div key={sec.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <button onClick={() => setOpenSection(openSection === i ? null : i)} className="text-gray-400 hover:text-gray-600">
                {openSection === i ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <input
                value={sec.label}
                onChange={(e) => updateSection(i, { label: e.target.value })}
                className="flex-1 bg-transparent font-bold text-sm text-gray-800 focus:outline-none"
              />
              <span className="text-[10px] font-mono text-gray-300">{sec.fields.length} field{sec.fields.length !== 1 ? 's' : ''}</span>
              <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronUp size={14} /></button>
              <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronDown size={14} /></button>
              <button onClick={() => removeSection(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>

            {openSection === i && (
              <div className="p-4 grid lg:grid-cols-2 gap-5">
                {/* Editor */}
                <div className="space-y-3">
                  {sec.fields.map((field, fi) => (
                    <FieldEditor
                      key={field.key}
                      field={field}
                      onChange={(patch) => updateField(i, fi, patch)}
                      onRemove={() => removeField(i, fi)}
                      onMoveUp={() => moveField(i, fi, -1)}
                      onMoveDown={() => moveField(i, fi, 1)}
                      canMoveUp={fi > 0}
                      canMoveDown={fi < sec.fields.length - 1}
                    />
                  ))}
                  <button onClick={() => addField(i)} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary-500 border-2 border-dashed border-primary-200 rounded-xl py-2.5 hover:bg-primary-50 transition-colors">
                    <Plus size={13} /> Add Field
                  </button>
                </div>

                {/* Live preview */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Eye size={11} /> Live Preview</p>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    {sec.fields.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">Add a field to see the preview</p>
                    ) : (
                      <IndustryTrackingSection section={sec} data={{}} mode="view" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={addSection} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl py-4 hover:bg-gray-50 hover:border-gray-300 transition-colors">
          <Plus size={15} /> Add Section
        </button>
      </div>

      {sections.length > 0 && (
        <div className="flex justify-end mt-5">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50 flex items-center gap-2">
            <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldEditor({ field, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  field: TrackingField;
  onChange: (patch: Partial<TrackingField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400/30"
          placeholder="Field label"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as TrackingField['type'] })}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
        >
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronUp size={13} /></button>
        <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ChevronDown size={13} /></button>
        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
      </div>

      {field.type === 'select' && (
        <CommaListInput
          value={field.options || []}
          onChange={(options) => onChange({ options })}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
          placeholder="Options, comma-separated (e.g. Yes, No, N/A)"
        />
      )}

      {field.type === 'checklist' && (
        <div className="space-y-1.5">
          <CommaListInput
            value={field.items || []}
            onChange={(items) => onChange({ items })}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
            placeholder="Checklist items, comma-separated"
          />
          <CommaListInput
            value={field.statusOptions || DEFAULT_STATUS_OPTIONS}
            onChange={(statusOptions) => onChange({ statusOptions })}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
            placeholder="Status options, comma-separated"
          />
        </div>
      )}

      {field.type === 'table' && (
        <TableColumnsEditor
          columns={field.columns || []}
          onChange={(columns) => onChange({ columns })}
        />
      )}
    </div>
  );
}

function TableColumnsEditor({ columns, onChange }: { columns: { key: string; label: string; type: string; options?: string[] }[]; onChange: (c: any[]) => void }) {
  function addColumn() {
    onChange([...columns, { key: uid(), label: 'Column', type: 'text' }]);
  }
  function updateColumn(i: number, patch: any) {
    onChange(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeColumn(i: number) {
    onChange(columns.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5 bg-gray-50 rounded-lg p-2.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Table Columns</p>
      {columns.map((col, i) => (
        <div key={col.key} className="flex items-center gap-1.5">
          <input
            value={col.label}
            onChange={(e) => updateColumn(i, { label: e.target.value })}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
            placeholder="Column label"
          />
          <select value={col.type} onChange={(e) => updateColumn(i, { type: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none">
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="date">date</option>
            <option value="select">select</option>
          </select>
          {col.type === 'select' && (
            <CommaListInput
              value={col.options || []}
              onChange={(options) => updateColumn(i, { options })}
              className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
              placeholder="options"
            />
          )}
          <button onClick={() => removeColumn(i)} className="p-1 text-red-400 hover:text-red-600 shrink-0"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={addColumn} className="text-[11px] font-bold text-primary-500 hover:underline flex items-center gap-1">
        <Plus size={11} /> Add column
      </button>
    </div>
  );
}
