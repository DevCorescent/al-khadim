'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading2, Heading3, Highlighter, Italic, Link2, List, ListOrdered,
  Pilcrow, Quote, RemoveFormatting, Strikethrough, Underline, Unlink,
} from 'lucide-react';

const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg);

/**
 * Small WYSIWYG editor (contentEditable) with an HTML source view. Output is
 * sanitised by the API on save, so this only needs to produce sensible markup.
 */
export default function RichText({ value, onChange, minHeight = 140 }: { value: string; onChange: (html: string) => void; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const last = useRef(value);

  // Only overwrite the DOM when the value changed from outside (keeps the caret).
  useEffect(() => {
    const el = ref.current;
    if (!el || source) return;
    if (value !== last.current || el.innerHTML !== value) {
      if (document.activeElement !== el) el.innerHTML = value || '';
      last.current = value;
    }
  }, [value, source]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? '';
    last.current = html;
    onChange(html === '<br>' ? '' : html);
  };
  const run = (cmd: string, arg?: string) => { ref.current?.focus(); exec('styleWithCSS', 'false'); exec(cmd, arg); emit(); };

  const btn = (title: string, icon: React.ReactNode, onClick: () => void) => (
    <button key={title} type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="grid place-items-center w-7 h-7 rounded text-gray-600 hover:bg-gray-200/70 hover:text-gray-900">{icon}</button>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-600/20 focus-within:border-teal-600">
      <div className="flex flex-wrap items-center gap-0.5 px-1 py-1 border-b border-gray-100 bg-gray-50">
        {!source && <>
          {btn('Bold (⌘B)', <Bold size={13} />, () => run('bold'))}
          {btn('Italic (⌘I)', <Italic size={13} />, () => run('italic'))}
          {btn('Underline', <Underline size={13} />, () => run('underline'))}
          {btn('Strikethrough', <Strikethrough size={13} />, () => run('strikeThrough'))}
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          {btn('Paragraph', <Pilcrow size={13} />, () => run('formatBlock', 'p'))}
          {btn('Heading', <Heading2 size={13} />, () => run('formatBlock', 'h3'))}
          {btn('Sub-heading', <Heading3 size={13} />, () => run('formatBlock', 'h4'))}
          {btn('Quote', <Quote size={13} />, () => run('formatBlock', 'blockquote'))}
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          {btn('Bullet list', <List size={13} />, () => run('insertUnorderedList'))}
          {btn('Numbered list', <ListOrdered size={13} />, () => run('insertOrderedList'))}
          {btn('Align left', <AlignLeft size={13} />, () => run('justifyLeft'))}
          {btn('Centre', <AlignCenter size={13} />, () => run('justifyCenter'))}
          {btn('Align right', <AlignRight size={13} />, () => run('justifyRight'))}
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          {btn('Link', <Link2 size={13} />, () => {
            const url = window.prompt('Link URL (https://…, /page, mailto:, tel:)');
            if (url) run('createLink', url);
          })}
          {btn('Remove link', <Unlink size={13} />, () => run('unlink'))}
          {btn('Highlight', <Highlighter size={13} />, () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            const text = sel.toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
            run('insertHTML', `<mark>${text}</mark>`);
          })}
          <label title="Text colour" className="relative grid place-items-center w-7 h-7 rounded hover:bg-gray-200/70 cursor-pointer" onMouseDown={e => e.preventDefault()}>
            <span className="text-[13px] font-bold text-gray-700 underline decoration-2 decoration-teal-600">A</span>
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { ref.current?.focus(); exec('styleWithCSS', 'true'); exec('foreColor', e.target.value); emit(); }} />
          </label>
          {btn('Clear formatting', <RemoveFormatting size={13} />, () => { run('removeFormat'); run('formatBlock', 'p'); })}
        </>}
        <button type="button" onClick={() => { if (source) last.current = ''; setSource(s => !s); }}
          className={`ml-auto flex items-center gap-1 h-7 px-2 rounded text-[11px] font-semibold ${source ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-200/70'}`}>
          <Code2 size={12} /> HTML
        </button>
      </div>
      {source ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
          className="w-full font-mono text-[11.5px] p-3 outline-none resize-y" style={{ minHeight }} />
      ) : (
        <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
          className="pb-rt px-3 py-2.5 text-[13px] leading-relaxed text-gray-800 outline-none overflow-auto max-h-[420px] [&_a]:text-teal-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:text-[15px] [&_h3]:font-bold [&_h4]:font-bold [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_p]:my-1.5 [&_mark]:bg-amber-200"
          style={{ minHeight }}
          onPaste={e => {
            // Keep basic structure but drop foreign styling from Word/Docs.
            const html = e.clipboardData.getData('text/html');
            if (!html) return;
            e.preventDefault();
            const clean = html
              .replace(/<!--[\s\S]*?-->/g, '')
              .replace(/<(script|style|meta|link|xml)[\s\S]*?(<\/\1>|\/?>)/gi, '')
              .replace(/\s(style|class|id|lang|dir|width|height|align|face|size|color)="[^"]*"/gi, '')
              .replace(/<\/?(font|span|o:p|div)[^>]*>/gi, '');
            exec('insertHTML', clean);
            emit();
          }} />
      )}
    </div>
  );
}
