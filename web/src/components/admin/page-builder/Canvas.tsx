'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpToLine, BookmarkPlus, ClipboardPaste, Columns2, Copy, CopyPlus, GripVertical, LayoutTemplate,
  Lock, MousePointerClick, PencilLine, Plus, Trash2,
} from 'lucide-react';
import PageRenderer from '@/components/pageBuilder/PageRenderer';
import type { InlineEdit } from '@/components/pageBuilder/ui';
import { ELEMENT_BY_TYPE, LAYOUTS } from '@/lib/pageBuilder/elements';
import { findNode, levelOf } from '@/lib/pageBuilder/doc';
import { DEVICE_WIDTH, type Device, type PBNode, type PageDoc } from '@/lib/pageBuilder/types';
import { computeDrop, getDrag, payloadLevel, setDrag, startDrag, type DragPayload, type DropTarget } from './dnd';

export type CanvasAction = 'parent' | 'up' | 'down' | 'duplicate' | 'copy' | 'paste' | 'delete' | 'saveBlock' | 'addColumn' | 'editText';

interface Box { x: number; y: number; w: number; h: number }

export interface CanvasProps {
  doc: PageDoc;
  device: Device;
  themeStyle: React.CSSProperties;
  fontsHref?: string;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onDrop: (payload: DragPayload, target: DropTarget) => void;
  onAction: (action: CanvasAction, id: string) => void;
  onAddSection: (index: number, widths: number[]) => void;
  onResizeColumns: (leftId: string, rightId: string, left: number, right: number) => void;
  inline: InlineEdit | null;
  onInline: (v: InlineEdit | null) => void;
  onInlineCommit: (id: string, key: string, value: string) => void;
  zoom: 'fit' | 100;
  canPaste: boolean;
}

const LEVEL_COLOR = { section: '#2563EB', column: '#9333EA', element: '#0F766E' } as const;

export default function Canvas(props: CanvasProps) {
  const { doc, device, selectedId, hoveredId, onSelect, onHover, inline } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(1000);
  const [innerH, setInnerH] = useState(800);
  const [tick, setTick] = useState(0);
  const [drop, setDropState] = useState<DropTarget | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);

  // Desktop is laid out at a real desktop width (so desktop styles apply) and scaled to fit.
  const width = device === 'desktop' ? Math.max(DEVICE_WIDTH.desktop, Math.min(1600, avail)) : DEVICE_WIDTH[device];
  const scale = props.zoom === 100 ? 1 : Math.min(1, avail / width);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(Math.max(320, e.contentRect.width - 48)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let last = -1;
    // Only a real size change moves the overlays; avoids render feedback loops.
    const ro = new ResizeObserver(() => { const h = el.offsetHeight; if (h === last) return; last = h; setInnerH(h); setTick(t => t + 1); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { setTick(t => t + 1); }, [doc, device, selectedId, hoveredId, scale]);

  /* ─── Geometry ─────────────────────────────────────────────────────────── */

  const boxOf = useCallback((id: string | null): Box | null => {
    if (!id || !wrapRef.current) return null;
    const el = wrapRef.current.querySelector<HTMLElement>(`[data-pb-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const b = wrapRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left - b.left) / scale, y: (r.top - b.top) / scale, w: r.width / scale, h: r.height / scale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, tick]);

  /* ─── Pointer & keyboard on the canvas ─────────────────────────────────── */

  const idAt = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-pb-id]')?.dataset.pbId || null;

  const onClickCapture = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    setMenu(null);
    if (t.closest('[data-pb-inline]') || t.closest('[data-pb-ui]')) return;
    // Links and submit buttons stay inert; tabs, accordions and sliders still respond.
    if (t.closest('a, button[type="submit"], form')) e.preventDefault();
    const id = idAt(t);
    if (id) onSelect(id);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const id = idAt(e.target);
    if (!id) return;
    const at = findNode(doc.sections, id);
    if (at?.node.type === 'heading') props.onInline({ id, key: 'text' });
    else if (at?.node.type === 'text') props.onInline({ id, key: 'html' });
  };
  const onMouseOver = (e: React.MouseEvent) => {
    if (getDrag()) return;
    const id = idAt(e.target);
    if (id !== hoveredId) onHover(id);
  };

  const onDragOver = (e: React.DragEvent) => {
    const p = getDrag();
    if (!p || !rootRef.current || !wrapRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = p.kind === 'move' ? 'move' : 'copy';
    const base = wrapRef.current.getBoundingClientRect();
    const t = computeDrop(e.clientX, e.clientY, e.target as Element, rootRef.current, base, payloadLevel(p));
    if (t && p.kind === 'move' && (t.parentId === p.id)) { setDropState(null); return; }
    setDropState(t ? { ...t, line: { x: t.line.x / scale, y: t.line.y / scale, w: t.line.w / scale, h: t.line.h / scale } } : null);
  };
  const onDropEv = (e: React.DragEvent) => {
    e.preventDefault();
    const p = getDrag();
    const t = drop;
    setDropState(null);
    setDrag(null);
    if (p && t) props.onDrop(p, t);
  };
  useEffect(() => {
    const end = () => { setDropState(null); };
    window.addEventListener('dragend', end);
    return () => window.removeEventListener('dragend', end);
  }, []);

  /* ─── Column resizing ──────────────────────────────────────────────────── */

  const [resizing, setResizing] = useState<{ left: number; right: number } | null>(null);
  const startResize = (e: React.PointerEvent, col: PBNode, next: PBNode) => {
    e.preventDefault();
    e.stopPropagation();
    const row = wrapRef.current?.querySelector<HTMLElement>(`[data-pb-id="${CSS.escape(col.id)}"]`)?.parentElement;
    const a = wrapRef.current?.querySelector<HTMLElement>(`[data-pb-id="${CSS.escape(col.id)}"]`);
    const b = wrapRef.current?.querySelector<HTMLElement>(`[data-pb-id="${CSS.escape(next.id)}"]`);
    if (!row || !a || !b) return;
    const rowW = row.getBoundingClientRect().width;
    const wa = (a.getBoundingClientRect().width / rowW) * 100;
    const wb = (b.getBoundingClientRect().width / rowW) * 100;
    const total = wa + wb;
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => {
      let left = wa + ((ev.clientX - x0) / rowW) * 100;
      left = Math.max(5, Math.min(total - 5, left));
      left = Math.round(left * 2) / 2;
      const right = Math.round((total - left) * 2) / 2;
      setResizing({ left, right });
      props.onResizeColumns(col.id, next.id, left, right);
    };
    const up = () => { setResizing(null); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ─── Overlay pieces ───────────────────────────────────────────────────── */

  const selected = selectedId ? findNode(doc.sections, selectedId) : null;
  const selLevel = selected ? levelOf(selected.node) : null;
  const selBox = boxOf(selectedId);
  const hovBox = hoveredId && hoveredId !== selectedId ? boxOf(hoveredId) : null;
  const hovNode = hoveredId ? findNode(doc.sections, hoveredId)?.node : null;
  const inv = 1 / scale;

  // Section under the pointer (or selected) gets "add section" buttons on its edges.
  const sectionId = selected ? (selLevel === 'section' ? selected.node.id : selected.path[0]?.id) : hovNode ? (levelOf(hovNode) === 'section' ? hovNode.id : findNode(doc.sections, hovNode.id)?.path[0]?.id) : null;
  const sectionBox = boxOf(sectionId || null);
  const sectionIndex = sectionId ? doc.sections.findIndex(s => s.id === sectionId) : -1;

  // Resize handles between the columns of the selected/hovered section.
  const handleSection = sectionId ? doc.sections.find(s => s.id === sectionId) : null;
  const handles = handleSection && (handleSection.children || []).length > 1 ? (handleSection.children || []).slice(0, -1).map((c, i) => {
    const next = handleSection.children![i + 1];
    const a = boxOf(c.id), b = boxOf(next.id);
    if (!a || !b || b.x < a.x + a.w - 2) return null; // wrapped onto a new line: no handle
    const top = Math.min(a.y, b.y);
    return { c, next, x: (a.x + a.w + b.x) / 2, y: top, h: Math.max(a.y + a.h, b.y + b.h) - top };
  }).filter(Boolean) as { c: PBNode; next: PBNode; x: number; y: number; h: number }[] : [];

  const label = (n: PBNode) => n.adv?.label || ELEMENT_BY_TYPE[n.type]?.label || n.type;
  const tb = (icon: React.ReactNode, title: string, action: CanvasAction, disabled = false) => (
    <button key={action} type="button" title={title} disabled={disabled} data-pb-ui
      onClick={e => { e.stopPropagation(); props.onAction(action, selectedId!); }}
      className="grid place-items-center w-7 h-7 rounded-md text-white/90 hover:bg-white/20 disabled:opacity-30">{icon}</button>
  );

  return (
    <div ref={scrollRef} className="flex-1 min-w-0 overflow-auto bg-[#e7eaee] [background-image:radial-gradient(#cfd5dc_1px,transparent_1px)] [background-size:18px_18px]"
      onMouseLeave={() => onHover(null)}
      onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}>
      <div className="mx-auto py-6" style={{ width: width * scale + 0, minHeight: '100%' }}
        onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}>
        <div style={{ width: width * scale, height: innerH * scale, position: 'relative' }}>
          <div ref={wrapRef} className="absolute left-0 top-0 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,.35)] rounded-sm"
            style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left', ...props.themeStyle }}
            onClickCapture={onClickCapture} onDoubleClick={onDoubleClick} onMouseOver={onMouseOver}
            onContextMenu={e => { const id = idAt(e.target); if (!id) return; e.preventDefault(); onSelect(id); setMenu({ x: e.clientX, y: e.clientY, id }); }}
            onDragOver={onDragOver} onDrop={onDropEv} onDragLeave={e => { if (e.currentTarget === e.target) setDropState(null); }}>
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            {props.fontsHref && <link rel="stylesheet" href={props.fontsHref} />}
            {doc.settings.showNavbar && (
              <div data-pb-ui className={`flex items-center gap-3 px-6 h-14 border-b border-dashed border-gray-300 bg-gray-50 text-[12px] text-gray-400 font-medium ${doc.settings.navOverlay ? 'absolute left-0 right-0 top-0 z-[5] bg-white/40 backdrop-blur' : ''}`}>
                <LayoutTemplate size={14} /> Site navigation bar {doc.settings.navOverlay ? '(floats over the first section)' : ''}
              </div>
            )}
            <PageRenderer doc={doc} editing rootRef={rootRef} inline={inline} onInlineCommit={props.onInlineCommit} />
            {!doc.sections.length && (
              <div data-pb-ui className="m-8 rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
                <MousePointerClick className="mx-auto text-teal-600 mb-3" size={30} />
                <p className="text-lg font-bold text-gray-800">Start building your page</p>
                <p className="text-sm text-gray-500 mt-1">Drag elements or blocks from the left panel, or pick a structure:</p>
                <div className="mt-6 grid grid-cols-4 gap-3 max-w-xl mx-auto">
                  {LAYOUTS.slice(0, 8).map((l, i) => (
                    <button key={i} type="button" data-pb-ui title={l.map(w => `${Math.round(w)}%`).join(' / ')} onClick={() => props.onAddSection(0, l)} className="flex gap-1 h-12 p-1.5 rounded-lg border border-gray-200 bg-white hover:border-teal-600 hover:shadow">
                      {l.map((w, k) => <span key={k} className="rounded bg-gray-200" style={{ width: `${w}%` }} />)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {doc.settings.showFooter && (
              <div data-pb-ui className="flex items-center justify-center h-16 border-t border-dashed border-gray-300 bg-gray-50 text-[12px] text-gray-400 font-medium">Site footer</div>
            )}

            {/* ─── Overlays ─── */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
              {hovBox && hovNode && (
                <div className="absolute" style={{ left: hovBox.x, top: hovBox.y, width: hovBox.w, height: hovBox.h, outline: `${1.5 * inv}px ${levelOf(hovNode) === 'column' ? 'dashed' : 'solid'} ${LEVEL_COLOR[levelOf(hovNode)]}`, outlineOffset: -1 }}>
                  <span className="absolute left-0 whitespace-nowrap text-white font-semibold rounded-sm px-1.5" style={{ top: 0, transform: `translateY(-100%) scale(${inv})`, transformOrigin: 'bottom left', background: LEVEL_COLOR[levelOf(hovNode)], fontSize: 10.5, lineHeight: '17px' }}>{label(hovNode)}</span>
                </div>
              )}

              {sectionBox && sectionIndex >= 0 && !getDrag() && (
                <>
                  {[sectionIndex, sectionIndex + 1].map((idx, k) => (
                    <div key={k} className="absolute pointer-events-auto" data-pb-ui style={{ left: sectionBox.x + sectionBox.w / 2, top: k === 0 ? sectionBox.y : sectionBox.y + sectionBox.h, transform: `translate(-50%, -50%) scale(${inv})`, zIndex: 3 }}>
                      <button type="button" data-pb-ui title={k === 0 ? 'Add section above' : 'Add section below'} onClick={e => { e.stopPropagation(); setAddAt(addAt === idx ? null : idx); }}
                        className="grid place-items-center w-6 h-6 rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white hover:scale-110 transition"><Plus size={14} /></button>
                      {addAt === idx && (
                        <div data-pb-ui className="absolute left-1/2 -translate-x-1/2 top-8 w-[264px] rounded-xl bg-white shadow-2xl border border-gray-200 p-2.5">
                          <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-2">Choose a structure</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {LAYOUTS.map((l, i) => (
                              <button key={i} type="button" data-pb-ui title={l.map(w => `${Math.round(w)}%`).join(' / ')} onClick={e => { e.stopPropagation(); props.onAddSection(idx, l); setAddAt(null); }} className="flex gap-[3px] h-8 p-1 rounded-md border border-gray-200 hover:border-blue-600">
                                {l.map((w, j) => <span key={j} className="rounded-[2px] bg-gray-300" style={{ width: `${w}%` }} />)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {handles.map(h => (
                <div key={h.c.id} data-pb-ui className="absolute pointer-events-auto group" style={{ left: h.x - 6 * inv, top: h.y, width: 12 * inv, height: h.h, cursor: 'col-resize', zIndex: 2 }}
                  onPointerDown={e => startResize(e, h.c, h.next)} title="Drag to resize columns">
                  <div className="mx-auto h-full rounded-full bg-purple-500/0 group-hover:bg-purple-500/70 transition" style={{ width: 3 * inv }} />
                  {resizing && <span className="absolute top-2 left-1/2 whitespace-nowrap rounded bg-purple-600 text-white font-semibold px-1.5" style={{ fontSize: 11, transform: `translateX(-50%) scale(${inv})`, transformOrigin: 'top center' }}>{resizing.left}% | {resizing.right}%</span>}
                </div>
              ))}

              {selBox && selected && selLevel && (
                <div className="absolute" style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h, outline: `${2 * inv}px solid ${LEVEL_COLOR[selLevel]}`, outlineOffset: -1, boxShadow: `0 0 0 ${4 * inv}px ${LEVEL_COLOR[selLevel]}22` }}>
                  <div data-pb-ui className="absolute pointer-events-auto flex items-center gap-0.5 rounded-lg px-1 py-0.5 shadow-lg"
                    style={{ background: LEVEL_COLOR[selLevel], left: 0, top: selBox.y > 40 * inv ? 0 : selBox.h, transform: `${selBox.y > 40 * inv ? 'translateY(calc(-100% - 4px))' : 'translateY(4px)'} scale(${inv})`, transformOrigin: selBox.y > 40 * inv ? 'bottom left' : 'top left' }}>
                    <span draggable={!selected.node.adv?.locked} data-pb-ui
                      onDragStart={e => startDrag(e, { kind: 'move', id: selected.node.id, level: selLevel }, label(selected.node))}
                      onDragEnd={() => setDrag(null)}
                      className={`flex items-center gap-1 pl-1 pr-2 h-7 text-[11.5px] font-bold text-white ${selected.node.adv?.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`} title="Drag to move">
                      {selected.node.adv?.locked ? <Lock size={12} /> : <GripVertical size={13} />}{label(selected.node)}
                    </span>
                    <span className="w-px h-4 bg-white/25" />
                    {selLevel !== 'section' && tb(<ArrowUpToLine size={13} />, 'Select parent (Esc)', 'parent')}
                    {tb(<ArrowUp size={13} />, 'Move up / left (Alt+↑)', 'up', !!selected.node.adv?.locked)}
                    {tb(<ArrowDown size={13} />, 'Move down / right (Alt+↓)', 'down', !!selected.node.adv?.locked)}
                    {(selected.node.type === 'heading' || selected.node.type === 'text') && tb(<PencilLine size={13} />, 'Edit text on canvas (double-click)', 'editText')}
                    {selLevel === 'column' && tb(<Columns2 size={13} />, 'Add column', 'addColumn')}
                    {tb(<CopyPlus size={13} />, 'Duplicate (⌘D)', 'duplicate')}
                    {tb(<Copy size={13} />, 'Copy (⌘C)', 'copy')}
                    {props.canPaste && tb(<ClipboardPaste size={13} />, 'Paste after (⌘V)', 'paste')}
                    {selLevel === 'section' && tb(<BookmarkPlus size={13} />, 'Save as reusable block', 'saveBlock')}
                    {tb(<Trash2 size={13} />, 'Delete (Del)', 'delete', !!selected.node.adv?.locked)}
                  </div>
                </div>
              )}

              {drop && (
                <div className="absolute" style={{
                  left: drop.line.x, top: drop.line.y, width: drop.line.w, height: drop.line.h,
                  ...(drop.box
                    ? { background: 'rgba(13,148,136,.08)', outline: `${2 * inv}px dashed #0d9488`, borderRadius: 6 }
                    : { background: drop.asSection || drop.parentId === null ? '#2563EB' : '#0d9488', borderRadius: 4, boxShadow: '0 0 0 2px rgba(255,255,255,.9)' }),
                }}>
                  {!drop.box && (
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full text-white font-bold px-2" style={{ top: drop.line.h > drop.line.w ? 8 : -9 * inv, fontSize: 10.5, lineHeight: '18px', background: drop.asSection || drop.parentId === null ? '#2563EB' : '#0d9488', transform: `scale(${inv})` }}>
                      {drop.asSection ? 'New section' : drop.parentId === null ? 'Place section here' : 'Drop here'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <div data-pb-ui className="fixed z-[200] w-52 rounded-xl bg-white shadow-2xl border border-gray-200 py-1.5 text-[12.5px]" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 320) }}
          onMouseLeave={() => setMenu(null)}>
          {([
            ['parent', 'Select parent', 'Esc'], ['duplicate', 'Duplicate', '⌘D'], ['copy', 'Copy', '⌘C'],
            ...(props.canPaste ? [['paste', 'Paste after', '⌘V']] : []),
            ['up', 'Move up', '⌥↑'], ['down', 'Move down', '⌥↓'],
            ...(findNode(doc.sections, menu.id)?.node.type === 'section' ? [['saveBlock', 'Save as block', '']] : []),
            ['delete', 'Delete', 'Del'],
          ] as [CanvasAction, string, string][]).map(([a, l, k]) => (
            <button key={a} type="button" onClick={() => { props.onAction(a, menu.id); setMenu(null); }}
              className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 ${a === 'delete' ? 'text-red-600' : 'text-gray-700'}`}>
              {l}<span className="text-[10.5px] text-gray-400">{k}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
