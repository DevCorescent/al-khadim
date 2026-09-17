'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Code2, LayoutTemplate, Monitor } from 'lucide-react';

/** Unlayer's drag-and-drop chrome (block library, layers, toolbar) needs real
 * estate to lay out properly — below this it collapses its own panels into a
 * cramped icon-only rail that's unusable. Below it we default to (and steer
 * people toward) the HTML source view instead, which is just a textarea and
 * scales to any width. */
const VISUAL_BUILDER_MIN_WIDTH = 768;

// react-email-editor renders an iframe and touches `window` at import time,
// which crashes Next.js App Router's server render — must be loaded client-only.
const UnlayerEditor = dynamic(() => import('react-email-editor'), { ssr: false });

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
  /** Raw HTML the template/campaign currently has. Templates migrated from the
   * old hardcoded-email system have real production HTML but no Unlayer
   * `design` JSON (it's plain HTML, not block-based) — the visual canvas has
   * nothing to load in that case, so we must not silently treat "empty canvas"
   * as "the new content" and overwrite that HTML on save. */
  initialHtml?: string;
  mergeTags?: Record<string, MergeTagDef>;
  onReady?: () => void;
}

/**
 * Wraps the dynamically-imported Unlayer editor. We deliberately don't pass a
 * `ref` into the dynamic-imported component itself — Next's `dynamic()` wrapper
 * is a plain function component and drops refs. Instead we capture the live
 * Unlayer editor instance via the `onReady` callback (react-email-editor v2
 * hands it to you directly) and expose our own imperative handle from that.
 *
 * Also offers an "HTML source" mode alongside the visual builder: when there's
 * existing HTML but no `design` JSON to load into the canvas (e.g. any of the
 * 16 migrated transactional templates), we default to showing that raw HTML in
 * an editable textarea instead of a deceptively-empty visual canvas, so saving
 * without touching anything preserves the real content instead of blanking it.
 */
const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorComponentProps>(function EmailEditor(
  { initialDesign, initialHtml, mergeTags, onReady },
  ref
) {
  const unlayerRef = useRef<any>(null);
  const [mode, setMode] = useState<'visual' | 'html'>(initialDesign ? 'visual' : (initialHtml ? 'html' : 'visual'));
  const [htmlSource, setHtmlSource] = useState(initialHtml || '');
  // Unknown until measured client-side, so the narrow-screen nudge never
  // flashes/mismatches during hydration — starts permissive (wide) and
  // corrects itself immediately on mount.
  const [isNarrow, setIsNarrow] = useState(false);
  // react-email-editor's `minHeight` prop must be a concrete pixel string —
  // a percentage confuses its internal sizing and it collapses to a ~150px
  // default. Keep this in lockstep with the outer container's responsive
  // Tailwind height classes below (420 / 560 / 700).
  const [editorHeightPx, setEditorHeightPx] = useState(700);
  const autoSwitched = useRef(false);

  useEffect(() => {
    function measure() {
      const width = window.innerWidth;
      const narrow = width < VISUAL_BUILDER_MIN_WIDTH;
      setIsNarrow(narrow);
      setEditorHeightPx(width >= 1024 ? 700 : width >= 640 ? 560 : 420);
      // Only auto-steer away from the visual builder once, on first measure,
      // and only when there's nothing at stake (no saved design to lose) —
      // never yank the editor out from under someone who's actively using it.
      if (narrow && !autoSwitched.current && !initialDesign) {
        setMode('html');
      }
      autoSwitched.current = true;
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    exportHtml: () => {
      if (mode === 'html') {
        // No design JSON was ever produced for this content — keep it that way
        // rather than saving a design that doesn't match the HTML actually sent.
        return Promise.resolve({ design: initialDesign ?? null, html: htmlSource });
      }
      return new Promise((resolve, reject) => {
        if (!unlayerRef.current) {
          reject(new Error('Editor is not ready yet'));
          return;
        }
        unlayerRef.current.exportHtml((data: any) => {
          resolve({ design: data.design, html: data.html });
        });
      });
    },
  }), [mode, htmlSource, initialDesign]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden w-full">
      <div className="flex flex-wrap items-center gap-2 justify-between bg-gray-50 border-b border-gray-200 px-3 py-2">
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => setMode('visual')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
              mode === 'visual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <LayoutTemplate size={13} /> <span className="hidden sm:inline">Visual Builder</span><span className="sm:hidden">Visual</span>
          </button>
          <button type="button" onClick={() => setMode('html')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
              mode === 'html' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <Code2 size={13} /> <span className="hidden sm:inline">HTML Source</span><span className="sm:hidden">HTML</span>
          </button>
        </div>
        {mode === 'visual' && !initialDesign && (
          <p className="text-[11px] text-amber-600 font-medium leading-snug">
            No visual design saved yet — this canvas starts blank. Switch to HTML Source to see the current content.
          </p>
        )}
        {mode === 'visual' && isNarrow && (
          <p className="flex items-center gap-1 text-[11px] text-gray-400 font-medium leading-snug">
            <Monitor size={11} /> Drag-and-drop works best on a wider screen.
          </p>
        )}
      </div>

      {mode === 'html' ? (
        <textarea
          value={htmlSource}
          onChange={(e) => setHtmlSource(e.target.value)}
          spellCheck={false}
          className="w-full font-mono text-xs p-4 outline-none resize-none h-[380px] sm:h-[520px] lg:h-[700px]"
          placeholder="<p>Email HTML — supports {{mergeTags}}</p>"
        />
      ) : (
        <div className="h-[420px] sm:h-[560px] lg:h-[700px]">
          {/* No `style={{height:'100%'}}` here on purpose: react-email-editor's
             own outer wrapper only sets `min-height` (from our `minHeight` prop
             below), never `height`. A percentage height on the inner div can't
             resolve against a non-explicit-height ancestor, so the browser falls
             back to the iframe's ~150px intrinsic default instead of filling the
             space. Leaving `style` unset lets the library's own `flex:1` +
             default flex stretch fill the container correctly instead. */}
          <UnlayerEditor
            minHeight={`${editorHeightPx}px`}
            options={{ mergeTags: mergeTags as any, displayMode: 'email' }}
            onReady={(unlayer: any) => {
              unlayerRef.current = unlayer;
              if (initialDesign) {
                try {
                  unlayer.loadDesign(initialDesign);
                } catch {
                  /* ignore malformed/stale saved design */
                }
              }
              onReady?.();
            }}
          />
        </div>
      )}
    </div>
  );
});

export default EmailEditor;
