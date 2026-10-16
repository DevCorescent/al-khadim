'use client';
import { useMemo, useState } from 'react';
import {
  BadgeDollarSign, BarChart3, BarChartHorizontal, Bookmark, BoxSelect, Briefcase, Building2, ChevronRight, ClipboardList, Code2,
  Columns2, Eye, EyeOff, GalleryHorizontal, Grid3x3, GripVertical, Hash, Heading, Image, Info, LayoutGrid, LayoutPanelLeft,
  ListChecks, ListCollapse, Lock, MapPin, Megaphone, MessageSquareQuote, Milestone, Minus, MoveHorizontal, MoveVertical, PanelTop,
  PanelsTopLeft, PictureInPicture2, Pilcrow, PlayCircle, Quote, RectangleHorizontal, Rows3, Search, Share2, Sparkles, Square, Star,
  Table, Timer, Trash2, Unlock, Users, type LucideIcon,
} from 'lucide-react';

const UI_ICONS: Record<string, LucideIcon> = {
  BadgeDollarSign, BarChart3, BarChartHorizontal, Bookmark, BoxSelect, Briefcase, Building2, ClipboardList, Code2, Columns2,
  GalleryHorizontal, Grid3x3, Hash, Heading, Image, Info, LayoutGrid, LayoutPanelLeft, ListChecks, ListCollapse, MapPin, Megaphone,
  MessageSquareQuote, Milestone, Minus, MoveHorizontal, MoveVertical, PanelTop, PanelsTopLeft, PictureInPicture2, Pilcrow,
  PlayCircle, Quote, RectangleHorizontal, Rows3, Share2, Sparkles, Square, Star, Table, Timer, Users,
};
import { CATEGORIES, ELEMENTS, ELEMENT_BY_TYPE } from '@/lib/pageBuilder/elements';
import { BLOCK_TEMPLATES } from '@/lib/pageBuilder/templates';
import { levelOf, nodeTitle } from '@/lib/pageBuilder/doc';
import type { PBNode } from '@/lib/pageBuilder/types';
import { setDrag, startDrag, getDrag, payloadLevel, type DragPayload } from './dnd';

/** Element icons for the palette and layers (names come from the element registry). */
export function UiIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const C = UI_ICONS[name] || Square;
  return <C size={size} className={className} />;
}

/* ─── Elements ──────────────────────────────────────────────────────────── */

export function ElementsPanel({ onAdd }: { onAdd: (type: string) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? ELEMENTS.filter(e => `${e.label} ${e.description} ${e.keywords || ''} ${e.category}`.toLowerCase().includes(s)) : ELEMENTS;
  }, [q]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${ELEMENTS.length} elements`} className="w-full h-8 rounded-lg border border-gray-200 pl-8 pr-2 text-[12px] outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20" />
        </div>
        <p className="text-[10.5px] text-gray-400 mt-2">Drag onto the canvas, or click to add after the selection.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {CATEGORIES.map(cat => {
          const items = list.filter(e => e.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-2">{cat}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {items.map(e => (
                  <button key={e.type} type="button" draggable title={e.description}
                    onDragStart={ev => startDrag(ev, { kind: 'new', type: e.type }, e.label)} onDragEnd={() => setDrag(null)}
                    onClick={() => onAdd(e.type)}
                    className="group flex flex-col items-center justify-center gap-1.5 h-[70px] rounded-xl border border-gray-200 bg-white text-center cursor-grab active:cursor-grabbing select-none transition hover:border-teal-500 hover:shadow-md hover:-translate-y-px">
                    <span className="text-gray-500 group-hover:text-teal-600 transition"><UiIcon name={e.icon} size={18} /></span>
                    <span className="text-[10.5px] font-semibold text-gray-700 leading-tight px-1">{e.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!list.length && <p className="text-center text-xs text-gray-400 py-8">No elements match “{q}”.</p>}
      </div>
    </div>
  );
}

/* ─── Blocks ────────────────────────────────────────────────────────────── */

export interface SavedBlock { id: string; name: string; category: string; content: PBNode }

export function BlocksPanel({ saved, onInsert, onDeleteSaved }: { saved: SavedBlock[]; onInsert: (build: () => PBNode, label: string) => void; onDeleteSaved: (id: string) => void }) {
  const cats = useMemo(() => ['All', ...Array.from(new Set(BLOCK_TEMPLATES.map(b => b.category))), ...(saved.length ? ['Saved'] : [])], [saved.length]);
  const [cat, setCat] = useState('All');
  const blocks = BLOCK_TEMPLATES.filter(b => cat === 'All' || b.category === cat);
  const clone = (n: PBNode) => () => JSON.parse(JSON.stringify(n)) as PBNode;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-100 flex flex-wrap gap-1">
        {cats.map(c => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition ${cat === c ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(cat === 'All' || cat === 'Saved') && saved.map(b => (
          <div key={b.id} draggable onDragStart={e => startDrag(e, { kind: 'block', label: b.name, build: clone(b.content) }, b.name)} onDragEnd={() => setDrag(null)}
            className="group flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 cursor-grab hover:shadow-md transition">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700 shrink-0"><Bookmark size={15} /></span>
            <button type="button" onClick={() => onInsert(clone(b.content), b.name)} className="flex-1 min-w-0 text-left">
              <p className="text-[12px] font-bold text-gray-800 truncate">{b.name}</p>
              <p className="text-[10.5px] text-gray-500 truncate">Saved · {b.category}</p>
            </button>
            <button type="button" onClick={() => onDeleteSaved(b.id)} title="Delete saved block" className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        ))}
        {cat !== 'Saved' && blocks.map(b => (
          <div key={b.id} draggable onDragStart={e => startDrag(e, { kind: 'block', label: b.label, build: b.build }, b.label)} onDragEnd={() => setDrag(null)}
            onClick={() => onInsert(b.build, b.label)}
            className="group rounded-xl border border-gray-200 bg-white p-2.5 cursor-grab active:cursor-grabbing hover:border-teal-500 hover:shadow-md transition">
            <BlockThumb id={b.id} />
            <p className="mt-2 text-[12px] font-bold text-gray-800">{b.label}</p>
            <p className="text-[10.5px] text-gray-500 leading-snug">{b.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A tiny schematic of a block (not a live render — keeps the panel light). */
function BlockThumb({ id }: { id: string }) {
  const dark = /hero-centered|page-header|stats|launch|ticker/.test(id);
  const bar = (w: string, c = dark ? 'bg-white/70' : 'bg-gray-300', h = 'h-1.5') => <span className={`block ${h} rounded-full ${c}`} style={{ width: w }} />;
  const box = 'rounded-md';
  const inner = (() => {
    if (id.startsWith('hero') || id === 'page-header' || id === 'launch') return (
      <div className={`flex flex-col ${id === 'hero-split' ? 'items-start' : 'items-center'} justify-center gap-1 h-full`}>
        {id === 'hero-split'
          ? <div className="flex gap-2 w-full h-full items-center"><div className="flex-1 space-y-1">{bar('80%', 'bg-gray-400', 'h-2')}{bar('60%')}<span className="block h-2.5 w-8 rounded bg-teal-600" /></div><div className="w-2/5 h-4/5 rounded bg-gray-200" /></div>
          : <>{bar('55%', dark ? 'bg-white' : 'bg-gray-500', 'h-2')}{bar('38%')}<div className="flex gap-1 mt-1"><span className="h-2.5 w-7 rounded bg-amber-400" /><span className="h-2.5 w-7 rounded bg-white/60" /></div></>}
      </div>
    );
    if (/features|icon-boxes|team|pricing|testimonials|gallery|jobs/.test(id)) return (
      <div className="flex flex-col gap-1.5 h-full justify-center">
        <div className="flex justify-center">{bar('40%', 'bg-gray-400', 'h-1.5')}</div>
        <div className="grid grid-cols-3 gap-1">{[0, 1, 2].map(i => <span key={i} className={`h-7 ${box} ${id === 'pricing' && i === 1 ? 'bg-teal-600' : 'bg-gray-200'}`} />)}</div>
      </div>
    );
    if (/image-text|text-image|faq|contact/.test(id)) return (
      <div className={`flex gap-2 h-full items-center ${id === 'text-image' ? 'flex-row-reverse' : ''}`}>
        <div className={`w-2/5 h-4/5 ${box} ${id === 'contact' || id === 'faq' ? 'bg-white border border-gray-200' : 'bg-gray-200'}`} />
        <div className="flex-1 space-y-1">{bar('70%', 'bg-gray-400', 'h-2')}{bar('90%')}{bar('80%')}</div>
      </div>
    );
    return <div className="flex flex-col gap-1 h-full justify-center items-center">{bar('50%', dark ? 'bg-white' : 'bg-gray-400', 'h-2')}{bar('80%')}{bar('65%')}</div>;
  })();
  return (
    <div className={`h-[74px] rounded-lg p-2.5 overflow-hidden ${dark ? 'bg-gradient-to-br from-[#0A3D4C] to-[#061E26]' : 'bg-gray-50 border border-gray-100'}`}>{inner}</div>
  );
}

/* ─── Layers ────────────────────────────────────────────────────────────── */

interface LayerCtx {
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggle: (id: string, key: 'hidden' | 'locked') => void;
  onMove: (payload: DragPayload, parentId: string | null, index: number) => void;
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  over: { id: string; pos: 'before' | 'after' | 'inside' } | null;
  setOver: React.Dispatch<React.SetStateAction<{ id: string; pos: 'before' | 'after' | 'inside' } | null>>;
}

function LayerRow({ n, depth, parent, index, ctx }: { n: PBNode; depth: number; parent: PBNode | null; index: number; ctx: LayerCtx }) {
const { selectedId, hoveredId, onSelect, onHover, onToggle, onMove, collapsed, setCollapsed, over, setOver } = ctx;
  const lv = levelOf(n);
  const kids = n.children || [];
  const open = !collapsed[n.id];
  const sel = n.id === selectedId;
  const icon = ELEMENT_BY_TYPE[n.type]?.icon || 'Square';
  const isOver = over?.id === n.id;
  const onDragOver = (e: React.DragEvent) => {
    const p = getDrag();
    if (!p) return;
    const pl = payloadLevel(p);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    if (pl === lv) { e.preventDefault(); setOver({ id: n.id, pos: half }); }
    else if (pl === 'element' && lv === 'column') { e.preventDefault(); setOver({ id: n.id, pos: 'inside' }); }
    else if (pl === 'column' && lv === 'section') { e.preventDefault(); setOver({ id: n.id, pos: 'inside' }); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const p = getDrag();
    setDrag(null);
    const o = over;
    setOver(null);
    if (!p || !o) return;
    if (o.pos === 'inside') onMove(p, n.id, kids.length);
    else onMove(p, parent?.id ?? null, index + (o.pos === 'after' ? 1 : 0));
  };
  return (
    <div>
      <div draggable={!n.adv?.locked}
        onDragStart={e => { e.stopPropagation(); startDrag(e, { kind: 'move', id: n.id, level: lv }, nodeTitle(n)); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        onDragOver={onDragOver} onDragLeave={() => setOver(o => (o?.id === n.id ? null : o))} onDrop={onDrop}
        onMouseEnter={() => onHover(n.id)} onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(n.id)}
        className={`group relative flex items-center gap-1 h-7 pr-1.5 rounded-md cursor-pointer text-[12px] transition
          ${sel ? 'bg-teal-600 text-white' : n.id === hoveredId ? 'bg-teal-50 text-gray-900' : 'text-gray-700 hover:bg-gray-100'}
          ${n.adv?.hidden ? 'opacity-50' : ''} ${isOver && over?.pos === 'inside' ? 'ring-2 ring-teal-500' : ''}`}
        style={{ paddingLeft: 4 + depth * 14 }}>
        {isOver && over?.pos !== 'inside' && <span className="absolute left-2 right-2 h-0.5 bg-teal-500 rounded" style={{ [over!.pos === 'before' ? 'top' : 'bottom']: -1 }} />}
        {kids.length ? (
          <button type="button" onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [n.id]: open })); }} className="grid place-items-center w-4 h-4 shrink-0">
            <ChevronRight size={12} className={`transition ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : <span className="w-4 shrink-0" />}
        <GripVertical size={11} className={`shrink-0 ${sel ? 'text-white/60' : 'text-gray-300'} ${n.adv?.locked ? 'invisible' : ''}`} />
        <UiIcon name={icon} size={12} className={`shrink-0 ${sel ? 'text-white' : lv === 'section' ? 'text-blue-600' : lv === 'column' ? 'text-purple-600' : 'text-teal-700'}`} />
        <span className={`truncate flex-1 ${lv === 'section' ? 'font-semibold' : ''}`}>{lv === 'column' ? `Column · ${n.style?.desktop?.width ? `${Math.round(parseFloat(n.style.desktop.width))}%` : 'auto'}` : nodeTitle(n)}</span>
        <button type="button" title={n.adv?.locked ? 'Unlock' : 'Lock'} onClick={e => { e.stopPropagation(); onToggle(n.id, 'locked'); }}
          className={`grid place-items-center w-5 h-5 rounded ${n.adv?.locked ? '' : 'opacity-0 group-hover:opacity-100'} ${sel ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}>
          {n.adv?.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
        <button type="button" title={n.adv?.hidden ? 'Enable' : 'Disable (hide on the site)'} onClick={e => { e.stopPropagation(); onToggle(n.id, 'hidden'); }}
          className={`grid place-items-center w-5 h-5 rounded ${n.adv?.hidden ? '' : 'opacity-0 group-hover:opacity-100'} ${sel ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}>
          {n.adv?.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      {open && kids.map((k, i) => <LayerRow key={k.id} n={k} depth={depth + 1} parent={n} index={i} ctx={ctx} />)}
    </div>
  );
}

export function LayersPanel({ sections, selectedId, hoveredId, onSelect, onHover, onToggle, onMove }: {
  sections: PBNode[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggle: (id: string, key: 'hidden' | 'locked') => void;
  onMove: (payload: DragPayload, parentId: string | null, index: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [over, setOver] = useState<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  if (!sections.length) return <p className="p-6 text-center text-xs text-gray-400">The page is empty. Add a section or a block to see its structure here.</p>;
  const ctx: LayerCtx = { selectedId, hoveredId, onSelect, onHover, onToggle, onMove, collapsed, setCollapsed, over, setOver };

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[10.5px] text-gray-400">Drag rows to reorder · click to select</p>
        <button type="button" className="text-[10.5px] font-semibold text-teal-700 hover:underline"
          onClick={() => setCollapsed(Object.keys(collapsed).length ? {} : Object.fromEntries(sections.map(s => [s.id, true])))}>
          {Object.keys(collapsed).length ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      {sections.map((s, i) => <LayerRow key={s.id} n={s} depth={0} parent={null} index={i} ctx={ctx} />)}
    </div>
  );
}
