'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Check, ChevronLeft, Copy, Download, ExternalLink, Eye, EyeOff, FileUp, GripVertical, Laptop, Layout,
  Loader2, MoreHorizontal, Palette, PanelBottom, PanelTop, Plus, RotateCcw, Save, Search, Smartphone, Tablet, Trash2, X,
} from 'lucide-react';
import api from '@/lib/api';
import {
  DEFAULT_SEO, DEFAULT_THEME, FONT_FAMILIES, THEME_PRESETS, newSection,
  normalizeFooter, normalizeHomepage, normalizeNavbar, type HomeSection, type HomepageConfig,
} from '@/lib/homepage/config';
import { SECTION_BY_TYPE, SECTION_DEFS, STYLE_FIELDS, type Field } from '@/lib/homepage/schema';
import { Icon } from '@/components/homepage/icons';
import { ColorInput, FieldInput, FieldList, SiteLinksDatalist } from './fields';
import { FOOTER_FIELDS, NAVBAR_FIELDS, SEO_FIELDS } from './layoutFields';
import Preview, { type Device } from './Preview';

type Draft = { homepage: HomepageConfig; navbar: any; footer: any };
type Panel = { kind: 'theme' } | { kind: 'seo' } | { kind: 'navbar' } | { kind: 'footer' } | { kind: 'section'; id: string };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const errMsg = (e: any, fb: string) => e?.response?.data?.error || fb;

/* ─── Sections list ─────────────────────────────────────────────────────── */

function SectionRow({ s, active, onSelect, onToggle }: { s: HomeSection; active: boolean; onSelect: () => void; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const def = SECTION_BY_TYPE[s.type];
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition, zIndex: isDragging ? 10 : undefined,
  };
  const lead = s.type === 'hero' && s.layout === 'slider' ? s.slides?.[0]?.headline : (s.title || s.headline || s.employerTitle);
  const subtitle = String(lead || '').replace(/\*/g, '').replace(/\s*\n\s*/g, ' ');
  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-1.5 rounded-lg pr-1.5 transition ${isDragging ? 'shadow-lg bg-white ring-1 ring-black/5' : ''} ${active ? 'bg-emerald-700 text-white' : 'hover:bg-gray-100'}`}>
      <button type="button" {...attributes} {...listeners} aria-label={`Drag ${def?.label}`}
        className={`pl-1.5 py-2.5 cursor-grab active:cursor-grabbing touch-none ${active ? 'text-white/50' : 'text-gray-300 group-hover:text-gray-400'}`}>
        <GripVertical size={14} />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 flex items-center gap-2.5 py-2 text-left">
        <span className={`grid place-items-center w-7 h-7 rounded-md shrink-0 ${active ? 'bg-white/15' : 'bg-white ring-1 ring-black/5 text-gray-500'} ${!s.enabled && !active ? 'opacity-50' : ''}`}>
          <Icon name={def?.icon} size={14} />
        </span>
        <span className={`min-w-0 ${!s.enabled && !active ? 'opacity-50' : ''}`}>
          <span className="block text-[12.5px] font-semibold truncate">{def?.label}</span>
          {subtitle && <span className={`block text-[11px] truncate ${active ? 'text-white/65' : 'text-gray-400'}`}>{subtitle}</span>}
        </span>
      </button>
      <button type="button" onClick={onToggle} title={s.enabled ? 'Hide section' : 'Show section'}
        className={`grid place-items-center w-7 h-7 rounded-md shrink-0 transition ${active ? 'hover:bg-white/15' : 'hover:bg-white'} ${s.enabled ? (active ? 'text-white/80' : 'text-gray-400 opacity-0 group-hover:opacity-100') : (active ? 'text-white' : 'text-amber-600')}`}>
        {s.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  );
}

/* ─── Add-section library ───────────────────────────────────────────────── */

function AddSectionDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (type: string) => void }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const defs = SECTION_DEFS.filter(d => !q || `${d.label} ${d.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex-1">
            <p className="font-bold text-gray-900">Add a section</p>
            <p className="text-xs text-gray-500">It is inserted below the selected section, and you can drag it anywhere afterwards.</p>
          </div>
          <button type="button" onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <div className="px-6 pt-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search sections"
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/25 focus:border-emerald-600" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 p-6 overflow-y-auto">
          {defs.map(d => (
            <button key={d.type} type="button" onClick={() => onAdd(d.type)}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 text-left hover:border-emerald-600 hover:bg-emerald-50/40 transition">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 shrink-0"><Icon name={d.icon} size={17} /></span>
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {d.label}
                  {d.live && <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Live data</span>}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">{d.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Panels ────────────────────────────────────────────────────────────── */

function PanelHeader({ icon, title, subtitle, actions }: { icon: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-4 bg-white/95 backdrop-blur border-b border-gray-100">
      <span className="grid place-items-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 shrink-0"><Icon name={icon} size={17} /></span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-[15px] truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

function ThemePanel({ theme, onChange }: { theme: any; onChange: (t: any) => void }) {
  const set = (k: string, v: any) => onChange({ ...theme, [k]: v, ...(k !== 'preset' && ['primary', 'primaryDark', 'accent', 'gold', 'ink', 'sand', 'surface', 'text', 'muted'].includes(k) ? { preset: 'custom' } : {}) });
  const flag = ['#00732F', '#C8102E', '#000000', '#FFFFFF', '#B8935A'];
  const colors: [string, string, string][] = [
    ['primary', 'Primary', 'Buttons, links, highlights on light backgrounds'],
    ['primaryDark', 'Primary — dark', 'Hover states and gradients'],
    ['accent', 'Accent', 'Small details — badges, step numbers'],
    ['gold', 'Gold', 'Highlights on dark backgrounds, stars'],
    ['ink', 'Night', 'Dark sections, top bar and footer'],
    ['sand', 'Sand', 'Warm light section background'],
    ['surface', 'Surface', 'White sections and cards'],
    ['text', 'Text', 'Headings and body text'],
    ['muted', 'Muted text', 'Secondary text'],
  ];
  const fontField = (key: 'headingFont' | 'bodyFont', label: string) => (
    <div>
      <p className="text-[12px] font-semibold text-gray-700 mb-1.5">{label}</p>
      <select value={theme[key]} onChange={e => set(key, e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-600/25 focus:border-emerald-600">
        {Object.entries(FONT_FAMILIES).map(([name, f]) => <option key={name} value={name}>{name} ({f.kind})</option>)}
      </select>
    </div>
  );
  return (
    <div className="p-5 space-y-7">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Colour presets</p>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map(p => {
            const active = theme.preset === p.id;
            const t = p.theme as any;
            return (
              <button key={p.id} type="button" onClick={() => onChange({ ...theme, ...p.theme, preset: p.id })}
                className={`text-left rounded-xl border p-3 transition ${active ? 'border-emerald-700 ring-2 ring-emerald-700/15' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex h-7 rounded-md overflow-hidden mb-2 ring-1 ring-black/5">
                  {[t.primary, t.accent, t.gold, t.ink, t.sand].map((c: string, i: number) => <span key={i} className="flex-1" style={{ background: c }} />)}
                </div>
                <p className="text-[12.5px] font-semibold text-gray-900 flex items-center gap-1">{active && <Check size={12} className="text-emerald-700" />}{p.label}</p>
                <p className="text-[11px] text-gray-500">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Colours {theme.preset === 'custom' && <span className="normal-case tracking-normal font-medium text-amber-600">· customised</span>}</p>
        <div className="space-y-3.5">
          {colors.map(([k, label, hint]) => (
            <ColorInput key={k} field={{ key: k, type: 'color', label, hint }} value={theme[k]} onChange={v => set(k, v)} swatches={flag} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Typography</p>
        <div className="space-y-3.5">
          {fontField('headingFont', 'Heading font')}
          {fontField('bodyFont', 'Body font')}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Shape & motion</p>
        <div className="space-y-3.5">
          <FieldInput field={{ key: 'radius', type: 'select', label: 'Corner style', options: [
            { value: 'sharp', label: 'Sharp' }, { value: 'soft', label: 'Soft' }, { value: 'rounded', label: 'Rounded' }, { value: 'pill', label: 'Pill' },
          ] }} value={theme.radius} onChange={v => set('radius', v)} />
          <FieldInput field={{ key: 'animations', type: 'toggle', label: 'Scroll animations', hint: 'Sections fade in as visitors scroll' }} value={theme.animations} onChange={v => set('animations', v)} />
          <FieldInput field={{ key: 'flagStripe', type: 'toggle', label: 'UAE flag stripe under the header' }} value={theme.flagStripe} onChange={v => set('flagStripe', v)} />
        </div>
      </div>
      <button type="button" onClick={() => onChange(clone(DEFAULT_THEME))}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">
        <RotateCcw size={13} /> Restore the default theme
      </button>
    </div>
  );
}

function SeoPanel({ seo, onChange }: { seo: any; onChange: (v: any) => void }) {
  const t = String(seo.title || ''), d = String(seo.description || '');
  return (
    <div className="p-5 space-y-6">
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">Search result preview</p>
        <p className="text-[12px] text-gray-500 truncate">alkhadim.ae</p>
        <p className="text-[17px] text-[#1a0dab] leading-snug truncate">{t || 'Untitled'}</p>
        <p className="text-[13px] text-gray-600 leading-snug line-clamp-2 mt-0.5">{d || 'Add a description to control what search engines show.'}</p>
      </div>
      <FieldList fields={SEO_FIELDS} value={seo} onChange={onChange} />
      <div className="flex gap-4 text-[11px]">
        <span className={t.length > 60 ? 'text-amber-600 font-semibold' : 'text-gray-400'}>Title: {t.length} characters</span>
        <span className={d.length > 160 || (d.length > 0 && d.length < 70) ? 'text-amber-600 font-semibold' : 'text-gray-400'}>Description: {d.length} characters</span>
      </div>
      <button type="button" onClick={() => onChange(clone(DEFAULT_SEO))}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">
        <RotateCcw size={13} /> Restore defaults
      </button>
    </div>
  );
}

/* ─── Builder ───────────────────────────────────────────────────────────── */

export default function Builder() {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState('');
  const [panel, setPanel] = useState<Panel>({ kind: 'section', id: 'hero' });
  const [device, setDevice] = useState<Device>('desktop');
  const [showPreview, setShowPreview] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusSlide, setFocusSlide] = useState<{ index: number; n: number } | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.key === 'slides') setFocusSlide(f => ({ index: d.index, n: (f?.n || 0) + 1 }));
    };
    window.addEventListener('hp-builder-list-open', onOpen);
    return () => window.removeEventListener('hp-builder-list-open', onOpen);
  }, []);
  /** Phones show either the navigator or the editor; this tracks which. */
  const [mobileEditor, setMobileEditor] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const { data } = await api.get('/site-config');
      const d: Draft = {
        homepage: normalizeHomepage(data.homepage),
        navbar: normalizeNavbar(data.navbar),
        footer: normalizeFooter(data.footer),
      };
      setSaved(clone(d));
      setDraft(clone(d));
      setPanel(p => (p.kind === 'section' && !d.homepage.sections.some(s => s.id === p.id))
        ? (d.homepage.sections[0] ? { kind: 'section', id: d.homepage.sections[0].id } : { kind: 'theme' })
        : p);
    } catch (e: any) {
      setLoadError(errMsg(e, 'Could not load the website configuration'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return { homepage: false, navbar: false, footer: false, any: false };
    const h = !same(saved.homepage, draft.homepage), n = !same(saved.navbar, draft.navbar), f = !same(saved.footer, draft.footer);
    return { homepage: h, navbar: n, footer: f, any: h || n || f };
  }, [saved, draft]);

  useEffect(() => {
    if (!dirty.any) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty.any]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const next = clone(saved!) as Draft;
      for (const key of ['homepage', 'navbar', 'footer'] as const) {
        if (!dirty[key]) continue;
        const { data } = await api.put(`/site-config/${key}`, draft[key]);
        next[key] = key === 'homepage' ? normalizeHomepage(data) : key === 'navbar' ? normalizeNavbar(data) : normalizeFooter(data);
        setSaved(clone(next));
      }
      setDraft(clone(next));
      toast.success('Website published');
    } catch (e: any) {
      toast.error(errMsg(e, 'Save failed — your changes are still here, try again'));
    } finally {
      setSaving(false);
    }
  }, [draft, saved, dirty, saving]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (loadError) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">{loadError}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold">Try again</button>
        </div>
      </div>
    );
  }
  if (!draft) {
    return <div className="h-full grid place-items-center text-sm text-gray-500"><span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading the Website Builder…</span></div>;
  }

  const sections = draft.homepage.sections;
  const setHome = (fn: (h: HomepageConfig) => HomepageConfig) => setDraft(d => d && ({ ...d, homepage: fn(d.homepage) }));
  const setSections = (fn: (s: HomeSection[]) => HomeSection[]) => setHome(h => ({ ...h, sections: fn(h.sections) }));
  const updateSection = (id: string, next: HomeSection) => setSections(ss => ss.map(s => (s.id === id ? next : s)));
  const selectedId = panel.kind === 'section' ? panel.id : null;
  const current = selectedId ? sections.find(s => s.id === selectedId) : undefined;

  function addSection(type: string) {
    const s = newSection(type);
    setSections(ss => {
      const at = selectedId ? ss.findIndex(x => x.id === selectedId) : -1;
      const next = [...ss];
      next.splice(at >= 0 ? at + 1 : next.length, 0, s);
      return next;
    });
    setPanel({ kind: 'section', id: s.id });
    setAdding(false);
  }

  function duplicate(s: HomeSection) {
    const copy = { ...clone(s), id: `${s.type}-${Math.random().toString(36).slice(2, 8)}` };
    setSections(ss => { const i = ss.findIndex(x => x.id === s.id); const n = [...ss]; n.splice(i + 1, 0, copy); return n; });
    setPanel({ kind: 'section', id: copy.id });
  }

  function remove(s: HomeSection) {
    if (!confirm(`Delete the “${SECTION_BY_TYPE[s.type]?.label}” section? You can undo this by discarding changes before you publish.`)) return;
    const i = sections.findIndex(x => x.id === s.id);
    setSections(ss => ss.filter(x => x.id !== s.id));
    const next = sections[i + 1] || sections[i - 1];
    setPanel(next ? { kind: 'section', id: next.id } : { kind: 'theme' });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setSections(ss => arrayMove(ss, ss.findIndex(s => s.id === e.active.id), ss.findIndex(s => s.id === e.over!.id)));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `website-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMenuOpen(false);
  }

  async function importJson(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw?.homepage?.sections) throw new Error('This file is not a website export');
      setDraft({ homepage: normalizeHomepage(raw.homepage), navbar: normalizeNavbar(raw.navbar), footer: normalizeFooter(raw.footer) });
      toast.success('Imported — review the preview, then publish');
    } catch (e: any) {
      toast.error(e?.message || 'Could not read that file');
    }
  }

  function discard() {
    if (!confirm('Discard all unpublished changes?')) return;
    setDraft(clone(saved!));
    setMenuOpen(false);
  }

  function resetSection(s: HomeSection) {
    if (!confirm('Reset this section’s content and style to the defaults?')) return;
    updateSection(s.id, { ...newSection(s.type, s.id), enabled: s.enabled });
  }

  const open = (p: Panel) => { setPanel(p); setMobileEditor(true); };

  const navItem = (p: Panel, icon: React.ReactNode, label: string, isDirty?: boolean) => {
    const active = panel.kind === p.kind;
    return (
      <button type="button" onClick={() => open(p)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold transition ${active ? 'bg-emerald-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
        {icon}<span className="flex-1 text-left">{label}</span>
        {isDirty && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-amber-500'}`} />}
      </button>
    );
  };

  /* Editor panel content */
  let editor: React.ReactNode = null;
  if (panel.kind === 'theme') {
    editor = <>
      <PanelHeader icon="Sparkles" title="Theme & colours" subtitle="Applies to the homepage, header and footer" />
      <ThemePanel theme={draft.homepage.theme} onChange={t => setHome(h => ({ ...h, theme: t }))} />
    </>;
  } else if (panel.kind === 'seo') {
    editor = <>
      <PanelHeader icon="Search" title="SEO & sharing" subtitle="How the homepage appears in Google and when shared" />
      <SeoPanel seo={draft.homepage.seo} onChange={v => setHome(h => ({ ...h, seo: v }))} />
    </>;
  } else if (panel.kind === 'navbar') {
    editor = <>
      <PanelHeader icon="Layout" title="Header" subtitle="Logo, menu and buttons — shown on every public page" />
      <div className="p-5"><FieldList fields={NAVBAR_FIELDS} value={draft.navbar} onChange={v => setDraft(d => d && ({ ...d, navbar: v }))} /></div>
    </>;
  } else if (panel.kind === 'footer') {
    editor = <>
      <PanelHeader icon="Building2" title="Footer" subtitle="Shown on every public page" />
      <div className="p-5"><FieldList fields={FOOTER_FIELDS} value={draft.footer} onChange={v => setDraft(d => d && ({ ...d, footer: v }))} /></div>
    </>;
  } else if (current) {
    const def = SECTION_BY_TYPE[current.type];
    const btn = 'grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition';
    const styleFields: Field[] = current.type === 'hero' ? STYLE_FIELDS.filter(f => ['anchor', 'hideOnMobile', 'hideOnDesktop'].includes(f.key) || f.type === 'heading') : STYLE_FIELDS;
    editor = <>
      <PanelHeader icon={def.icon} title={def.label} subtitle={def.description} actions={
        <div className="flex items-center gap-0.5">
          <button type="button" title={current.enabled ? 'Hide section' : 'Show section'} className={btn}
            onClick={() => updateSection(current.id, { ...current, enabled: !current.enabled })}>
            {current.enabled ? <Eye size={15} /> : <EyeOff size={15} className="text-amber-600" />}
          </button>
          <button type="button" title="Duplicate" className={btn} onClick={() => duplicate(current)}><Copy size={15} /></button>
          <button type="button" title="Reset to defaults" className={btn} onClick={() => resetSection(current)}><RotateCcw size={15} /></button>
          <button type="button" title="Delete" className={`${btn} hover:!bg-red-50 hover:!text-red-600`} onClick={() => remove(current)}><Trash2 size={15} /></button>
        </div>
      } />
      {!current.enabled && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
          <EyeOff size={13} /> This section is hidden from visitors.
          <button type="button" className="ml-auto font-semibold underline" onClick={() => updateSection(current.id, { ...current, enabled: true })}>Show it</button>
        </div>
      )}
      {def.live && (
        <p className="mx-5 mt-4 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] text-emerald-800">
          This section shows live {current.type === 'jobs' ? 'published jobs' : 'published candidate profiles'} from the system automatically.
        </p>
      )}
      <div className="p-5 space-y-6">
        <FieldList fields={def.fields} value={current} onChange={v => updateSection(current.id, v)} />
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <FieldList fields={styleFields} value={current} onChange={v => updateSection(current.id, v)} />
        </div>
      </div>
    </>;
  }

  return (
    <div className="h-full min-h-[640px] flex flex-col -mx-3 sm:-mx-5 -mt-3 bg-white border-t border-gray-200">
      <SiteLinksDatalist />
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-[15px] leading-tight">Website Builder</p>
          <p className={`text-[11px] flex items-center gap-1.5 ${dirty.any ? 'text-amber-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dirty.any ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {dirty.any ? 'Unpublished changes' : 'All changes published'}
          </p>
        </div>
        <div className="mx-auto hidden md:flex p-0.5 rounded-lg bg-gray-100">
          {([['desktop', Laptop], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, I]) => (
            <button key={d} type="button" onClick={() => { setDevice(d); setShowPreview(true); }} title={`${d[0].toUpperCase()}${d.slice(1)} preview`}
              className={`grid place-items-center w-9 h-8 rounded-md transition ${device === d && showPreview ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
              <I size={15} />
            </button>
          ))}
          <button type="button" onClick={() => setShowPreview(v => !v)} title={showPreview ? 'Hide preview' : 'Show preview'}
            className="grid place-items-center w-9 h-8 rounded-md text-gray-500 hover:text-gray-800">
            {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div className="ml-auto md:ml-0 flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen(v => !v)} className="grid place-items-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><MoreHorizontal size={16} /></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 w-56 bg-white rounded-xl border border-gray-200 shadow-xl p-1.5 text-[13px]">
                  <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"><ExternalLink size={14} /> View live site</a>
                  <button type="button" onClick={exportJson} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"><Download size={14} /> Export backup (JSON)</button>
                  <button type="button" onClick={() => { importRef.current?.click(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"><FileUp size={14} /> Import backup</button>
                  <div className="h-px bg-gray-100 my-1" />
                  <button type="button" onClick={discard} disabled={!dirty.any} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40 disabled:pointer-events-none"><RotateCcw size={14} /> Discard changes</button>
                </div>
              </>
            )}
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} />
          </div>
          <button type="button" onClick={save} disabled={!dirty.any || saving} title="Publish (⌘S)"
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-700 text-white text-[13px] font-semibold hover:bg-emerald-800 disabled:opacity-40 transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Navigator */}
        <aside className={`${mobileEditor ? 'hidden sm:flex' : 'flex w-full sm:w-60'} sm:w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50/70`}>
          <div className="p-2 space-y-0.5 border-b border-gray-200">
            <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Site</p>
            {navItem({ kind: 'theme' }, <Palette size={15} />, 'Theme & colours')}
            {navItem({ kind: 'navbar' }, <PanelTop size={15} />, 'Header', dirty.navbar)}
            {navItem({ kind: 'footer' }, <PanelBottom size={15} />, 'Footer', dirty.footer)}
            {navItem({ kind: 'seo' }, <Search size={15} />, 'SEO & sharing')}
          </div>
          <div className="flex items-center justify-between px-4.5 pl-[18px] pr-2 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 flex items-center gap-1.5"><Layout size={12} /> Homepage sections</p>
            <button type="button" onClick={() => setAdding(true)} title="Add section" className="grid place-items-center w-6 h-6 rounded-md text-emerald-700 hover:bg-emerald-50"><Plus size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {sections.map(s => (
                    <SectionRow key={s.id} s={s} active={selectedId === s.id}
                      onSelect={() => open({ kind: 'section', id: s.id })}
                      onToggle={() => updateSection(s.id, { ...s, enabled: !s.enabled })} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button type="button" onClick={() => setAdding(true)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-[12px] font-semibold text-gray-500 hover:border-emerald-600 hover:text-emerald-700 hover:bg-white transition">
              <Plus size={13} /> Add section
            </button>
          </div>
        </aside>

        {/* Editor */}
        <div className={`${mobileEditor ? 'block' : 'hidden sm:block'} ${showPreview ? 'w-full sm:w-[400px] xl:w-[420px] shrink-0' : 'flex-1'} overflow-y-auto border-r border-gray-200 bg-white`}>
          <button type="button" onClick={() => setMobileEditor(false)} className="sm:hidden flex items-center gap-1 px-4 pt-3 text-[13px] font-semibold text-emerald-700">
            <ChevronLeft size={16} /> All sections
          </button>
          <div className={showPreview ? '' : 'max-w-2xl mx-auto'}>{editor}</div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="hidden lg:block flex-1 min-w-0">
            <Preview draft={draft} device={device} selectedId={selectedId} focusSlide={focusSlide}
              onPick={id => setPanel({ kind: 'section', id })} />
          </div>
        )}
      </div>

      {adding && <AddSectionDialog onClose={() => setAdding(false)} onAdd={addSection} />}
    </div>
  );
}

