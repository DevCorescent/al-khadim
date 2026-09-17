'use client';
import { Plus, Trash2 } from 'lucide-react';

export interface TrackingField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'checklist' | 'table';
  options?: string[];
  items?: string[];
  statusOptions?: string[];
  columns?: { key: string; label: string; type: string; options?: string[] }[];
}

export interface TrackingSection {
  key: string;
  label: string;
  fields: TrackingField[];
}

interface Props {
  section: TrackingSection;
  data: Record<string, any>;
  mode: 'edit' | 'view';
  onChange?: (fieldKey: string, value: any) => void;
}

function ChecklistField({ field, value, mode, onChange }: { field: TrackingField; value: any; mode: 'edit' | 'view'; onChange?: (v: any) => void }) {
  const items = field.items || [];
  const statusOptions = field.statusOptions || ['Pending', 'In Progress', 'Complete', 'Not Applicable'];
  const v = value || {};

  function update(item: string, patch: any) {
    onChange?.({ ...v, [item]: { ...(v[item] || {}), ...patch } });
  }

  const doneColor = (status: string) =>
    ['Complete', 'Completed', 'Verified', 'Compliant', 'Approved', 'Confirm', 'Cleared', 'Valid'].includes(status)
      ? 'bg-emerald-100 text-emerald-700'
      : ['Expired', 'Rejected', 'Not Cleared', 'Overdue', 'Fail', 'Terminate'].includes(status)
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const row = v[item] || {};
        return (
          <div key={item} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-700 flex-1 min-w-[140px]">{item}</span>
            {mode === 'edit' ? (
              <>
                <select className="input text-xs py-1 px-2 w-auto" value={row.status || ''} onChange={(e) => update(item, { status: e.target.value })}>
                  <option value="">—</option>
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="date" className="input text-xs py-1 px-2 w-auto" value={row.date || ''} onChange={(e) => update(item, { date: e.target.value })} />
              </>
            ) : (
              <>
                {row.status && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${doneColor(row.status)}`}>{row.status}</span>}
                {row.date && <span className="text-xs text-gray-400">{row.date}</span>}
                {!row.status && !row.date && <span className="text-xs text-gray-300">—</span>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableField({ field, value, mode, onChange }: { field: TrackingField; value: any; mode: 'edit' | 'view'; onChange?: (v: any) => void }) {
  const rows: any[] = Array.isArray(value) ? value : [];
  const columns = field.columns || [];

  function updateRow(idx: number, colKey: string, val: any) {
    const next = rows.map((r, i) => (i === idx ? { ...r, [colKey]: val } : r));
    onChange?.(next);
  }
  function addRow() {
    onChange?.([...rows, {}]);
  }
  function removeRow(idx: number) {
    onChange?.(rows.filter((_, i) => i !== idx));
  }

  if (mode === 'view') {
    if (rows.length === 0) return <p className="text-xs text-gray-300">No entries</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>{columns.map((c) => <th key={c.key} className="text-left text-gray-400 font-semibold pb-1.5 pr-3">{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3 text-gray-700">
                    {c.type === 'boolean' ? (row[c.key] ? 'Yes' : 'No') : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 bg-gray-50 rounded-lg p-2">
          {columns.map((c) => (
            <div key={c.key} className="min-w-[110px]">
              <label className="block text-[10px] text-gray-400 mb-0.5">{c.label}</label>
              {c.type === 'boolean' ? (
                <input type="checkbox" checked={!!row[c.key]} onChange={(e) => updateRow(i, c.key, e.target.checked)} />
              ) : c.type === 'select' ? (
                <select className="input text-xs py-1 px-1.5" value={row[c.key] || ''} onChange={(e) => updateRow(i, c.key, e.target.value)}>
                  <option value="">—</option>
                  {(c.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'} className="input text-xs py-1 px-1.5"
                  value={row[c.key] || ''} onChange={(e) => updateRow(i, c.key, e.target.value)} />
              )}
            </div>
          ))}
          <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:underline">
        <Plus size={12} /> Add row
      </button>
    </div>
  );
}

export default function IndustryTrackingSection({ section, data, mode, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">{section.label}</h3>
      <div className="space-y-4">
        {section.fields.map((field) => {
          const value = data?.[field.key];
          return (
            <div key={field.key}>
              {field.type !== 'checklist' && field.type !== 'table' && (
                <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
              )}
              {field.type === 'checklist' && <p className="text-xs font-semibold text-gray-600 mb-2">{field.label}</p>}
              {field.type === 'table' && <p className="text-xs font-semibold text-gray-600 mb-2">{field.label}</p>}

              {mode === 'view' ? (
                <ViewValue field={field} value={value} />
              ) : (
                <EditValue field={field} value={value} onChange={(v) => onChange?.(field.key, v)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewValue({ field, value }: { field: TrackingField; value: any }) {
  if (field.type === 'checklist') return <ChecklistField field={field} value={value} mode="view" />;
  if (field.type === 'table') return <TableField field={field} value={value} mode="view" />;
  if (value === undefined || value === null || value === '') return <p className="text-sm text-gray-300">—</p>;
  if (field.type === 'boolean') return <p className="text-sm text-gray-800">{value ? 'Yes' : 'No'}</p>;
  return <p className="text-sm text-gray-800 whitespace-pre-line">{String(value)}</p>;
}

function EditValue({ field, value, onChange }: { field: TrackingField; value: any; onChange: (v: any) => void }) {
  if (field.type === 'checklist') return <ChecklistField field={field} value={value} mode="edit" onChange={onChange} />;
  if (field.type === 'table') return <TableField field={field} value={value} mode="edit" onChange={onChange} />;
  if (field.type === 'boolean') {
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (field.type === 'select') {
    return (
      <select className="input text-sm" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return <textarea className="input w-full text-sm h-20 resize-none" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <input
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      className="input text-sm"
      value={value ?? ''}
      onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
    />
  );
}
