'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronUp, Copy, ImagePlus, Link2, Loader2, Plus, Search, Trash2, Upload, X,
} from 'lucide-react';
import api from '@/lib/api';
import { mediaUrl } from '@/lib/mediaUrl';
import type { Field } from '@/lib/homepage/schema';
import { ICON_NAMES, Icon } from '@/components/homepage/icons';

/* ─── Path helpers (keys may be dotted, e.g. "socials.linkedin") ────────── */

export function getPath(obj: any, key: string) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath<T extends Record<string, any>>(obj: T, key: string, value: any): T {
  const [head, ...rest] = key.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj?.[head] ?? {}, rest.join('.'), value) };
}

/* ─── Building blocks ───────────────────────────────────────────────────── */

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/25 focus:border-emerald-600 transition';

function Label({ field, htmlFor }: { field: Field; htmlFor?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-gray-700">{field.label}</label>
      {field.hint && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{field.hint}</p>}
    </div>
  );
}

const SITE_LINKS = ['/', '/services', '/careers', '/candidates', '/about', '/contact', '/enquiry', '/candidate/register', '/candidate/login', '/company/login', '/login'];

function TextInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const id = useMemo(() => `f-${Math.random().toString(36).slice(2)}`, []);
  const v = value ?? '';
  if (field.type === 'textarea') {
    const rows = Math.min(10, Math.max(2, String(v).split('\n').length + Math.floor(String(v).length / 60)));
    return (
      <div>
        <Label field={field} htmlFor={id} />
        <textarea id={id} rows={rows} className={`${inputCls} resize-y leading-relaxed`} value={v} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <Label field={field} htmlFor={id} />
      <div className="relative">
        {field.type === 'link' && <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input id={id} className={`${inputCls} ${field.type === 'link' ? 'pl-8 font-mono text-[12px]' : ''}`} value={v} placeholder={field.placeholder}
          list={field.type === 'link' ? 'hp-site-links' : undefined}
          onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function SiteLinksDatalist() {
  return <datalist id="hp-site-links">{SITE_LINKS.map(l => <option key={l} value={l} />)}</datalist>;
}

function NumberInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const min = field.min ?? 0, max = field.max ?? 100;
  const n = Number.isFinite(Number(value)) ? Number(value) : min;
  return (
    <div>
      <Label field={field} />
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={n} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-emerald-700" />
        <input type="number" min={min} max={max} value={n} onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className={`${inputCls} w-16 text-center`} />
      </div>
    </div>
  );
}

function Toggle({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const on = !!value;
  return (
    <button type="button" onClick={() => onChange(!on)} className="w-full flex items-start justify-between gap-4 py-1 text-left group">
      <span>
        <span className="block text-[12px] font-semibold text-gray-700">{field.label}</span>
        {field.hint && <span className="block text-[11px] text-gray-400 mt-0.5">{field.hint}</span>}
      </span>
      <span className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${on ? 'bg-emerald-700' : 'bg-gray-200 group-hover:bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function Select({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const opts = field.options || [];
  if (opts.length <= 4 && opts.every(o => o.label.length <= 16)) {
    return (
      <div>
        <Label field={field} />
        <div className="flex p-0.5 rounded-lg bg-gray-100">
          {opts.map(o => (
            <button key={o.value} type="button" onClick={() => onChange(o.value)}
              className={`flex-1 px-2 py-1.5 rounded-md text-[12px] font-semibold transition ${String(value) === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <Label field={field} />
      <select className={inputCls} value={value ?? ''} onChange={e => onChange(e.target.value)}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function ColorInput({ field, value, onChange, swatches = [] }: { field: Field; value: any; onChange: (v: any) => void; swatches?: string[] }) {
  const v = String(value || '');
  const valid = /^#[0-9a-f]{6}$/i.test(v);
  return (
    <div>
      <Label field={field} />
      <div className="flex items-center gap-2">
        <label className="relative w-9 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer shrink-0" style={{ background: valid ? v : '#fff' }}>
          <input type="color" value={valid ? v : '#000000'} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <input className={`${inputCls} font-mono uppercase`} value={v} maxLength={7} onChange={e => onChange(e.target.value)} placeholder="#000000" />
      </div>
      {swatches.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {swatches.map(c => (
            <button key={c} type="button" title={c} onClick={() => onChange(c)} className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition" style={{ background: c }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ImageInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = mediaUrl(value);
  useEffect(() => setBroken(false), [url]);

  async function upload(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error('Images must be under 8 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post(field.uploadUrl || '/site-config/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(data.url);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label field={field} />
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {url && !broken ? (
          <div className="relative h-28 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
            <img src={url} alt="" onError={() => setBroken(true)} className="w-full h-full object-contain" />
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button type="button" onClick={() => fileRef.current?.click()} title="Replace" className="grid place-items-center w-7 h-7 rounded-md bg-white/90 shadow text-gray-700 hover:bg-white"><Upload size={13} /></button>
              <button type="button" onClick={() => onChange('')} title="Remove" className="grid place-items-center w-7 h-7 rounded-md bg-white/90 shadow text-red-600 hover:bg-white"><X size={13} /></button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full h-24 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50/50 transition disabled:opacity-60">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            <span className="text-[12px] font-medium">{uploading ? 'Uploading…' : broken ? 'Image could not load — upload another' : 'Upload image'}</span>
          </button>
        )}
        <input className="w-full border-t border-gray-100 px-3 py-1.5 text-[11px] font-mono text-gray-500 focus:outline-none focus:text-gray-900"
          value={value || ''} placeholder="…or paste an image URL" onChange={e => onChange(e.target.value)} />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
    </div>
  );
}

function IconInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const names = ICON_NAMES.filter(n => !q || n.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <Label field={field} />
      <button type="button" onClick={() => setOpen(v => !v)} className={`${inputCls} flex items-center gap-2 text-left`}>
        <span className="grid place-items-center w-6 h-6 rounded-md bg-emerald-50 text-emerald-700"><Icon name={value} size={14} /></span>
        <span className="flex-1 truncate">{value || 'Choose an icon'}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl p-2">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search icons" className={`${inputCls} pl-8 py-1.5`} />
          </div>
          <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
            {names.map(n => (
              <button key={n} type="button" title={n} onClick={() => { onChange(n); setOpen(false); setQ(''); }}
                className={`grid place-items-center aspect-square rounded-lg transition ${n === value ? 'bg-emerald-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon name={n} size={16} />
              </button>
            ))}
            {!names.length && <p className="col-span-7 text-center text-xs text-gray-400 py-4">No icons match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lists ─────────────────────────────────────────────────────────────── */

function ListInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const items: any[] = Array.isArray(value) ? value : [];
  const [open, setOpenState] = useState<number | null>(null);
  // Lets the builder follow along — e.g. the preview jumps to the hero slide being edited.
  const setOpen = (i: number | null) => {
    setOpenState(i);
    if (i != null) window.dispatchEvent(new CustomEvent('hp-builder-list-open', { detail: { key: field.key, index: i } }));
  };
  const full = field.max != null && items.length >= field.max;
  const titleOf = (it: any, i: number) => {
    const raw = field.itemLabel ? getPath(it, field.itemLabel) : '';
    return String(raw || '').replace(/\*/g, '').replace(/\s*\n\s*/g, ' ').trim() || `Item ${i + 1}`;
  };
  const iconKey = field.itemFields?.find(f => f.type === 'icon')?.key;
  const imageKey = field.itemFields?.find(f => f.type === 'image')?.key;

  const update = (i: number, next: any) => onChange(items.map((it, j) => (j === i ? next : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (open === i) setOpen(j);
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <p className="text-[12px] font-semibold text-gray-700">{field.label} <span className="font-normal text-gray-400">({items.length}{field.max ? ` / ${field.max}` : ''})</span></p>
          {field.hint && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{field.hint}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => {
          const isOpen = open === i;
          const img = imageKey ? mediaUrl(it?.[imageKey]) : '';
          return (
            <div key={i} className={`rounded-lg border transition ${isOpen ? 'border-emerald-600/40 bg-emerald-50/30 shadow-sm' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-1 pl-2 pr-1.5 py-1">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex-1 min-w-0 flex items-center gap-2 py-1 text-left">
                  {iconKey && <span className="grid place-items-center w-6 h-6 rounded-md bg-gray-100 text-gray-600 shrink-0"><Icon name={it?.[iconKey]} size={13} /></span>}
                  {!iconKey && img && <img src={img} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
                  <span className="truncate text-[12.5px] font-medium text-gray-800">{titleOf(it, i)}</span>
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="grid place-items-center w-6 h-6 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-25"><ChevronUp size={13} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Move down" className="grid place-items-center w-6 h-6 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-25"><ChevronDown size={13} /></button>
                <button type="button" disabled={full} onClick={() => { const next = [...items]; next.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); onChange(next); setOpen(i + 1); }} title="Duplicate" className="grid place-items-center w-6 h-6 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-25"><Copy size={12} /></button>
                <button type="button" onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }} title="Remove" className="grid place-items-center w-6 h-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-emerald-600/10">
                  <FieldList fields={field.itemFields || []} value={it || {}} onChange={next => update(i, next)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" disabled={full}
        onClick={() => { onChange([...items, JSON.parse(JSON.stringify(field.newItem || {}))]); setOpen(items.length); }}
        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-[12px] font-semibold text-gray-500 hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/40 transition disabled:opacity-40 disabled:pointer-events-none">
        <Plus size={13} /> {full ? `Maximum of ${field.max} reached` : `Add ${field.label.toLowerCase().replace(/s$/, '').replace(/\(.*\)/, '').trim() || 'item'}`}
      </button>
    </div>
  );
}

/* ─── Form ──────────────────────────────────────────────────────────────── */

export function FieldInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case 'text': case 'textarea': case 'link': return <TextInput field={field} value={value} onChange={onChange} />;
    case 'number': return <NumberInput field={field} value={value} onChange={onChange} />;
    case 'toggle': return <Toggle field={field} value={value} onChange={onChange} />;
    case 'select': return <Select field={field} value={value} onChange={onChange} />;
    case 'color':  return <ColorInput field={field} value={value} onChange={onChange} />;
    case 'image':  return <ImageInput field={field} value={value} onChange={onChange} />;
    case 'icon':   return <IconInput field={field} value={value} onChange={onChange} />;
    case 'list':   return <ListInput field={field} value={value} onChange={onChange} />;
    default: return null;
  }
}

function visible(field: Field, value: any) {
  if (!field.showIf) return true;
  return field.showIf.equals.includes(getPath(value, field.showIf.key));
}

/**
 * Renders fields in order; a `heading` field opens a new titled group. Paired
 * short fields (e.g. a button's text and link) sit side by side.
 */
export function FieldList({ fields, value, onChange }: { fields: Field[]; value: any; onChange: (v: any) => void }) {
  const shown = fields.filter(f => visible(f, value));
  const out: React.ReactNode[] = [];
  for (let i = 0; i < shown.length; i++) {
    const f = shown[i];
    if (f.type === 'heading') {
      out.push(
        <div key={f.key} className="pt-4 first:pt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">{f.label}</p>
          {f.hint && <p className="text-[11px] text-gray-400 mt-0.5">{f.hint}</p>}
        </div>,
      );
      continue;
    }
    const next = shown[i + 1];
    const pairable = (x?: Field) => !!x && ['text', 'link'].includes(x.type) && !x.wide;
    if (pairable(f) && pairable(next) && f.key.endsWith('Label') && next!.key.endsWith('Href')) {
      out.push(
        <div key={f.key} className="grid grid-cols-2 gap-2">
          <FieldInput field={f} value={getPath(value, f.key)} onChange={v => onChange(setPath(value, f.key, v))} />
          <FieldInput field={next!} value={getPath(value, next!.key)} onChange={v => onChange(setPath(value, next!.key, v))} />
        </div>,
      );
      i++;
      continue;
    }
    out.push(<FieldInput key={f.key} field={f} value={getPath(value, f.key)} onChange={v => onChange(setPath(value, f.key, v))} />);
  }
  return <div className="space-y-3.5">{out}</div>;
}
