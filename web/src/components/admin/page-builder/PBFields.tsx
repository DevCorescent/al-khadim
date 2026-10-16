'use client';
import { useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { ImageInput } from '@/components/admin/site-builder/fields';
import type { PBField } from '@/lib/pageBuilder/elements';
import { mediaUrl } from '@/lib/mediaUrl';
import { PBIcon } from '@/components/pageBuilder/icons';
import { ColorIn, IconIn, RangeIn, Row, Segmented, SelectIn, TextIn, Toggle, inputCls } from './controls';
import RichText from './RichText';

const UPLOAD_URL = '/pages/upload';

function visible(f: PBField, value: any) {
  if (!f.showIf) return true;
  return f.showIf.equals.includes(value?.[f.showIf.key]);
}

export function FieldControl({ f, value, onChange }: { f: PBField; value: any; onChange: (v: any) => void }) {
  switch (f.type) {
    case 'text': return <Row label={f.label} hint={f.hint}><TextIn value={value} onChange={onChange} placeholder={f.placeholder} /></Row>;
    case 'link': return (
      <Row label={f.label} hint={f.hint}>
        <input className={`${inputCls} font-mono text-[11px]`} list="hp-site-links" value={value ?? ''} placeholder={f.placeholder} onChange={e => onChange(e.target.value)} />
      </Row>
    );
    case 'textarea': {
      const rows = Math.min(12, Math.max(2, String(value ?? '').split('\n').length + Math.floor(String(value ?? '').length / 48)));
      return <Row label={f.label} hint={f.hint}><textarea rows={rows} className={`${inputCls} h-auto py-1.5 leading-relaxed resize-y`} value={value ?? ''} placeholder={f.placeholder} onChange={e => onChange(e.target.value)} /></Row>;
    }
    case 'code': return (
      <Row label={f.label} hint={f.hint}>
        <textarea rows={12} spellCheck={false} className={`${inputCls} h-auto py-2 font-mono text-[11px] leading-relaxed resize-y bg-gray-950 text-emerald-200 border-gray-800`} value={value ?? ''} onChange={e => onChange(e.target.value)} />
      </Row>
    );
    case 'richtext': return <Row label={f.label} hint={f.hint}><RichText value={String(value ?? '')} onChange={onChange} /></Row>;
    case 'number': return <Row label={f.label} hint={f.hint}><TextIn type="number" value={value ?? ''} onChange={v => onChange(v === '' ? '' : Number(v))} placeholder={f.placeholder} /></Row>;
    case 'range': return <Row label={f.label} hint={f.hint}><RangeIn value={value} onChange={onChange} min={f.min} max={f.max} step={f.step} unit={f.unit} /></Row>;
    case 'toggle': return <Toggle label={f.label} checked={!!value} onChange={onChange} />;
    case 'select': return <Row label={f.label} hint={f.hint}><SelectIn value={value ?? ''} onChange={onChange} options={(f.options || []).map(o => [o.value, o.label])} /></Row>;
    case 'color': return <Row label={f.label} hint={f.hint}><ColorIn value={value} onChange={onChange} /></Row>;
    case 'icon': return <Row label={f.label} hint={f.hint}><IconIn value={value} onChange={onChange} /></Row>;
    case 'datetime': return <Row label={f.label} hint={f.hint}><input type="datetime-local" className={inputCls} value={value ?? ''} onChange={e => onChange(e.target.value)} /></Row>;
    case 'align': return (
      <Row label={f.label}>
        <Segmented value={value || 'left'} onChange={onChange} options={[
          { value: 'left', icon: <AlignLeft size={13} />, title: 'Left' },
          { value: 'center', icon: <AlignCenter size={13} />, title: 'Centre' },
          { value: 'right', icon: <AlignRight size={13} />, title: 'Right' },
          { value: 'justify', icon: <AlignJustify size={13} />, title: 'Justify / spread' },
        ]} />
      </Row>
    );
    case 'image': return <ImageInput field={{ key: f.key, type: 'image', label: f.label, hint: f.hint, uploadUrl: UPLOAD_URL }} value={value} onChange={onChange} />;
    case 'list': return <ListControl f={f} value={value} onChange={onChange} />;
    case 'heading': return (
      <div className="pt-3 first:pt-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400">{f.label}</p>
        {f.hint && <p className="text-[10.5px] text-gray-400 mt-0.5 leading-snug">{f.hint}</p>}
      </div>
    );
    default: return null;
  }
}

export function FieldsForm({ fields, value, onChange }: { fields: PBField[]; value: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  return (
    <div className="space-y-3">
      {fields.filter(f => visible(f, value)).map(f => (
        <FieldControl key={f.key} f={f} value={value?.[f.key]} onChange={v => onChange({ ...value, [f.key]: v })} />
      ))}
    </div>
  );
}

/* ─── Repeater ──────────────────────────────────────────────────────────── */

function ListControl({ f, value, onChange }: { f: PBField; value: any; onChange: (v: any) => void }) {
  const items: any[] = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const full = f.max != null && items.length >= f.max;
  const iconKey = f.itemFields?.find(x => x.type === 'icon')?.key;
  const imageKey = f.itemFields?.find(x => x.type === 'image')?.key;
  const titleOf = (it: any, i: number) => String((f.itemLabel && it?.[f.itemLabel]) || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50) || `Item ${i + 1}`;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
    if (open === from) setOpen(to);
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-gray-600">{f.label} <span className="font-normal text-gray-400">({items.length}{f.max ? ` / ${f.max}` : ''})</span></p>
      </div>
      {f.hint && <p className="text-[10.5px] text-gray-400 -mt-1 mb-1.5">{f.hint}</p>}
      <div className="space-y-1">
        {items.map((it, i) => {
          const isOpen = open === i;
          const img = imageKey ? mediaUrl(it?.[imageKey]) : '';
          return (
            <div key={i}
              onDragOver={e => { if (drag != null) e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); if (drag != null) move(drag, i); setDrag(null); }}
              className={`rounded-lg border transition ${isOpen ? 'border-teal-600/40 bg-teal-50/30 shadow-sm' : 'border-gray-200 bg-white'} ${drag === i ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-0.5 pl-1 pr-1 py-0.5">
                <span draggable onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'pb-list'); }} onDragEnd={() => setDrag(null)}
                  className="cursor-grab text-gray-300 hover:text-gray-500 p-0.5" title="Drag to reorder"><GripVertical size={12} /></span>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex-1 min-w-0 flex items-center gap-2 py-1 text-left">
                  {iconKey && it?.[iconKey] && <span className="grid place-items-center w-5 h-5 rounded bg-gray-100 text-gray-600 shrink-0"><PBIcon name={it[iconKey]} size={12} /></span>}
                  {!iconKey && img && <img src={img} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
                  <span className="truncate text-[12px] font-medium text-gray-800">{titleOf(it, i)}</span>
                </button>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} title="Move up" className="grid place-items-center w-5 h-5 rounded text-gray-400 hover:text-gray-800 disabled:opacity-25"><ChevronUp size={12} /></button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} title="Move down" className="grid place-items-center w-5 h-5 rounded text-gray-400 hover:text-gray-800 disabled:opacity-25"><ChevronDown size={12} /></button>
                <button type="button" disabled={full} onClick={() => { const next = [...items]; next.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); onChange(next); setOpen(i + 1); }} title="Duplicate" className="grid place-items-center w-5 h-5 rounded text-gray-400 hover:text-gray-800 disabled:opacity-25"><Copy size={11} /></button>
                <button type="button" onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }} title="Remove" className="grid place-items-center w-5 h-5 rounded text-gray-400 hover:text-red-600"><Trash2 size={11} /></button>
              </div>
              {isOpen && (
                <div className="px-2.5 pb-3 pt-2 border-t border-teal-600/10">
                  <FieldsForm fields={f.itemFields || []} value={it || {}} onChange={next => onChange(items.map((x, j) => (j === i ? next : x)))} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" disabled={full}
        onClick={() => { onChange([...items, JSON.parse(JSON.stringify(f.newItem || {}))]); setOpen(items.length); }}
        className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-1.5 text-[11.5px] font-semibold text-gray-500 hover:border-teal-600 hover:text-teal-700 hover:bg-teal-50/40 transition disabled:opacity-40 disabled:pointer-events-none">
        <Plus size={12} /> {full ? `Maximum of ${f.max}` : 'Add item'}
      </button>
    </div>
  );
}
