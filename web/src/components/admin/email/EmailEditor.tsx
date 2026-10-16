'use client';
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Code2, LayoutTemplate, Loader2, Wand2 } from 'lucide-react';
import api from '@/lib/api';
import EmailBuilder, { type BuilderTag } from './builder/EmailBuilder';
import { emptyDesign, isBuilderDesign, newEmailBlock, normalizeDesign, type EmailDesign } from '@/lib/email/blocks';
import { isFullHtmlDocument, renderEmail } from '@/lib/email/render';
import { DEFAULT_EMAIL_THEME, normalizeEmailTheme } from '@/lib/email/theme';

export interface EmailEditorHandle {
  exportHtml: () => Promise<{ design: any; html: string }>;
}

export interface MergeTagDef {
  name: string;
  value: string;
  sample?: string;
}

interface EmailEditorComponentProps {
  initialDesign?: object | null;
  /** HTML the template/campaign currently has (used when there is no builder design yet). */
  initialHtml?: string;
  mergeTags?: Record<string, MergeTagDef>;
  /** Extra tags, e.g. a template's saved merge tags with sample values. */
  tags?: BuilderTag[];
  subject?: string;
  onReady?: () => void;
}

/**
 * Email body editor: the drag-and-drop block builder (rendered in the brand
 * email theme), plus an HTML source mode for hand-written or legacy content.
 *
 * Content without a builder design opens as follows: a bare HTML fragment is
 * placed in a Custom HTML block so it gets the branded frame; a complete HTML
 * document (from the previous editor) opens in source mode, with a one-click
 * way to rebuild it visually.
 */
const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorComponentProps>(function EmailEditor(
  { initialDesign, initialHtml, mergeTags, tags: extraTags, subject }, ref,
) {
  const { data: themeData, isLoading } = useQuery({
    queryKey: ['email-theme'],
    queryFn: () => api.get('/emails/theme').then(r => r.data as { theme: any; assetBase: string }),
    staleTime: 60_000,
  });
  const theme = normalizeEmailTheme(themeData?.theme || DEFAULT_EMAIL_THEME);
  const assetBase = themeData?.assetBase || (typeof window !== 'undefined' ? window.location.origin : '');

  const legacyDoc = !isBuilderDesign(initialDesign) && !!initialHtml && isFullHtmlDocument(initialHtml);
  const [mode, setMode] = useState<'visual' | 'html'>(legacyDoc ? 'html' : 'visual');
  const [design, setDesign] = useState<EmailDesign>(() => {
    if (isBuilderDesign(initialDesign)) return normalizeDesign(initialDesign);
    if (initialHtml && !legacyDoc) {
      const d = emptyDesign();
      return { ...d, blocks: [newEmailBlock('html', { html: initialHtml })] };
    }
    return emptyDesign();
  });
  const [htmlSource, setHtmlSource] = useState(initialHtml || '');

  const tags = useMemo<BuilderTag[]>(() => {
    const out = new Map<string, BuilderTag>();
    for (const t of extraTags || []) out.set(t.key, t);
    for (const [k, t] of Object.entries(mergeTags || {})) {
      const key = String(t.value || k).replace(/[{}]/g, '');
      if (!out.has(key)) out.set(key, { key, label: t.name, sample: t.sample });
    }
    return [...out.values()];
  }, [mergeTags, extraTags]);

  useImperativeHandle(ref, () => ({
    exportHtml: async () => {
      if (mode === 'html') return { design: isBuilderDesign(initialDesign) ? null : (initialDesign ?? null), html: htmlSource };
      return { design, html: renderEmail(design, theme, { assetBase, subject }) };
    },
  }), [mode, htmlSource, design, theme, assetBase, subject, initialDesign]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
        <div className="flex p-0.5 rounded-lg bg-gray-100">
          <button type="button" onClick={() => setMode('visual')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition ${mode === 'visual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <LayoutTemplate size={13} /> Visual builder
          </button>
          <button type="button" onClick={() => { if (mode === 'visual') setHtmlSource(renderEmail(design, theme, { assetBase, subject })); setMode('html'); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition ${mode === 'html' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Code2 size={13} /> HTML source
          </button>
        </div>
        {mode === 'html' && (
          <p className="text-[11px] text-amber-600 font-medium">
            Saving from HTML source keeps exactly this HTML (it stops following theme changes).{' '}
            <button type="button" className="underline font-semibold inline-flex items-center gap-1"
              onClick={() => { setDesign({ ...emptyDesign(), blocks: [newEmailBlock('html', { html: legacyDoc ? htmlSource.replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '') : htmlSource })] }); setMode('visual'); }}>
              <Wand2 size={11} /> Rebuild visually
            </button>
          </p>
        )}
      </div>

      {mode === 'html' ? (
        <textarea value={htmlSource} onChange={e => setHtmlSource(e.target.value)} spellCheck={false}
          className="w-full font-mono text-xs p-4 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-primary-400/30 resize-y h-[520px]"
          placeholder="<p>Email HTML — supports {{mergeTags}}</p>" />
      ) : isLoading ? (
        <div className="h-64 grid place-items-center text-sm text-gray-400"><span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading builder…</span></div>
      ) : (
        <EmailBuilder value={design} onChange={setDesign} theme={theme} assetBase={assetBase} tags={tags} subject={subject} />
      )}
    </div>
  );
});

export default EmailEditor;
