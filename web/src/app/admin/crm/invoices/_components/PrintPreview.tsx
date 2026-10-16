'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildPrintHTML, type PrintInvoice } from './printEngine';

const A4_WIDTH = 794;   // px at 96 dpi
const A4_HEIGHT = 1123;

/**
 * The real print output (the same HTML the Print button produces) rendered in
 * an iframe and scaled to the available width, so the preview is exactly what
 * prints.
 */
export default function PrintPreview({ invoice, className = '' }: { invoice: PrintInvoice; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(A4_HEIGHT);

  // Debounced so typing in the form doesn't rebuild the document on every key.
  const [html, setHtml] = useState('');
  const next = useMemo(() => buildPrintHTML(invoice), [invoice]);
  useEffect(() => {
    const t = setTimeout(() => setHtml(next), html ? 150 : 0);
    return () => clearTimeout(t);
  }, [next]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Grow with the document (long item lists run onto a second page).
  const measure = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(A4_HEIGHT, doc.documentElement.scrollHeight));
  };

  const scale = width ? width / A4_WIDTH : 0.5;
  return (
    <div ref={boxRef} className={`w-full ${className}`}>
      <div className="relative overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5" style={{ height: height * scale }}>
        <iframe
          ref={frameRef}
          title="Invoice preview"
          srcDoc={html}
          onLoad={() => { measure(); setTimeout(measure, 400); }}
          className="absolute top-0 left-0 border-0 origin-top-left pointer-events-none"
          style={{ width: A4_WIDTH, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
