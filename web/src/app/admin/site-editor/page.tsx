'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Palette, Layout, Monitor, Layers, AlignLeft, Save, RefreshCw,
  Plus, Trash2, GripVertical, Eye, EyeOff, Upload, Link, X,
  ChevronUp, ChevronDown, Type, Image, Globe, Phone, Mail,
  Instagram, Linkedin, Twitter, Facebook, MessageCircle,
  ToggleLeft, ToggleRight, ExternalLink, Check, Loader2,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

// ── Reusable sub-components ──────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6 pb-4 border-b border-gray-100">
      <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary-500" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">{children}</label>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, onChange, multiline = false, placeholder = '', hint }: any) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {multiline
        ? <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 bg-white transition-all resize-none h-20" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 bg-white transition-all" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

function ColorField({ label, value, onChange, hint }: any) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
            className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white" />
        </div>
        <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 bg-white"
          value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: any) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-400' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function ImageField({ label, value, onChange, token, hint }: any) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await axios.post(`${API}/api/site-config/upload/image`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
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
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="flex gap-1 mb-2">
        {(['url', 'upload'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${mode === m ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {m === 'url' ? <><Link size={10} className="inline mr-1" />URL</> : <><Upload size={10} className="inline mr-1" />Upload</>}
          </button>
        ))}
      </div>
      {mode === 'url' ? (
        <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 bg-white"
          value={value || ''} onChange={e => onChange(e.target.value)} placeholder="https://..." />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Click to upload image</>}
          </button>
        </div>
      )}
      {value && (
        <div className="mt-2 relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 80 }}>
          <img src={value} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function NavLinkEditor({ links, onChange }: { links: any[]; onChange: (l: any[]) => void }) {
  function update(i: number, key: string, val: string) {
    const next = links.map((l, idx) => idx === i ? { ...l, [key]: val } : l);
    onChange(next);
  }
  function add()        { onChange([...links, { label: 'New Link', href: '/' }]); }
  function remove(i: number) { onChange(links.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const next = [...links];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2">
          <div className="flex flex-col gap-0.5 shrink-0">
            <button onClick={() => move(i, -1)} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={i === 0}><ChevronUp size={12} /></button>
            <button onClick={() => move(i, 1)}  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={i === links.length - 1}><ChevronDown size={12} /></button>
          </div>
          <input className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40" value={l.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Label" />
          <input className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40" value={l.href}  onChange={e => update(i, 'href',  e.target.value)} placeholder="/path" />
          <button onClick={() => remove(i)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={add} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-1">
        <Plus size={12} /> Add Link
      </button>
    </div>
  );
}

function FooterColumnEditor({ columns, onChange }: { columns: any[]; onChange: (c: any[]) => void }) {
  function updateCol(ci: number, key: string, val: any) {
    onChange(columns.map((c, i) => i === ci ? { ...c, [key]: val } : c));
  }
  function updateLink(ci: number, li: number, key: string, val: string) {
    const col = columns[ci];
    const links = col.links.map((l: any, i: number) => i === li ? { ...l, [key]: val } : l);
    updateCol(ci, 'links', links);
  }
  function addCol()        { onChange([...columns, { title: 'New Column', links: [] }]); }
  function removeCol(ci: number) { onChange(columns.filter((_, i) => i !== ci)); }
  function addLink(ci: number)   { updateCol(ci, 'links', [...columns[ci].links, { label: 'Link', href: '/' }]); }
  function removeLink(ci: number, li: number) { updateCol(ci, 'links', columns[ci].links.filter((_: any, i: number) => i !== li)); }

  return (
    <div className="space-y-3">
      {columns.map((col, ci) => (
        <div key={ci} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <input className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white focus:outline-none" value={col.title} onChange={e => updateCol(ci, 'title', e.target.value)} placeholder="Column Title" />
            <button onClick={() => removeCol(ci)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
          </div>
          <div className="space-y-1.5 mb-2">
            {col.links.map((link: any, li: number) => (
              <div key={li} className="flex items-center gap-1.5">
                <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none" value={link.label} onChange={e => updateLink(ci, li, 'label', e.target.value)} placeholder="Label" />
                <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none" value={link.href}  onChange={e => updateLink(ci, li, 'href',  e.target.value)} placeholder="/path" />
                <button onClick={() => removeLink(ci, li)} className="text-red-400 hover:text-red-600 shrink-0"><X size={11} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => addLink(ci)} className="text-xs text-primary-500 hover:underline flex items-center gap-1"><Plus size={10} /> Add link</button>
        </div>
      ))}
      <button onClick={addCol} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-1">
        <Plus size={12} /> Add Column
      </button>
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────

const TABS = [
  { id: 'theme',    label: 'Theme',    icon: Palette },
  { id: 'navbar',   label: 'Navbar',   icon: Layout },
  { id: 'hero',     label: 'Hero',     icon: Monitor },
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'footer',   label: 'Footer',   icon: AlignLeft },
];

const SECTION_LABELS: Record<string, string> = {
  clients:      'Client Logos Marquee',
  stats:        'Stats Counter Bar',
  services:     'Services Grid',
  process:      'How We Work (Process)',
  whyUs:        'Why Choose Us',
  industries:   'Industries We Serve',
  jobs:         'Latest Job Openings',
  candidates:   'Talent Pool',
  globalBanner: 'Global Reach Banner',
  testimonials: 'Testimonials',
  awards:       'Awards & Accreditations',
  ceo:          'CEO Message',
  cvUpload:     'CV Upload CTA',
  cta:          'Bottom CTA',
};

export default function SiteEditorPage() {
  const [accessToken, setAccessToken] = useState<string>('');
  useEffect(() => { setAccessToken(localStorage.getItem('accessToken') || ''); }, []);
  const [tab, setTab] = useState('theme');
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['site-config'],
    queryFn: () => axios.get(`${API}/api/site-config`).then(r => r.data),
  });

  // Local editable copies
  const [theme,    setTheme]    = useState<any>(null);
  const [navbar,   setNavbar]   = useState<any>(null);
  const [hero,     setHero]     = useState<any>(null);
  const [sections, setSections] = useState<any>(null);
  const [footer,   setFooter]   = useState<any>(null);

  /** Replaces the local editable copies with (deep copies of) the given saved config. */
  function loadFromConfig(cfg: any) {
    if (!cfg) return;
    setTheme(JSON.parse(JSON.stringify(cfg.theme)));
    setNavbar(JSON.parse(JSON.stringify(cfg.navbar)));
    setHero(JSON.parse(JSON.stringify(cfg.hero)));
    setSections(JSON.parse(JSON.stringify(cfg.sections)));
    setFooter(JSON.parse(JSON.stringify(cfg.footer)));
  }

  useEffect(() => { loadFromConfig(config); }, [config]);

  /**
   * Discards unsaved edits. A plain refetch isn't enough: when the server data is unchanged,
   * react-query keeps the same `config` object and the effect above never re-runs.
   */
  async function resetEdits() {
    if (!confirm('Discard all unsaved changes and reload the saved site configuration?')) return;
    const res = await refetch();
    if (res.error) {
      toast.error((res.error as any)?.response?.data?.error || 'Could not reload the saved configuration');
      return;
    }
    loadFromConfig(res.data ?? config);
    toast.success('Unsaved changes discarded');
  }

  const saving = useRef(false);
  const [savingAll, setSavingAll] = useState(false);
  const errMsg = (e: any, fallback: string) => e?.response?.data?.error || fallback;

  async function saveSection(key: string, value: any) {
    if (saving.current) return;
    saving.current = true;
    try {
      await api.put(`/site-config/${key}`, value); // shared client: refreshes an expired access token
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} saved!`);
    } catch (e: any) {
      toast.error(errMsg(e, 'Save failed'));
    } finally {
      saving.current = false;
    }
  }

  async function saveAll() {
    if (savingAll) return;
    const map: Record<string, any> = { theme, navbar, hero, sections, footer };
    setSavingAll(true);
    const savedKeys: string[] = [];
    try {
      for (const [key, val] of Object.entries(map)) {
        if (!val) continue;
        try {
          await api.put(`/site-config/${key}`, val); // shared client: refreshes an expired access token
          savedKeys.push(key);
        } catch (e: any) {
          toast.error(`Could not save ${key}: ${errMsg(e, 'Save failed')}${savedKeys.length ? ` (already saved: ${savedKeys.join(', ')})` : ''}`);
          return;
        }
      }
    } finally {
      setSavingAll(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast.success('All changes saved!');
    // Apply theme immediately
    if (theme && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', theme.primaryColor);
      root.style.setProperty('--color-primary-dark', theme.primaryDark);
      root.style.setProperty('--color-primary-light', theme.primaryLight);
      root.style.setProperty('--radius-btn', theme.btnRadius);
      root.style.setProperty('--radius-card', theme.cardRadius);
    }
  }

  if (isLoading || !theme) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-400">Loading site config…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Site Control Centre</h1>
          <p className="text-xs text-gray-400 mt-0.5">Edit homepage, navbar, footer and global theme</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <ExternalLink size={12} /> Preview Site
          </a>
          <button onClick={resetEdits} title="Discard unsaved changes" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw size={12} /> Reset
          </button>
          <button onClick={saveAll} disabled={savingAll}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-60 ${saved ? 'bg-emerald-500 text-white' : 'bg-primary-400 text-white hover:bg-primary-500'}`}>
            {saved ? <><Check size={12} /> Saved!</> : savingAll ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><Save size={12} /> Save All Changes</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <div className="w-44 border-r border-gray-100 bg-gray-50 py-4 shrink-0 flex flex-col gap-1 px-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${tab === t.id ? 'bg-primary-400 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-gray-200 mx-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Quick Save</p>
            <button onClick={() => saveSection(tab, { theme, navbar, hero, sections, footer }[tab])}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors">
              <Save size={11} /> Save {TABS.find(t2 => t2.id === tab)?.label}
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">

          {/* ═══════════════ THEME ═══════════════ */}
          {tab === 'theme' && theme && (
            <div className="max-w-2xl space-y-8">
              <SectionHeader icon={Palette} title="Global Theme" subtitle="These colours and styles apply site-wide" />

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Brand Colours</h4>
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Primary Color" value={theme.primaryColor} onChange={(v: string) => setTheme((t: any) => ({ ...t, primaryColor: v, primaryDark: v }))} hint="Buttons, links, accents" />
                  <ColorField label="Primary Dark" value={theme.primaryDark}   onChange={(v: string) => setTheme((t: any) => ({ ...t, primaryDark: v }))} hint="Hover states" />
                  <ColorField label="Primary Light" value={theme.primaryLight} onChange={(v: string) => setTheme((t: any) => ({ ...t, primaryLight: v }))} hint="Backgrounds, badges" />
                  <ColorField label="Accent Color"  value={theme.accentColor}  onChange={(v: string) => setTheme((t: any) => ({ ...t, accentColor: v }))} hint="Highlights, stars" />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Page Colours</h4>
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Page Background" value={theme.bgColor}   onChange={(v: string) => setTheme((t: any) => ({ ...t, bgColor: v }))} />
                  <ColorField label="Body Text"        value={theme.textColor} onChange={(v: string) => setTheme((t: any) => ({ ...t, textColor: v }))} />
                  <ColorField label="Navbar Background" value={theme.navBg}   onChange={(v: string) => setTheme((t: any) => ({ ...t, navBg: v }))} />
                  <ColorField label="Footer Background" value={theme.footerBg} onChange={(v: string) => setTheme((t: any) => ({ ...t, footerBg: v }))} />
                  <ColorField label="Footer Text"      value={theme.footerText} onChange={(v: string) => setTheme((t: any) => ({ ...t, footerText: v }))} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Shape & Typography</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel hint="CSS border-radius for buttons">Button Radius</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {['0px', '6px', '12px', '9999px'].map(r => (
                        <button key={r} onClick={() => setTheme((t: any) => ({ ...t, btnRadius: r }))}
                          className={`text-xs px-3 py-1.5 border rounded-lg font-semibold transition-all ${theme.btnRadius === r ? 'bg-primary-400 text-white border-primary-400' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                          {r === '0px' ? 'Square' : r === '6px' ? 'Small' : r === '12px' ? 'Medium' : 'Pill'}
                        </button>
                      ))}
                    </div>
                    <input className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none" value={theme.btnRadius} onChange={e => setTheme((t: any) => ({ ...t, btnRadius: e.target.value }))} placeholder="9999px" />
                  </div>
                  <div>
                    <FieldLabel hint="CSS border-radius for cards">Card Radius</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {['0px', '8px', '16px', '24px'].map(r => (
                        <button key={r} onClick={() => setTheme((t: any) => ({ ...t, cardRadius: r }))}
                          className={`text-xs px-3 py-1.5 border rounded-lg font-semibold transition-all ${theme.cardRadius === r ? 'bg-primary-400 text-white border-primary-400' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                          {r === '0px' ? 'Square' : r === '8px' ? 'Small' : r === '16px' ? 'Medium' : 'Large'}
                        </button>
                      ))}
                    </div>
                    <input className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none" value={theme.cardRadius} onChange={e => setTheme((t: any) => ({ ...t, cardRadius: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-4">
                  <FieldLabel hint="Main site font family">Font Family</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {['Plus Jakarta Sans', 'Inter', 'DM Sans', 'Poppins', 'Nunito', 'Roboto'].map(f => (
                      <button key={f} onClick={() => setTheme((t: any) => ({ ...t, fontFamily: f }))}
                        className={`text-xs px-3 py-1.5 border rounded-lg transition-all ${theme.fontFamily === f ? 'bg-primary-400 text-white border-primary-400' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}
                        style={{ fontFamily: f }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live preview swatches */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Live Preview</h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <button className="text-sm font-bold px-5 py-2.5 text-white transition-all" style={{ background: theme.primaryColor, borderRadius: theme.btnRadius }}>
                    Primary Button
                  </button>
                  <button className="text-sm font-bold px-5 py-2.5 border-2 transition-all" style={{ borderColor: theme.primaryColor, color: theme.primaryColor, borderRadius: theme.btnRadius }}>
                    Outline Button
                  </button>
                  <div className="flex gap-2">
                    {[theme.primaryColor, theme.primaryDark, theme.primaryLight, theme.accentColor, theme.footerBg].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm" style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ NAVBAR ═══════════════ */}
          {tab === 'navbar' && navbar && (
            <div className="max-w-2xl space-y-6">
              <SectionHeader icon={Layout} title="Navbar" subtitle="Logo, navigation links and CTA button" />

              <div className="grid grid-cols-2 gap-4">
                <TextField label="Logo Text"  value={navbar.logoText} onChange={(v: string) => setNavbar((n: any) => ({ ...n, logoText: v }))} placeholder="Al Khadim" />
                <TextField label="Logo Tagline" value={navbar.tagline} onChange={(v: string) => setNavbar((n: any) => ({ ...n, tagline: v }))} placeholder="LLC" />
              </div>

              <ImageField label="Logo Image (overrides text)" value={navbar.logoImage} onChange={(v: string) => setNavbar((n: any) => ({ ...n, logoImage: v }))} token={accessToken} hint="Leave blank to use text logo" />

              <div className="grid grid-cols-2 gap-4">
                <Toggle label="Sticky Navbar" checked={navbar.sticky} onChange={(v: boolean) => setNavbar((n: any) => ({ ...n, sticky: v }))} hint="Sticks to top when scrolling" />
                <Toggle label="Transparent on Hero" checked={navbar.transparent} onChange={(v: boolean) => setNavbar((n: any) => ({ ...n, transparent: v }))} hint="Glass effect over hero" />
              </div>

              <div>
                <FieldLabel hint="Drag to reorder. Add or remove links.">Navigation Links</FieldLabel>
                <NavLinkEditor links={navbar.links || []} onChange={(l: any) => setNavbar((n: any) => ({ ...n, links: l }))} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <TextField label="CTA Button Text" value={navbar.ctaLabel} onChange={(v: string) => setNavbar((n: any) => ({ ...n, ctaLabel: v }))} placeholder="Hire Talent" />
                <TextField label="CTA Button Link" value={navbar.ctaHref}  onChange={(v: string) => setNavbar((n: any) => ({ ...n, ctaHref:  v }))} placeholder="/enquiry" />
              </div>
            </div>
          )}

          {/* ═══════════════ HERO ═══════════════ */}
          {tab === 'hero' && hero && (
            <div className="max-w-2xl space-y-6">
              <SectionHeader icon={Monitor} title="Hero Section" subtitle="The full-screen banner at top of homepage" />

              <Toggle label="Show Hero Section" checked={hero.enabled} onChange={(v: boolean) => setHero((h: any) => ({ ...h, enabled: v }))} />
              <Toggle label="Show Announcement Banner" checked={hero.showAnnouncement} onChange={(v: boolean) => setHero((h: any) => ({ ...h, showAnnouncement: v }))} />

              {hero.showAnnouncement && (
                <div className="grid grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="col-span-2">
                    <TextField label="Announcement Text" value={hero.announcementText} onChange={(v: string) => setHero((h: any) => ({ ...h, announcementText: v }))} />
                  </div>
                  <TextField label="Link Text"  value={hero.announcementLinkText} onChange={(v: string) => setHero((h: any) => ({ ...h, announcementLinkText: v }))} />
                  <div className="col-span-3">
                    <TextField label="Announcement Link" value={hero.announcementLink} onChange={(v: string) => setHero((h: any) => ({ ...h, announcementLink: v }))} />
                  </div>
                </div>
              )}

              <div>
                <TextField label="Headline" value={hero.headline} onChange={(v: string) => setHero((h: any) => ({ ...h, headline: v }))} multiline placeholder="Your main headline…" hint="Use line breaks (↵) for line splits" />
              </div>
              <TextField label="Sub-headline" value={hero.subheadline} onChange={(v: string) => setHero((h: any) => ({ ...h, subheadline: v }))} multiline placeholder="Supporting text…" />

              <div className="grid grid-cols-2 gap-3">
                <TextField label="CTA 1 Label" value={hero.cta1Label} onChange={(v: string) => setHero((h: any) => ({ ...h, cta1Label: v }))} />
                <TextField label="CTA 1 Link"  value={hero.cta1Href}  onChange={(v: string) => setHero((h: any) => ({ ...h, cta1Href: v }))} />
                <TextField label="CTA 2 Label" value={hero.cta2Label} onChange={(v: string) => setHero((h: any) => ({ ...h, cta2Label: v }))} />
                <TextField label="CTA 2 Link"  value={hero.cta2Href}  onChange={(v: string) => setHero((h: any) => ({ ...h, cta2Href: v }))} />
              </div>

              <Toggle label="Show Search Bar" checked={hero.showSearch} onChange={(v: boolean) => setHero((h: any) => ({ ...h, showSearch: v }))} />

              <div className="border-t border-gray-100 pt-5">
                <FieldLabel hint="Choose the hero background type">Background Type</FieldLabel>
                <div className="flex gap-2 mb-4">
                  {([
                    { id: 'image', label: 'Image', icon: Image },
                    { id: 'gradient', label: 'Gradient', icon: Palette },
                    { id: 'color', label: 'Solid Color', icon: Type },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setHero((h: any) => ({ ...h, bgType: id }))}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${hero.bgType === id ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                {hero.bgType === 'image' && (
                  <div className="space-y-3">
                    <ImageField label="Background Image" value={hero.bgImage} onChange={(v: string) => setHero((h: any) => ({ ...h, bgImage: v }))} token={accessToken} hint="Recommended: 1600×900px, under 2MB" />
                    <div>
                      <FieldLabel hint="0 = transparent, 1 = full black">Overlay Opacity: {hero.overlayOpacity}</FieldLabel>
                      <input type="range" min="0" max="1" step="0.05" value={hero.overlayOpacity}
                        onChange={e => setHero((h: any) => ({ ...h, overlayOpacity: parseFloat(e.target.value) }))}
                        className="w-full accent-primary-400" />
                    </div>
                  </div>
                )}
                {hero.bgType === 'gradient' && (
                  <TextField label="Tailwind Gradient Classes" value={hero.bgGradient} onChange={(v: string) => setHero((h: any) => ({ ...h, bgGradient: v }))} placeholder="from-slate-900 to-blue-900" hint="Tailwind gradient class pair" />
                )}
                {hero.bgType === 'color' && (
                  <ColorField label="Background Color" value={hero.bgColor} onChange={(v: string) => setHero((h: any) => ({ ...h, bgColor: v }))} />
                )}
              </div>
            </div>
          )}

          {/* ═══════════════ SECTIONS ═══════════════ */}
          {tab === 'sections' && sections && (
            <div className="max-w-2xl space-y-4">
              <SectionHeader icon={Layers} title="Homepage Sections" subtitle="Toggle sections on/off and edit their headings" />

              {Object.entries(SECTION_LABELS).map(([key, label]) => {
                const sec = sections[key] || { enabled: true };
                return (
                  <div key={key} className={`border rounded-2xl overflow-hidden transition-all ${sec.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => setSections((s: any) => ({ ...s, [key]: { ...s[key], enabled: !s[key]?.enabled } }))}
                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${sec.enabled ? 'bg-primary-400' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sec.enabled ? 'translate-x-5' : ''}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{label}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{key}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sec.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {sec.enabled ? 'Visible' : 'Hidden'}
                      </span>
                    </div>

                    {sec.enabled && (sec.title !== undefined || sec.subtitle !== undefined || sec.ctaLabel !== undefined) && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 grid grid-cols-2 gap-3">
                        {sec.title !== undefined && (
                          <div className="col-span-2">
                            <TextField label="Section Title" value={sec.title} onChange={(v: string) => setSections((s: any) => ({ ...s, [key]: { ...s[key], title: v } }))} />
                          </div>
                        )}
                        {sec.subtitle !== undefined && (
                          <div className="col-span-2">
                            <TextField label="Section Subtitle" value={sec.subtitle} onChange={(v: string) => setSections((s: any) => ({ ...s, [key]: { ...s[key], subtitle: v } }))} />
                          </div>
                        )}
                        {sec.ctaLabel !== undefined && (
                          <TextField label="CTA Label" value={sec.ctaLabel} onChange={(v: string) => setSections((s: any) => ({ ...s, [key]: { ...s[key], ctaLabel: v } }))} />
                        )}
                        {sec.ctaHref !== undefined && (
                          <TextField label="CTA Link" value={sec.ctaHref} onChange={(v: string) => setSections((s: any) => ({ ...s, [key]: { ...s[key], ctaHref: v } }))} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════════ FOOTER ═══════════════ */}
          {tab === 'footer' && footer && (
            <div className="max-w-2xl space-y-6">
              <SectionHeader icon={AlignLeft} title="Footer" subtitle="Logo, contact info, link columns and socials" />

              <div className="grid grid-cols-2 gap-4">
                <TextField label="Company Name" value={footer.logoText}    onChange={(v: string) => setFooter((f: any) => ({ ...f, logoText: v }))} />
                <TextField label="Tagline"       value={footer.tagline}     onChange={(v: string) => setFooter((f: any) => ({ ...f, tagline: v }))} />
              </div>
              <TextField label="Description" value={footer.description} onChange={(v: string) => setFooter((f: any) => ({ ...f, description: v }))} multiline />
              <TextField label="Copyright Text" value={footer.copyright} onChange={(v: string) => setFooter((f: any) => ({ ...f, copyright: v }))} />

              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-gray-400 shrink-0" />
                  <TextField label="Phone" value={footer.phone} onChange={(v: string) => setFooter((f: any) => ({ ...f, phone: v }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <TextField label="Email" value={footer.email} onChange={(v: string) => setFooter((f: any) => ({ ...f, email: v }))} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Globe size={13} className="text-gray-400 shrink-0" />
                  <TextField label="Address" value={footer.address} onChange={(v: string) => setFooter((f: any) => ({ ...f, address: v }))} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <Toggle label="Show Social Links" checked={footer.showSocials} onChange={(v: boolean) => setFooter((f: any) => ({ ...f, showSocials: v }))} />
                {footer.showSocials && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                      { key: 'linkedin',  label: 'LinkedIn',  icon: Linkedin },
                      { key: 'instagram', label: 'Instagram', icon: Instagram },
                      { key: 'twitter',   label: 'Twitter/X', icon: Twitter },
                      { key: 'facebook',  label: 'Facebook',  icon: Facebook },
                      { key: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
                    ].map(({ key: sk, label, icon: Icon }) => (
                      <div key={sk} className="flex items-center gap-2">
                        <Icon size={13} className="text-gray-400 shrink-0" />
                        <TextField label={label} value={footer.socials?.[sk] || ''} onChange={(v: string) => setFooter((f: any) => ({ ...f, socials: { ...f.socials, [sk]: v } }))} placeholder="URL…" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <FieldLabel hint="Add or remove columns. Each column has a title and links.">Link Columns</FieldLabel>
                <FooterColumnEditor columns={footer.columns || []} onChange={(c: any) => setFooter((f: any) => ({ ...f, columns: c }))} />
              </div>
            </div>
          )}
        </div>

        {/* Right panel: mini preview */}
        <div className="w-64 border-l border-gray-100 bg-gray-50 p-4 hidden xl:block shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Live Colour Preview</p>
          <div className="space-y-2">
            {theme && [
              { label: 'Primary', color: theme.primaryColor },
              { label: 'Primary Dark', color: theme.primaryDark },
              { label: 'Primary Light', color: theme.primaryLight },
              { label: 'Accent', color: theme.accentColor },
              { label: 'Nav BG', color: theme.navBg },
              { label: 'Footer BG', color: theme.footerBg },
              { label: 'Page BG', color: theme.bgColor },
              { label: 'Text', color: theme.textColor },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg border border-gray-200 shadow-sm shrink-0" style={{ background: color }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-600 truncate">{label}</p>
                  <p className="text-[9px] font-mono text-gray-400">{color}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Button Preview</p>
            {theme && (
              <div className="space-y-2">
                <button className="w-full text-xs font-bold py-2 text-white transition-all"
                  style={{ background: theme.primaryColor, borderRadius: theme.btnRadius }}>
                  Primary
                </button>
                <button className="w-full text-xs font-bold py-2 border-2 transition-all"
                  style={{ borderColor: theme.primaryColor, color: theme.primaryColor, borderRadius: theme.btnRadius }}>
                  Outline
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
