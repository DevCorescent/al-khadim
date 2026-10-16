'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Link2, Link2Off, Monitor, RotateCcw, Search, Smartphone, Tablet } from 'lucide-react';
import { THEME_TOKENS } from '@/lib/pageBuilder/css';
import { FONT_FAMILIES } from '@/lib/homepage/config';
import type { Device } from '@/lib/pageBuilder/types';
import { PBIcon, PB_ICON_NAMES } from '@/components/pageBuilder/icons';

export const inputCls = 'w-full h-8 rounded-md border border-gray-200 bg-white px-2.5 text-[12px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition';

export const DEVICE_ICON: Record<Device, typeof Monitor> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

/* ─── Layout helpers ────────────────────────────────────────────────────── */

export function Row({ label, children, hint, device, onReset, set }: {
  label: string; children: React.ReactNode; hint?: string; device?: Device; onReset?: () => void; set?: boolean;
}) {
  const DI = device ? DEVICE_ICON[device] : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 min-h-[16px]">
        <span className={`text-[11px] font-semibold ${set ? 'text-teal-700' : 'text-gray-600'}`}>{label}</span>
        {DI && device !== 'desktop' && <DI size={11} className="text-gray-400" aria-label={`${device} value`} />}
        {set && onReset && (
          <button type="button" onClick={onReset} title="Reset to inherited value" className="ml-auto text-gray-300 hover:text-red-500"><RotateCcw size={11} /></button>
        )}
      </div>
      {children}
      {hint && <p className="text-[10.5px] text-gray-400 leading-snug">{hint}</p>}
    </div>
  );
}

export function Group({ title, children, defaultOpen = true, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50/80">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500">{title}</span>
        {badge}
        <ChevronDown size={13} className={`ml-auto text-gray-400 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-0.5 space-y-3">{children}</div>}
    </div>
  );
}

export function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

/* ─── Inputs ────────────────────────────────────────────────────────────── */

export function TextIn({ value, onChange, placeholder, mono, type = 'text' }: { value?: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; type?: string }) {
  return <input type={type} className={`${inputCls} ${mono ? 'font-mono text-[11px]' : ''}`} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

export function SelectIn({ value, onChange, options, placeholder }: { value?: string; onChange: (v: string) => void; options: [string, string][]; placeholder?: string }) {
  return (
    <select className={`${inputCls} pr-6`} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none py-0.5">
      <span className="text-[12px] text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition shrink-0 ${checked ? 'bg-teal-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: {
  value?: T; onChange: (v: T) => void; options: { value: T; label?: string; icon?: React.ReactNode; title?: string }[]; size?: 'sm' | 'md';
}) {
  return (
    <div className="flex p-0.5 rounded-md bg-gray-100 gap-0.5">
      {options.map(o => (
        <button key={o.value} type="button" title={o.title || o.label} onClick={() => onChange(o.value)}
          className={`flex-1 flex items-center justify-center gap-1 rounded ${size === 'sm' ? 'h-6 text-[10.5px]' : 'h-7 text-[11px]'} font-semibold transition ${value === o.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

const UNITS = ['px', '%', 'rem', 'em', 'vh', 'vw', 'auto'];

/** Number + unit. Stored as a string: "24" (px), "50%", "2rem", "auto" or any CSS length/calc(). */
export function UnitIn({ value, onChange, placeholder, units = UNITS, min }: { value?: string; onChange: (v: string) => void; placeholder?: string; units?: string[]; min?: number }) {
  const raw = String(value ?? '');
  const m = raw.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
  const num = m ? m[1] : raw === 'auto' ? '' : raw;
  const unit = raw === 'auto' ? 'auto' : m ? (m[2] || 'px') : raw ? '' : 'px';
  const set = (n: string, u: string) => {
    if (u === 'auto') return onChange('auto');
    if (n === '') return onChange('');
    if (!/^-?\d*\.?\d*$/.test(n)) return onChange(n); // calc(), clamp() etc.
    onChange(u === 'px' ? n : `${n}${u}`);
  };
  const step = (d: number) => {
    const cur = Number(num) || 0;
    const next = Math.max(min ?? -Infinity, cur + d);
    set(String(Math.round(next * 100) / 100), unit || 'px');
  };
  return (
    <div className="flex h-8 rounded-md border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-teal-600/20 focus-within:border-teal-600 overflow-hidden">
      <input className="flex-1 min-w-0 px-2 text-[12px] outline-none bg-transparent" value={unit === 'auto' ? 'auto' : num} placeholder={placeholder}
        disabled={unit === 'auto'}
        onChange={e => set(e.target.value, unit || 'px')}
        onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); step(e.shiftKey ? 10 : 1); } if (e.key === 'ArrowDown') { e.preventDefault(); step(e.shiftKey ? -10 : -1); } }} />
      <select className="text-[10.5px] font-semibold text-gray-500 bg-gray-50 border-l border-gray-200 px-1 outline-none cursor-pointer" value={unit} onChange={e => set(num, e.target.value)}>
        {!units.includes(unit) && <option value={unit}>{unit || '—'}</option>}
        {units.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

export function RangeIn({ value, onChange, min = 0, max = 100, step = 1, unit = '' }: { value?: number | string; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  const v = Number(value ?? min);
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={Number.isFinite(v) ? v : min} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-teal-600 h-1" />
      <div className="flex items-center h-7 w-[68px] rounded-md border border-gray-200 bg-white overflow-hidden">
        <input className="w-full px-1.5 text-[11.5px] outline-none text-right" value={Number.isFinite(v) ? v : ''} onChange={e => onChange(Number(e.target.value) || 0)} />
        {unit && <span className="pr-1.5 text-[10px] text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

/* ─── Colour ────────────────────────────────────────────────────────────── */

const TOKEN_SWATCHES = ['primary', 'primary-dark', 'accent', 'gold', 'ink', 'sand', 'muted', 'text', 'white'];
const EXTRA = ['transparent', '#00732F', '#C8102E', '#000000', 'rgba(255,255,255,.75)', 'rgba(0,0,0,.5)'];

function toHex(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split('').map(c => c + c).join('')}`;
  return '#0F5468';
}

export function ColorIn({ value, onChange, placeholder = 'Theme default' }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const v = value || '';
  const preview = THEME_TOKENS[v] || v;
  return (
    <div ref={ref} className="relative">
      <div className="flex h-8 rounded-md border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-600/20 focus-within:border-teal-600">
        <button type="button" onClick={() => setOpen(o => !o)} className="w-8 shrink-0 border-r border-gray-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:8px_8px]" title="Pick a colour">
          <span className="block w-full h-full" style={{ background: preview || 'transparent' }} />
        </button>
        <input className="flex-1 min-w-0 px-2 text-[11.5px] font-mono outline-none" value={v} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        {v && <button type="button" onClick={() => onChange('')} className="px-1.5 text-gray-300 hover:text-red-500" title="Clear"><RotateCcw size={11} /></button>}
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl p-2.5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Theme colours</p>
          <div className="grid grid-cols-9 gap-1">
            {TOKEN_SWATCHES.map(t => (
              <button key={t} type="button" title={t} onClick={() => { onChange(t); setOpen(false); }}
                className={`aspect-square rounded-md border ${v === t ? 'ring-2 ring-teal-600 ring-offset-1' : 'border-black/10'}`} style={{ background: THEME_TOKENS[t] }} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {EXTRA.map(c => (
              <button key={c} type="button" title={c} onClick={() => { onChange(c); setOpen(false); }}
                className="h-6 rounded-md border border-black/10 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:8px_8px] overflow-hidden"><span className="block w-full h-full" style={{ background: c }} /></button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
            Custom
            <input type="color" value={toHex(v)} onChange={e => onChange(e.target.value)} className="h-7 flex-1 rounded border border-gray-200 cursor-pointer" />
          </label>
          <p className="text-[10px] text-gray-400 leading-snug">Theme colours follow the website theme. Any CSS colour also works, e.g. rgba(0,0,0,.4).</p>
        </div>
      )}
    </div>
  );
}

/* ─── Spacing box ───────────────────────────────────────────────────────── */

type Sides = { t?: string; r?: string; b?: string; l?: string };

/** Four-sided input (margin or padding) with a link toggle. */
export function SidesIn({ value, onChange, placeholders = {}, label }: { value: Sides; onChange: (v: Sides) => void; placeholders?: Sides; label: string }) {
  const allSame = value.t === value.r && value.r === value.b && value.b === value.l;
  const [linked, setLinked] = useState(allSame && !!value.t);
  const set = (k: keyof Sides, v: string) => onChange(linked ? { t: v, r: v, b: v, l: v } : { ...value, [k]: v });
  const cell = (k: keyof Sides, title: string) => (
    <div className="flex flex-col items-center gap-0.5">
      <input aria-label={`${label} ${title}`} className="w-full h-7 rounded border border-gray-200 bg-white text-center text-[11.5px] outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30"
        value={value[k] ?? ''} placeholder={placeholders[k] || '–'}
        onChange={e => set(k, e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const n = (parseFloat(String(value[k] ?? placeholders[k] ?? '0')) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
          set(k, String(n));
        }} />
      <span className="text-[9.5px] uppercase tracking-wide text-gray-400">{title}</span>
    </div>
  );
  return (
    <div className="flex items-start gap-1.5">
      <div className="grid grid-cols-4 gap-1 flex-1">{cell('t', 'Top')}{cell('r', 'Right')}{cell('b', 'Bottom')}{cell('l', 'Left')}</div>
      <button type="button" onClick={() => setLinked(l => !l)} title={linked ? 'Unlink sides' : 'Link all sides'}
        className={`mt-0.5 grid place-items-center w-7 h-7 rounded border transition ${linked ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-200 text-gray-400 hover:text-gray-700'}`}>
        {linked ? <Link2 size={13} /> : <Link2Off size={13} />}
      </button>
    </div>
  );
}

/* ─── Font & icon pickers ───────────────────────────────────────────────── */

export function FontIn({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <select className={inputCls} value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ fontFamily: value && FONT_FAMILIES[value] ? `'${value}'` : undefined }}>
      <option value="">Inherit</option>
      <option value="heading">Theme heading font</option>
      <option value="body">Theme body font</option>
      <optgroup label="Sans-serif">{Object.entries(FONT_FAMILIES).filter(([, f]) => f.kind === 'sans').map(([n]) => <option key={n} value={n}>{n}</option>)}</optgroup>
      <optgroup label="Serif">{Object.entries(FONT_FAMILIES).filter(([, f]) => f.kind === 'serif').map(([n]) => <option key={n} value={n}>{n}</option>)}</optgroup>
    </select>
  );
}

export function IconIn({ value, onChange, allowEmpty = true }: { value?: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const names = useMemo(() => PB_ICON_NAMES.filter(n => !q || n.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={`${inputCls} flex items-center gap-2 text-left`}>
        <span className="grid place-items-center w-5 h-5 rounded bg-teal-50 text-teal-700">{value ? <PBIcon name={value} size={13} /> : null}</span>
        <span className="flex-1 truncate">{value || 'None'}</span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl p-2">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${PB_ICON_NAMES.length} icons`} className={`${inputCls} pl-7`} />
          </div>
          <div className="grid grid-cols-7 gap-1 max-h-52 overflow-y-auto">
            {allowEmpty && <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="aspect-square rounded-lg text-[10px] text-gray-400 hover:bg-gray-100">None</button>}
            {names.map(n => (
              <button key={n} type="button" title={n} onClick={() => { onChange(n); setOpen(false); setQ(''); }}
                className={`grid place-items-center aspect-square rounded-lg transition ${n === value ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <PBIcon name={n} size={16} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
