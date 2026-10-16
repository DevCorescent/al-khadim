'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Copy, EyeOff, GripVertical, Laptop, Loader2, Plus, Redo2, Send, Smartphone, Trash2, Undo2, X,
} from 'lucide-react';
import api from '@/lib/api';
import ScaledEmailFrame from './ScaledEmailFrame';
import { Icon } from '@/components/homepage/icons';
import { FieldList, SiteLinksDatalist } from '@/components/admin/site-builder/fields';
import {
  BLOCK_STYLE_FIELDS, EMAIL_BLOCKS, EMAIL_BLOCK_BY_TYPE, newEmailBlock, normalizeDesign, type EmailBlock, type EmailDesign,
} from '@/lib/email/blocks';
import { renderEmail } from '@/lib/email/render';
import type { EmailTheme } from '@/lib/email/theme';

export interface BuilderTag { key: string; label: string; sample?: string }

/** Fills {{tags}} with sample values for the preview. */
function withSamples(html: string, tags: BuilderTag[]) {
  const map = Object.fromEntries(tags.map(t => [t.key, t.sample ?? `[${t.label}]`]));
  return html.replace(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g, (m, k) => (map[k] !== undefined ? String(map[k]) : m));
}

/** One-line summary of a block for the structure list. */
function summary(b: EmailBlock) {
  const s = b.text || b.label || b.title || b.code || b.closing || b.alt || (b.type === 'html' ? 'Custom HTML' : '');
  return String(s || '').replace(/[*_#\[\]]/g, '').replace(/\s+/g, ' ').slice(0, 60);
}

/** Inserts text at the cursor of the focused input/textarea (keeps React state in sync). */
function insertAtCursor(token: string) {
  const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el || !('value' in el) || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    navigator.clipboard?.writeText(token);
    toast.success(`Copied ${token} — click into a field to paste it`);
    return;
  }
  const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + token + el.value.slice(end);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  requestAnimationFrame(() => el.setSelectionRange(start + token.length, start + token.length));
}

function PaletteItem({ type }: { type: string }) {
  const def = EMAIL_BLOCK_BY_TYPE[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} data-type={type}
      className={`flex flex-col items-center justify-center gap-1.5 h-[74px] rounded-xl border border-gray-200 bg-white text-center cursor-grab active:cursor-grabbing select-none transition hover:border-primary-300 hover:shadow-sm ${isDragging ? 'opacity-40' : ''}`}>
      <span className="text-primary-500"><Icon name={def.icon} size={18} /></span>
      <span className="text-[11px] font-semibold text-gray-700 leading-tight px-1">{def.label}</span>
    </div>
  );
}

function StructureRow({ b, active, onSelect, onDuplicate, onRemove }: {
  b: EmailBlock; active: boolean; onSelect: () => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.id });
  const def = EMAIL_BLOCK_BY_TYPE[b.type];
  return (
    <div ref={setNodeRef}
      style={{ transform: transform ? `translate3d(0,${Math.round(transform.y)}px,0)` : undefined, transition, zIndex: isDragging ? 10 : undefined }}
      className={`group flex items-center gap-1 rounded-lg border transition ${active ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'} ${isDragging ? 'shadow-lg' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder" className="pl-1.5 py-2.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical size={14} />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 flex items-center gap-2 py-2 text-left">
        <span className={`grid place-items-center w-7 h-7 rounded-md shrink-0 ${active ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-500'}`}><Icon name={def?.icon} size={13} /></span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-gray-800 truncate">{def?.label}</span>
          <span className="block text-[11px] text-gray-400 truncate">{summary(b) || '—'}</span>
        </span>
      </button>
      {b.hideOnMobile && <span title="Hidden on mobile" className="text-amber-500"><EyeOff size={12} /></span>}
      <button type="button" onClick={onDuplicate} title="Duplicate" className="grid place-items-center w-7 h-7 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700"><Copy size={12} /></button>
      <button type="button" onClick={onRemove} title="Delete" className="grid place-items-center w-7 h-7 mr-1 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
    </div>
  );
}

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return <div ref={setNodeRef} className={`space-y-1.5 min-h-[120px] rounded-xl p-1 transition ${isOver ? 'bg-primary-50 ring-2 ring-primary-300 ring-dashed' : ''}`}>{children}</div>;
}

/**
 * Block-based email builder. Controlled: `value` is the design, `onChange`
 * receives every edit. The preview is the exact HTML that will be sent, with
 * sample values in place of {{tags}}.
 */
export default function EmailBuilder({ value, onChange, theme, assetBase, tags, subject }: {
  value: EmailDesign; onChange: (d: EmailDesign) => void; theme: EmailTheme; assetBase: string;
  tags: BuilderTag[]; subject?: string;
}) {
  const design = normalizeDesign(value);
  const [selected, setSelected] = useState<string | null>(design.blocks[0]?.id || null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [dragType, setDragType] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);

  // Undo / redo history of designs.
  const history = useRef<{ past: EmailDesign[]; future: EmailDesign[] }>({ past: [], future: [] });
  const commit = useCallback((next: EmailDesign) => {
    history.current.past = [...history.current.past.slice(-49), design];
    history.current.future = [];
    onChange(next);
  }, [design, onChange]);
  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.unshift(design);
    onChange(prev);
  };
  const redo = () => {
    const next = history.current.future.shift();
    if (!next) return;
    history.current.past.push(design);
    onChange(next);
  };

  const setBlocks = (blocks: EmailBlock[]) => commit({ ...design, blocks });
  const current = design.blocks.find(b => b.id === selected);
  const addBlock = (type: string, at?: number) => {
    const b = newEmailBlock(type);
    const idx = at ?? (selected ? design.blocks.findIndex(x => x.id === selected) + 1 : design.blocks.length);
    const blocks = [...design.blocks];
    blocks.splice(Math.max(0, idx), 0, b);
    setBlocks(blocks);
    setSelected(b.id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragType(id.startsWith('palette:') ? id.slice(8) : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragType(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (id.startsWith('palette:')) {
      if (!over) return;
      const at = over === 'canvas' ? design.blocks.length : design.blocks.findIndex(b => b.id === over);
      addBlock(id.slice(8), at < 0 ? design.blocks.length : at);
      return;
    }
    if (!over || over === id || over === 'canvas') return;
    const from = design.blocks.findIndex(b => b.id === id), to = design.blocks.findIndex(b => b.id === over);
    if (from >= 0 && to >= 0) setBlocks(arrayMove(design.blocks, from, to));
  };

  // Preview
  const html = useMemo(() => renderEmail(design, theme, { assetBase, subject, annotate: true }), [design, theme, assetBase, subject]);
  const [srcDoc, setSrcDoc] = useState('');
  useEffect(() => { const t = setTimeout(() => setSrcDoc(withSamples(html, tags)), srcDoc ? 150 : 0); return () => clearTimeout(t); }, [html, tags]); // eslint-disable-line react-hooks/exhaustive-deps
  // Click-to-select inside the preview, and an outline on the selected block.
  const decorate = useCallback((doc: Document) => {
    let style = doc.getElementById('ak-builder-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'ak-builder-style';
      style.textContent = '[data-ak-block]{cursor:pointer;outline-offset:2px}[data-ak-block]:hover{outline:2px dashed rgba(198,161,91,.8)}[data-ak-block].ak-sel{outline:2px solid #C6A15B}';
      doc.head.appendChild(style);
      doc.addEventListener('click', e => {
        e.preventDefault();
        const el = (e.target as HTMLElement).closest('[data-ak-block]') as HTMLElement | null;
        if (el?.dataset.akBlock) setSelected(el.dataset.akBlock);
      }, true);
    }
    doc.querySelectorAll('.ak-sel').forEach(el => el.classList.remove('ak-sel'));
    if (selected) doc.querySelector(`[data-ak-block="${CSS.escape(selected)}"]`)?.classList.add('ak-sel');
  }, [selected]);


  async function sendTest() {
    if (!/^\S+@\S+\.\S+$/.test(testTo)) { toast.error('Enter a valid email address'); return; }
    setSending(true);
    try {
      const real = renderEmail(design, theme, { assetBase, subject });
      await api.post('/emails/send', { to: testTo, subject: `[Test] ${withSamples(subject || 'Email preview', tags)}`, html: withSamples(real, tags) });
      toast.success(`Test sent to ${testTo}`);
      setTestOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not send the test');
    } finally {
      setSending(false);
    }
  }

  const docFields = [
    { key: 'preheader', type: 'text' as const, label: 'Preview text', hint: 'Shown after the subject in most inboxes. Keep it under ~90 characters.' },
    { key: 'showHeader', type: 'toggle' as const, label: 'Show branded header' },
    { key: 'showFooter', type: 'toggle' as const, label: 'Show footer (address & links)', hint: 'Recommended — a physical address helps your mail avoid spam folders' },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SiteLinksDatalist />
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[210px_340px_minmax(0,1fr)] items-start">
        {/* Palette + document */}
        <div className="space-y-4 lg:col-start-1 2xl:row-start-1 2xl:sticky 2xl:top-4">
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-2 px-1">Blocks — drag or click</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-2 gap-2">
              {EMAIL_BLOCKS.map(b => (
                <div key={b.type} onClick={() => addBlock(b.type)}><PaletteItem type={b.type} /></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3 px-1">Email settings</p>
            <FieldList fields={docFields} value={design.settings} onChange={v => commit({ ...design, settings: v })} />
          </div>
        </div>

        {/* Structure + selected block */}
        <div className="space-y-4 lg:col-start-1 2xl:col-start-2 2xl:row-start-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Structure ({design.blocks.length})</p>
              <div className="flex gap-1">
                <button type="button" onClick={undo} disabled={!history.current.past.length} title="Undo" className="grid place-items-center w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Undo2 size={13} /></button>
                <button type="button" onClick={redo} disabled={!history.current.future.length} title="Redo" className="grid place-items-center w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30"><Redo2 size={13} /></button>
              </div>
            </div>
            <SortableContext items={design.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <DropZone>
                {design.blocks.map(b => (
                  <StructureRow key={b.id} b={b} active={selected === b.id} onSelect={() => setSelected(b.id)}
                    onDuplicate={() => {
                      const i = design.blocks.findIndex(x => x.id === b.id);
                      const copy = { ...JSON.parse(JSON.stringify(b)), id: newEmailBlock(b.type).id };
                      const blocks = [...design.blocks]; blocks.splice(i + 1, 0, copy); setBlocks(blocks); setSelected(copy.id);
                    }}
                    onRemove={() => {
                      const i = design.blocks.findIndex(x => x.id === b.id);
                      setBlocks(design.blocks.filter(x => x.id !== b.id));
                      setSelected(design.blocks[i + 1]?.id || design.blocks[i - 1]?.id || null);
                    }} />
                ))}
                {!design.blocks.length && <p className="text-center text-xs text-gray-400 py-8">Drag blocks here</p>}
              </DropZone>
            </SortableContext>
          </div>

          {current ? (
            <div className="bg-white rounded-2xl border border-primary-200 shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary-50 text-primary-500"><Icon name={EMAIL_BLOCK_BY_TYPE[current.type]?.icon} size={15} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{EMAIL_BLOCK_BY_TYPE[current.type]?.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{EMAIL_BLOCK_BY_TYPE[current.type]?.description}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="grid place-items-center w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100"><X size={14} /></button>
              </div>
              <div className="p-4 space-y-5">
                <FieldList fields={EMAIL_BLOCK_BY_TYPE[current.type]?.fields || []} value={current}
                  onChange={v => setBlocks(design.blocks.map(b => (b.id === current.id ? v : b)))} />
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <FieldList fields={BLOCK_STYLE_FIELDS} value={current} onChange={v => setBlocks(design.blocks.map(b => (b.id === current.id ? v : b)))} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Select a block — in the list or the preview — to edit it.</p>
          )}

          {tags.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-1 px-1">Merge tags</p>
              <p className="text-[11px] text-gray-400 mb-2 px-1">Click a field, then a tag to insert it there.</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <button key={t.key} type="button" title={t.label} onMouseDown={e => { e.preventDefault(); insertAtCursor(`{{${t.key}}}`); }}
                    className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary-50 text-primary-600 border border-primary-100 hover:bg-primary-100">
                    {`{{${t.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 2xl:col-start-3 2xl:row-span-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex p-0.5 rounded-lg bg-gray-100">
              {([['desktop', Laptop], ['mobile', Smartphone]] as const).map(([d, I]) => (
                <button key={d} type="button" onClick={() => setDevice(d)}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold transition ${device === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  <I size={13} /> {d === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setTestOpen(o => !o)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <Send size={13} /> Send test
              </button>
              {testOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-3 space-y-2">
                  <p className="text-[11px] text-gray-500">Sends this design with sample data, through your real SMTP settings.</p>
                  <input autoFocus value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@company.com" type="email"
                    onKeyDown={e => e.key === 'Enter' && sendTest()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                  <button type="button" onClick={sendTest} disabled={sending}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary-400 hover:bg-primary-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60">
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-[#E9ECEE] p-3 overflow-y-auto lg:max-h-[calc(100vh-140px)]">
            <ScaledEmailFrame key={device} srcDoc={srcDoc} width={device === 'mobile' ? 390 : theme.contentWidth + 80}
              rounded={device === 'mobile'} onDocument={decorate} refreshKey={selected} />
          </div>
          <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><Plus size={11} className="rotate-45" /> Preview uses sample values for merge tags.</p>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragType && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-primary-300 shadow-xl text-xs font-semibold text-gray-800">
            <Icon name={EMAIL_BLOCK_BY_TYPE[dragType]?.icon} size={14} /> {EMAIL_BLOCK_BY_TYPE[dragType]?.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
