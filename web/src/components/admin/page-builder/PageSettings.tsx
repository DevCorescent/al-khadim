'use client';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import { Download, ExternalLink, FileJson, Upload } from 'lucide-react';
import { ImageInput } from '@/components/admin/site-builder/fields';
import { normalizeDoc } from '@/lib/pageBuilder/doc';
import { slugError, slugify, type PageDoc, type PageSeo, type PageSettings as Settings } from '@/lib/pageBuilder/types';
import { ColorIn, FontIn, Group, Row, TextIn, Toggle, inputCls } from './controls';

export interface PageMeta { title: string; slug: string; status: string }

export default function PageSettings({ doc, meta, onDoc, onMeta, onImport }: {
  doc: PageDoc;
  meta: PageMeta;
  onDoc: (next: PageDoc, key?: string) => void;
  onMeta: (patch: Partial<PageMeta>) => void;
  onImport: (doc: PageDoc) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const st = doc.settings;
  const seo = doc.seo;
  const setS = (patch: Partial<Settings>) => onDoc({ ...doc, settings: { ...st, ...patch } }, `settings:${Object.keys(patch).join(',')}`);
  const setSeo = (patch: Partial<PageSeo>) => onDoc({ ...doc, seo: { ...seo, ...patch } }, `seo:${Object.keys(patch).join(',')}`);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const slugErr = slugError(meta.slug);
  const title = seo.title || meta.title;
  const desc = seo.description;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ kind: 'ak-page', title: meta.title, slug: meta.slug, doc }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.slug || 'page'}.page.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const next = normalizeDoc(data?.doc ?? data);
      if (!next.sections.length && !window.confirm('The file has no sections. Import anyway (this clears the page)?')) return;
      onImport(next);
      toast.success(`Imported ${next.sections.length} section${next.sections.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('That file is not a page export');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-3 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">Page</p>
        <p className="text-[14px] font-bold text-gray-900">Page settings</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Select anything on the canvas to edit it.</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Group title="General">
          <Row label="Page title"><TextIn value={meta.title} onChange={v => onMeta({ title: v })} /></Row>
          <Row label="URL" hint={slugErr || `${origin}/${meta.slug}`}>
            <div className={`flex h-8 rounded-md border ${slugErr ? 'border-red-300' : 'border-gray-200'} bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-600/20`}>
              <span className="px-2 grid place-items-center text-[11.5px] text-gray-400 bg-gray-50 border-r border-gray-200">/</span>
              <input className="flex-1 min-w-0 px-2 text-[12px] font-mono outline-none" value={meta.slug} onChange={e => onMeta({ slug: slugify(e.target.value) || e.target.value.toLowerCase() })} />
              {meta.status === 'published' && <a href={`/${meta.slug}`} target="_blank" rel="noreferrer" className="px-2 grid place-items-center text-gray-400 hover:text-teal-700" title="Open live page"><ExternalLink size={13} /></a>}
            </div>
          </Row>
        </Group>

        <Group title="Layout">
          <Toggle label="Show site navigation bar" checked={st.showNavbar} onChange={v => setS({ showNavbar: v })} />
          {st.showNavbar && <Toggle label="Navbar floats over the first section" checked={st.navOverlay} onChange={v => setS({ navOverlay: v })} />}
          <Toggle label="Show site footer" checked={st.showFooter} onChange={v => setS({ showFooter: v })} />
          <Row label="Default boxed width (px)" hint="Sections set to “Boxed” use this unless they set their own.">
            <TextIn type="number" value={String(st.contentWidth || '')} onChange={v => setS({ contentWidth: Number(v) || 1240 })} />
          </Row>
          <Toggle label="Smooth scrolling to #anchors" checked={st.smoothScroll} onChange={v => setS({ smoothScroll: v })} />
          <Toggle label="“Back to top” button" checked={st.backToTop} onChange={v => setS({ backToTop: v })} />
        </Group>

        <Group title="Appearance">
          <Row label="Page background"><ColorIn value={st.bgColor} placeholder="Theme surface" onChange={v => setS({ bgColor: v })} /></Row>
          <Row label="Text colour"><ColorIn value={st.textColor} placeholder="Theme text" onChange={v => setS({ textColor: v })} /></Row>
          <Row label="Heading font"><FontIn value={st.fontHeading} onChange={v => setS({ fontHeading: v })} /></Row>
          <Row label="Body font"><FontIn value={st.fontBody} onChange={v => setS({ fontBody: v })} /></Row>
          <p className="text-[10.5px] text-gray-400">Colours and fonts default to the website theme (Homepage Builder → Theme), so pages stay on-brand.</p>
        </Group>

        <Group title="SEO & sharing">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Google preview</p>
            <p className="text-[11.5px] text-gray-600 truncate">{origin.replace(/^https?:\/\//, '')} › {meta.slug}</p>
            <p className="text-[15px] leading-snug text-[#1a0dab] truncate">{title || 'Page title'}</p>
            <p className="text-[12px] text-gray-600 leading-snug line-clamp-2">{desc || 'Add a meta description to control the text shown in search results.'}</p>
          </div>
          <Row label={`Meta title (${(seo.title || '').length}/60)`} hint="Defaults to the page title"><TextIn value={seo.title} placeholder={meta.title} onChange={v => setSeo({ title: v })} /></Row>
          <Row label={`Meta description (${(seo.description || '').length}/160)`}>
            <textarea rows={3} className={`${inputCls} h-auto py-1.5 resize-y`} value={seo.description} onChange={e => setSeo({ description: e.target.value })} />
          </Row>
          <Row label="Keywords"><TextIn value={seo.keywords} placeholder="recruitment dubai, hr outsourcing" onChange={v => setSeo({ keywords: v })} /></Row>
          <ImageInput field={{ key: 'og', type: 'image', label: 'Social share image', hint: '1200×630 works best', uploadUrl: '/pages/upload' }} value={seo.ogImage} onChange={v => setSeo({ ogImage: v })} />
          <Row label="Canonical URL (optional)"><TextIn mono value={seo.canonical} placeholder="https://…" onChange={v => setSeo({ canonical: v })} /></Row>
          <Toggle label="Hide from search engines (noindex)" checked={seo.noindex} onChange={v => setSeo({ noindex: v })} />
        </Group>

        <Group title="Page CSS" defaultOpen={!!st.customCss}>
          <p className="text-[10.5px] text-gray-500">Applies to this page only. Scope rules under <code className="px-1 rounded bg-gray-100 text-teal-700">.pb-root</code>.</p>
          <textarea rows={8} spellCheck={false} value={st.customCss} onChange={e => setS({ customCss: e.target.value })} placeholder={'.pb-root h2 {\n  letter-spacing: -0.03em;\n}'}
            className={`${inputCls} h-auto py-2 font-mono text-[11px] leading-relaxed resize-y bg-gray-950 text-emerald-200 border-gray-800`} />
        </Group>

        <Group title="Import / export" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportJson} className="flex items-center justify-center gap-1.5 h-8 rounded-md border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"><Download size={13} /> Export</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-1.5 h-8 rounded-md border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"><Upload size={13} /> Import</button>
          </div>
          <p className="text-[10.5px] text-gray-400 flex items-start gap-1"><FileJson size={12} className="shrink-0 mt-px" /> Import replaces the page content (undo with ⌘Z). Use it to move pages between sites.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} />
        </Group>
      </div>
    </div>
  );
}
