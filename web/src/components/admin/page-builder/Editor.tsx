'use client';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, ChevronDown, CloudOff, ExternalLink, Eye, EyeOff, History, Layers, Loader2, Maximize2, Plus, Redo2,
  Settings2, Shapes, Undo2, UploadCloud,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fontsHref, normalizeHomepage, themeVars } from '@/lib/homepage/config';
import {
  duplicateNode, findNode, insertNode, levelOf, moveNode, newColumn, newNode, newSection, normalizeDoc, normalizeNode,
  removeNode, updateNode, withNewIds,
} from '@/lib/pageBuilder/doc';
import { ELEMENT_BY_TYPE } from '@/lib/pageBuilder/elements';
import { sectionFor } from '@/lib/pageBuilder/templates';
import { DEVICE_WIDTH, slugError, type Device, type PBNode, type PageDoc } from '@/lib/pageBuilder/types';
import type { InlineEdit } from '@/components/pageBuilder/ui';
import { SiteLinksDatalist } from '@/components/admin/site-builder/fields';
import Canvas, { type CanvasAction } from './Canvas';
import Inspector from './Inspector';
import PageSettings, { type PageMeta } from './PageSettings';
import { BlocksPanel, ElementsPanel, LayersPanel, type SavedBlock } from './Panels';
import { ConflictModal, RevisionsModal, SaveBlockModal } from './Modals';
import { DEVICE_ICON } from './controls';
import type { DragPayload, DropTarget } from './dnd';

/* ─── Undo history ──────────────────────────────────────────────────────── */

interface Hist { past: PageDoc[]; present: PageDoc; future: PageDoc[]; key?: string; at: number }
type HistAction =
  | { type: 'init'; doc: PageDoc }
  | { type: 'commit'; doc: PageDoc; key?: string }
  | { type: 'undo' } | { type: 'redo' };

const MAX_HISTORY = 150;

function histReducer(h: Hist | null, a: HistAction): Hist | null {
  if (a.type === 'init') return { past: [], present: a.doc, future: [], at: 0 };
  if (!h) return h;
  switch (a.type) {
    case 'commit': {
      if (a.doc === h.present) return h;
      const now = Date.now();
      // Typing in one field (same key, quick succession) is one undo step.
      if (a.key && a.key === h.key && now - h.at < 1200) return { ...h, present: a.doc, future: [], at: now };
      return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: a.doc, future: [], key: a.key, at: now };
    }
    case 'undo': {
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], at: 0 };
    }
    case 'redo': {
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), at: 0 };
    }
  }
}

/* ─── Clipboard (shared across pages and tabs) ──────────────────────────── */

const CLIP_KEY = 'pb-clipboard';
function readClip(): { level: 'section' | 'column' | 'element'; node: PBNode } | null {
  try { const v = JSON.parse(localStorage.getItem(CLIP_KEY) || 'null'); return v?.node && v?.level ? v : null; } catch { return null; }
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict' | 'readonly';
type LeftTab = 'elements' | 'blocks' | 'layers';

export default function PageEditor({ id }: { id: string }) {
  const qc = useQueryClient();
  const canEdit = useAuth(s => s.can('pages', 'edit'));
  const canPublish = useAuth(s => s.can('pages', 'publish'));

  const pageQ = useQuery({
    queryKey: ['pb-page', id],
    queryFn: () => api.get(`/pages/${id}`).then(r => r.data),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const siteQ = useQuery({ queryKey: ['pb-site-content'], queryFn: () => api.get('/site-config').then(r => r.data), staleTime: 60_000 });
  const blocksQ = useQuery({ queryKey: ['pb-blocks'], queryFn: () => api.get('/pages/blocks').then(r => r.data as SavedBlock[]), staleTime: 60_000 });

  const [hist, dispatch] = useReducer(histReducer, null);
  const [meta, setMeta] = useState<PageMeta>({ title: '', slug: '', status: 'draft' });
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [zoom, setZoom] = useState<'fit' | 100>('fit');
  const [left, setLeft] = useState<LeftTab>('elements');
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [conflict, setConflict] = useState<{ by?: string | null } | null>(null);
  const [modal, setModal] = useState<null | 'revisions' | 'saveBlock'>(null);
  const [blockSource, setBlockSource] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [publishMenu, setPublishMenu] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const savedJson = useRef('');
  const savedMeta = useRef({ title: '', slug: '' });
  const baseUpdatedAt = useRef<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Load once per page (later refetches only happen on purpose, e.g. after a conflict).
  useEffect(() => {
    const p = pageQ.data;
    if (!p || loadedFor.current === `${id}:${p.updatedAt}`) return;
    if (loadedFor.current?.startsWith(`${id}:`) && saveState !== 'conflict') return;
    loadedFor.current = `${id}:${p.updatedAt}`;
    const doc = normalizeDoc(p.draft);
    dispatch({ type: 'init', doc });
    savedJson.current = JSON.stringify(doc);
    savedMeta.current = { title: p.title, slug: p.slug };
    baseUpdatedAt.current = p.updatedAt;
    setMeta({ title: p.title, slug: p.slug, status: p.status });
    setHasChanges(!!p.hasUnpublishedChanges);
    setSaveState(canEdit ? 'saved' : 'readonly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageQ.data, id]);

  useEffect(() => {
    setCanPaste(!!readClip());
    const on = (e: StorageEvent) => { if (e.key === CLIP_KEY) setCanPaste(!!readClip()); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const doc = hist?.present;
  const docRef = useRef(doc);
  docRef.current = doc;
  const commit = useCallback((next: PageDoc, key?: string) => {
    if (!canEdit) { toast.error('You can view this page but not edit it'); return; }
    dispatch({ type: 'commit', doc: next, key });
  }, [canEdit]);
  const setSections = useCallback((sections: PBNode[], key?: string) => { if (doc) commit({ ...doc, sections }, key); }, [doc, commit]);

  /* ─── Saving ─────────────────────────────────────────────────────────── */

  const save = useCallback(async (opts: { force?: boolean; revision?: string } = {}) => {
    if (!doc || !canEdit) return false;
    const json = JSON.stringify(doc);
    const metaPatch: Record<string, string> = {};
    if (meta.title.trim() && meta.title !== savedMeta.current.title) metaPatch.title = meta.title;
    if (meta.slug !== savedMeta.current.slug && !slugError(meta.slug)) metaPatch.slug = meta.slug;
    if (json === savedJson.current && !Object.keys(metaPatch).length && !opts.revision) { setSaveState('saved'); return true; }
    setSaveState('saving');
    try {
      const { data } = await api.patch(`/pages/${id}`, { draft: doc, baseUpdatedAt: baseUpdatedAt.current, force: opts.force, revision: opts.revision, ...metaPatch });
      savedJson.current = json;
      savedMeta.current = { title: data.title, slug: data.slug };
      baseUpdatedAt.current = data.updatedAt;
      setHasChanges(!!data.hasUnpublishedChanges);
      setSaveState(JSON.stringify(docRef.current) === json ? 'saved' : 'dirty');
      qc.invalidateQueries({ queryKey: ['pb-pages'] });
      return true;
    } catch (e: any) {
      if (e?.response?.status === 409 && e.response.data?.conflict) {
        setSaveState('conflict');
        setConflict({ by: e.response.data.by });
      } else {
        setSaveState('error');
        toast.error(e?.response?.data?.error || 'Could not save the page');
      }
      return false;
    }
  }, [doc, canEdit, meta, id, qc]);

  // Autosave a moment after the last change.
  useEffect(() => {
    if (!doc || !canEdit || saveState === 'conflict' || saveState === 'saving') return;
    const dirty = JSON.stringify(doc) !== savedJson.current
      || (meta.title.trim() && meta.title !== savedMeta.current.title)
      || (meta.slug !== savedMeta.current.slug && !slugError(meta.slug));
    if (!dirty) { if (saveState === 'dirty') setSaveState('saved'); return; }
    if (saveState !== 'error') setSaveState('dirty');
    const t = setTimeout(() => { save(); }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, meta.title, meta.slug]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error' || saveState === 'conflict') { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const publish = async () => {
    if (!doc) return;
    setPublishing(true);
    setPublishMenu(false);
    try {
      if (slugError(meta.slug)) { toast.error(slugError(meta.slug)!); return; }
      const ok = await save();
      if (!ok) return;
      const { data } = await api.post(`/pages/${id}/publish`, { draft: doc });
      baseUpdatedAt.current = data.updatedAt;
      savedJson.current = JSON.stringify(doc);
      setMeta(m => ({ ...m, status: 'published' }));
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ['pb-pages'] });
      toast.success(<span>Published — <a className="underline font-semibold" href={`/${data.slug}`} target="_blank" rel="noreferrer">view live</a></span>);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };
  const unpublish = async () => {
    setPublishMenu(false);
    if (!window.confirm('Take this page offline? Visitors will get a “not found” page until you publish again.')) return;
    try {
      const { data } = await api.post(`/pages/${id}/unpublish`);
      baseUpdatedAt.current = data.updatedAt;
      setMeta(m => ({ ...m, status: 'draft' }));
      qc.invalidateQueries({ queryKey: ['pb-pages'] });
      toast.success('Page unpublished');
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Could not unpublish'); }
  };

  const reloadLatest = async () => {
    setConflict(null);
    setSaveState('saved');
    loadedFor.current = null;
    await qc.invalidateQueries({ queryKey: ['pb-page', id] });
    await pageQ.refetch();
  };

  /* ─── Tree operations ────────────────────────────────────────────────── */

  const select = (nid: string | null) => { setSelectedId(nid); if (inline && inline.id !== nid) setInline(null); };
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const insertAndSelect = (sections: PBNode[], nid: string) => { setSections(sections); setSelectedId(nid); setScrollTo(nid); };

  /** Where a new element goes: after the selected element, into the selected column, or a new section. */
  const placeElement = (sections: PBNode[], el: PBNode): PBNode[] => {
    const at = selectedId ? findNode(sections, selectedId) : null;
    if (at) {
      const lv = levelOf(at.node);
      if (lv === 'element' && at.parent) return insertNode(sections, at.parent.id, at.index + 1, el);
      if (lv === 'column') return insertNode(sections, at.node.id, (at.node.children || []).length, el);
      if (lv === 'section' && at.node.children?.[0]) { const c = at.node.children[0]; return insertNode(sections, c.id, (c.children || []).length, el); }
    }
    return [...sections, sectionFor(el)];
  };
  const sectionIndexForInsert = (sections: PBNode[]) => {
    const at = selectedId ? findNode(sections, selectedId) : null;
    if (!at) return sections.length;
    const top = at.path[0] || at.node;
    return sections.findIndex(s => s.id === top.id) + 1;
  };

  const addElement = (type: string) => {
    if (!doc) return;
    const el = newNode(type);
    insertAndSelect(placeElement(doc.sections, el), el.id);
  };
  const insertBlock = (build: () => PBNode, label: string) => {
    if (!doc) return;
    const s = normalizeNode(withNewIds(build()), 'section');
    if (!s) return;
    insertAndSelect(insertNode(doc.sections, null, sectionIndexForInsert(doc.sections), s), s.id);
    toast.success(`Added “${label}”`);
  };
  const addSection = (index: number, widths: number[]) => {
    if (!doc) return;
    const s = newSection(widths);
    insertAndSelect(insertNode(doc.sections, null, index, s), s.id);
  };

  const onDrop = (p: DragPayload, t: DropTarget) => {
    if (!doc) return;
    if (p.kind === 'new') {
      const el = newNode(p.type);
      const next = t.asSection ? insertNode(doc.sections, null, t.index, sectionFor(el)) : insertNode(doc.sections, t.parentId, t.index, el);
      insertAndSelect(next, el.id);
    } else if (p.kind === 'block') {
      const s = normalizeNode(withNewIds(p.build()), 'section');
      if (s) insertAndSelect(insertNode(doc.sections, null, t.index, s), s.id);
    } else {
      const at = findNode(doc.sections, p.id);
      if (!at || at.node.adv?.locked) return;
      if (t.asSection && p.level === 'element') {
        const removed = removeNode(doc.sections, p.id);
        // Index was computed with the element still in place; sections didn't change.
        insertAndSelect(insertNode(removed, null, t.index, sectionFor(at.node)), p.id);
      } else {
        if (p.level === 'column' && at.parent && (at.parent.children || []).length === 1 && at.parent.id !== t.parentId) {
          toast.error('A section needs at least one column'); return;
        }
        setSections(moveNode(doc.sections, p.id, t.parentId, t.index));
        setSelectedId(p.id);
      }
    }
  };

  const onLayerMove = (p: DragPayload, parentId: string | null, index: number) => {
    if (!doc) return;
    onDrop(p, { parentId, index, line: { x: 0, y: 0, w: 0, h: 0 } });
  };

  const updateSelected = (next: PBNode, key?: string) => setSections(updateNode(doc!.sections, next.id, () => next), key);

  const copy = (nid: string) => {
    const at = doc && findNode(doc.sections, nid);
    if (!at) return;
    try { localStorage.setItem(CLIP_KEY, JSON.stringify({ level: levelOf(at.node), node: at.node })); } catch { /* ignore */ }
    setCanPaste(true);
    toast.success(`Copied ${ELEMENT_BY_TYPE[at.node.type]?.label || at.node.type}`, { duration: 1500 });
  };
  const paste = (nid: string | null) => {
    const clip = readClip();
    if (!doc || !clip) return;
    const node = normalizeNode(withNewIds(clip.node), clip.level);
    if (!node) return;
    const at = nid ? findNode(doc.sections, nid) : null;
    const lv = at ? levelOf(at.node) : null;
    let next: PBNode[] | null = null;
    if (clip.level === 'element') next = placeElement(doc.sections, node);
    else if (clip.level === 'section') next = insertNode(doc.sections, null, sectionIndexForInsert(doc.sections), node);
    else if (clip.level === 'column' && at) {
      if (lv === 'column' && at.parent) next = insertNode(doc.sections, at.parent.id, at.index + 1, node);
      else if (lv === 'element') { const col = at.path[at.path.length - 1]; const sec = at.path[0]; next = insertNode(doc.sections, sec.id, (sec.children || []).findIndex(c => c.id === col.id) + 1, node); }
      else if (lv === 'section') next = insertNode(doc.sections, at.node.id, (at.node.children || []).length, node);
    }
    if (!next) { toast.error('Select a section or column to paste a column into'); return; }
    insertAndSelect(next, node.id);
  };

  const onAction = (action: CanvasAction, nid: string) => {
    if (!doc) return;
    const at = findNode(doc.sections, nid);
    if (!at) return;
    const lv = levelOf(at.node);
    const locked = !!at.node.adv?.locked;
    switch (action) {
      case 'parent': select(at.parent?.id ?? null); break;
      case 'up': case 'down': {
        if (locked) return;
        const siblings = at.parent ? at.parent.children || [] : doc.sections;
        const to = at.index + (action === 'up' ? -1 : 1);
        if (to < 0 || to >= siblings.length) return;
        setSections(moveNode(doc.sections, nid, at.parent?.id ?? null, action === 'up' ? to : to + 1));
        break;
      }
      case 'duplicate': { const r = duplicateNode(doc.sections, nid); if (r.newId) insertAndSelect(r.sections, r.newId); break; }
      case 'copy': copy(nid); break;
      case 'paste': paste(nid); break;
      case 'delete': {
        if (locked) { toast.error('Unlock it first (Advanced → Lock position)'); return; }
        if (lv === 'column' && at.parent && (at.parent.children || []).length === 1) { toast.error('A section needs at least one column — delete the section instead'); return; }
        setSections(removeNode(doc.sections, nid));
        select(at.parent?.id ?? null);
        break;
      }
      case 'addColumn': {
        if (!at.parent) return;
        const count = (at.parent.children || []).length + 1;
        const w = Math.round((100 / count) * 1000) / 1000;
        const col = newColumn(w);
        const withCol = insertNode(doc.sections, at.parent.id, at.index + 1, col);
        insertAndSelect(updateNode(withCol, at.parent.id, s => ({ ...s, children: (s.children || []).map(c => ({ ...c, style: { ...c.style, desktop: { ...(c.style?.desktop || {}), width: `${w}%` } } })) })), col.id);
        break;
      }
      case 'saveBlock': setBlockSource(nid); setModal('saveBlock'); break;
      case 'editText': setInline({ id: nid, key: at.node.type === 'text' ? 'html' : 'text' }); break;
    }
  };

  const onResizeColumns = (a: string, b: string, wa: number, wb: number) => {
    if (!doc) return;
    let s = updateNode(doc.sections, a, n => ({ ...n, style: { ...n.style, [device]: { ...(n.style?.[device] || {}), width: `${wa}%` } } }));
    s = updateNode(s, b, n => ({ ...n, style: { ...n.style, [device]: { ...(n.style?.[device] || {}), width: `${wb}%` } } }));
    setSections(s, `resize:${a}:${device}`);
  };

  // Stable identity so the memoised canvas renderer doesn't re-render on every editor update.
  const onInlineCommit = useCallback((nid: string, key: string, value: string) => {
    setInline(null);
    const cur = docRef.current;
    if (!cur) return;
    const at = findNode(cur.sections, nid);
    if (!at || at.node.props[key] === value) return;
    commit({ ...cur, sections: updateNode(cur.sections, nid, n => ({ ...n, props: { ...n.props, [key]: value } })) });
  }, [commit]);

  /* ─── Keyboard ───────────────────────────────────────────────────────── */

  const keyRef = useRef<(e: KeyboardEvent) => void>();
  keyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save({ revision: 'Manual save' }).then(ok => ok && toast.success('Saved', { duration: 1200 })); return; }
    if (typing || document.querySelector('[data-pb-modal]')) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); dispatch({ type: 'redo' }); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(selectedId); return; }
    if (!selectedId) return;
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copy(selectedId); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); onAction('duplicate', selectedId); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onAction('delete', selectedId); return; }
    if (e.key === 'Escape') { e.preventDefault(); onAction('parent', selectedId); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onAction(e.key === 'ArrowUp' ? 'up' : 'down', selectedId); return; }
    if (e.key === 'Enter') {
      const at = doc && findNode(doc.sections, selectedId);
      if (at && (at.node.type === 'heading' || at.node.type === 'text')) { e.preventDefault(); onAction('editText', selectedId); }
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current?.(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // Bring newly inserted nodes into view.
  useEffect(() => {
    if (!scrollTo) return;
    const t = setTimeout(() => {
      document.querySelector(`.pb-editing [data-pb-id="${CSS.escape(scrollTo)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScrollTo(null);
    }, 60);
    return () => clearTimeout(t);
  }, [scrollTo]);

  /* ─── Render ─────────────────────────────────────────────────────────── */

  const theme = useMemo(() => normalizeHomepage(siteQ.data?.homepage).theme, [siteQ.data]);
  const themeStyle = useMemo(() => themeVars(theme) as React.CSSProperties, [theme]);
  const selected = doc && selectedId ? findNode(doc.sections, selectedId) : null;
  useEffect(() => { if (selectedId && doc && !findNode(doc.sections, selectedId)) setSelectedId(null); }, [doc, selectedId]);

  if (pageQ.isError) {
    return <div className="fixed inset-0 z-[100] grid place-items-center bg-white text-sm text-gray-500">This page could not be loaded. <Link className="underline ml-1" href="/admin/pages">Back to pages</Link></div>;
  }
  if (!doc) return <div className="fixed inset-0 z-[100] grid place-items-center bg-white"><Loader2 className="animate-spin text-teal-700" /></div>;

  const status = meta.status === 'published' ? (hasChanges || saveState === 'dirty' ? 'changes' : 'live') : 'draft';
  const saveLabel = {
    saved: <><Check size={13} className="text-emerald-600" /> Saved</>,
    dirty: <><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved</>,
    saving: <><Loader2 size={13} className="animate-spin" /> Saving…</>,
    error: <><CloudOff size={13} className="text-red-600" /> Not saved — <button type="button" className="underline" onClick={() => save()}>retry</button></>,
    conflict: <><CloudOff size={13} className="text-red-600" /> Paused</>,
    readonly: <><Eye size={13} /> View only</>,
  }[saveState];

  const openPreview = () => {
    try { localStorage.setItem(`pb-preview-${id}`, JSON.stringify(doc)); } catch { /* ignore */ }
    window.open(`/page-preview/${id}?local=1`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white text-gray-900">
      <SiteLinksDatalist />
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center gap-2 px-3 border-b border-gray-200 bg-white">
        <Link href="/admin/pages" className="grid place-items-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Back to pages"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex items-center gap-2">
          <input value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} disabled={!canEdit}
            className="w-[220px] max-w-[26vw] h-9 px-2 rounded-lg text-[14px] font-bold text-gray-900 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-600/20 outline-none truncate" />
          <span className={`hidden md:inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold ${status === 'live' ? 'bg-emerald-50 text-emerald-700' : status === 'changes' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-emerald-500' : status === 'changes' ? 'bg-amber-500' : 'bg-gray-400'}`} />
            {status === 'live' ? 'Live' : status === 'changes' ? 'Live · unpublished changes' : 'Draft'}
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center gap-2">
          <div className="flex p-0.5 rounded-lg bg-gray-100">
            {(['desktop', 'tablet', 'mobile'] as Device[]).map(d => {
              const I = DEVICE_ICON[d];
              return (
                <button key={d} type="button" onClick={() => setDevice(d)} title={`${d[0].toUpperCase()}${d.slice(1)} (${DEVICE_WIDTH[d]}px)`}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold transition ${device === d ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-800'}`}>
                  <I size={15} /><span className="hidden xl:inline capitalize">{d}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setZoom(z => (z === 'fit' ? 100 : 'fit'))} title={zoom === 'fit' ? 'Showing scaled to fit — click for 100%' : 'Showing at 100% — click to fit'}
            className="hidden lg:flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-[11.5px] font-semibold text-gray-600 hover:bg-gray-50">
            <Maximize2 size={13} />{zoom === 'fit' ? 'Fit' : '100%'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!hist?.past.length} title="Undo (⌘Z)" className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Undo2 size={17} /></button>
          <button type="button" onClick={() => dispatch({ type: 'redo' })} disabled={!hist?.future.length} title="Redo (⇧⌘Z)" className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Redo2 size={17} /></button>
          <span className="w-px h-6 bg-gray-200 mx-1" />
          <button type="button" onClick={() => setModal('revisions')} title="Version history" className="grid place-items-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100"><History size={17} /></button>
          <button type="button" onClick={() => select(null)} title="Page settings & SEO" className={`grid place-items-center w-9 h-9 rounded-lg hover:bg-gray-100 ${!selectedId ? 'text-teal-700 bg-teal-50' : 'text-gray-600'}`}><Settings2 size={17} /></button>
          <button type="button" onClick={openPreview} title="Preview in a new tab" className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] font-semibold text-gray-700 hover:bg-gray-100"><Eye size={16} /> Preview</button>
          <span className="hidden md:flex items-center gap-1.5 text-[11.5px] text-gray-500 font-medium px-2 min-w-[92px]">{saveLabel}</span>
          {canPublish && (
            <div className="relative flex">
              <button type="button" onClick={publish} disabled={publishing || saveState === 'conflict'}
                className="flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-l-lg bg-teal-700 text-white text-[13px] font-semibold hover:bg-teal-800 disabled:opacity-60">
                {publishing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {meta.status === 'published' ? 'Update' : 'Publish'}
              </button>
              <button type="button" onClick={() => setPublishMenu(o => !o)} className="grid place-items-center w-8 h-9 rounded-r-lg bg-teal-700 text-white border-l border-white/20 hover:bg-teal-800"><ChevronDown size={14} /></button>
              {publishMenu && (
                <div className="absolute right-0 top-11 w-56 rounded-xl bg-white shadow-2xl border border-gray-200 py-1.5 z-50 text-[12.5px]" onMouseLeave={() => setPublishMenu(false)}>
                  {meta.status === 'published' && <a href={`/${meta.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><ExternalLink size={14} /> View live page</a>}
                  <button type="button" onClick={() => { setPublishMenu(false); save({ revision: 'Manual save' }).then(ok => ok && toast.success('Version saved')); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"><History size={14} /> Save a version now</button>
                  {meta.status === 'published' && <button type="button" onClick={unpublish} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-red-600"><EyeOff size={14} /> Unpublish</button>}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {!canEdit && <div className="shrink-0 px-4 py-1.5 bg-amber-50 text-amber-800 text-[12px] font-medium border-b border-amber-100">You have view-only access to pages. Ask a super admin for “Page Builder → edit” to make changes.</div>}

      <div className="flex-1 min-h-0 flex">
        {/* Left panel */}
        <aside className="w-[272px] shrink-0 border-r border-gray-200 flex flex-col min-h-0 bg-white">
          <div className="flex p-1.5 gap-1 border-b border-gray-100">
            {([['elements', 'Elements', <Plus key="p" size={14} />], ['blocks', 'Blocks', <Shapes key="s" size={14} />], ['layers', 'Layers', <Layers key="l" size={14} />]] as [LeftTab, string, React.ReactNode][]).map(([t, l, ic]) => (
              <button key={t} type="button" onClick={() => setLeft(t)} className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-semibold transition ${left === t ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{ic}{l}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {left === 'elements' && <ElementsPanel onAdd={addElement} />}
            {left === 'blocks' && <BlocksPanel saved={blocksQ.data || []} onInsert={insertBlock} onDeleteSaved={async bid => {
              if (!window.confirm('Delete this saved block? Pages already using it keep their copy.')) return;
              await api.delete(`/pages/blocks/${bid}`); blocksQ.refetch();
            }} />}
            {left === 'layers' && <LayersPanel sections={doc.sections} selectedId={selectedId} hoveredId={hoveredId} onSelect={select} onHover={setHoveredId}
              onToggle={(nid, key) => setSections(updateNode(doc.sections, nid, n => ({ ...n, adv: { ...(n.adv || {}), [key]: !n.adv?.[key] } })))}
              onMove={onLayerMove} />}
          </div>
        </aside>

        <Canvas doc={doc} device={device} themeStyle={themeStyle} fontsHref={fontsHref(theme)} selectedId={selectedId} hoveredId={hoveredId}
          onSelect={select} onHover={setHoveredId} onDrop={onDrop} onAction={onAction} onAddSection={addSection}
          onResizeColumns={onResizeColumns} inline={inline} onInline={setInline} onInlineCommit={onInlineCommit} zoom={zoom} canPaste={canPaste} />

        {/* Right panel */}
        <aside className="w-[320px] shrink-0 border-l border-gray-200 min-h-0 bg-white">
          {selected
            ? <Inspector key={selected.node.id} node={selected.node} device={device} setDevice={setDevice} onChange={updateSelected} />
            : <PageSettings doc={doc} meta={meta} onDoc={commit} onMeta={patch => setMeta(m => ({ ...m, ...patch }))} onImport={next => commit(next)} />}
        </aside>
      </div>

      {modal === 'revisions' && (
        <RevisionsModal pageId={id} onClose={() => setModal(null)}
          onSnapshot={async label => { const ok = await save({ revision: label }); if (ok) toast.success('Version saved'); }}
          onRestore={async rev => {
            const { data } = await api.post(`/pages/${id}/revisions/${rev}/restore`);
            const restored = normalizeDoc(data.draft);
            savedJson.current = JSON.stringify(restored);
            baseUpdatedAt.current = data.updatedAt;
            setHasChanges(!!data.hasUnpublishedChanges);
            dispatch({ type: 'commit', doc: restored });
            setSelectedId(null);
            toast.success('Version restored — press ⌘Z to undo');
          }} />
      )}
      {modal === 'saveBlock' && blockSource && (
        <SaveBlockModal onClose={() => setModal(null)} onSave={async (name, category) => {
          const at = findNode(doc.sections, blockSource);
          if (!at) return;
          await api.post('/pages/blocks', { name, category, section: at.node });
          await blocksQ.refetch();
          toast.success('Block saved — find it under Blocks');
        }} />
      )}
      {conflict && <ConflictModal by={conflict.by} onClose={() => setConflict(null)} onReload={reloadLatest}
        onOverwrite={async () => { setConflict(null); setSaveState('dirty'); const ok = await save({ force: true }); if (ok) toast.success('Saved your version'); }} />}
    </div>
  );
}
