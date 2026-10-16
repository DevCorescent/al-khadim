'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Shows an email at its real width (so it never reflows into a squeezed
 * layout) and scales it down to fit the available space. `onDocument` is
 * called with the iframe's document after every load, e.g. to add click
 * handlers.
 */
export default function ScaledEmailFrame({ srcDoc, width, rounded = false, onDocument, refreshKey, title = 'Email preview' }: {
  srcDoc: string;
  width: number;
  rounded?: boolean;
  onDocument?: (doc: Document) => void;
  /** Re-run onDocument when this changes (without reloading the frame). */
  refreshKey?: unknown;
  title?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [boxW, setBoxW] = useState(0);
  const [height, setHeight] = useState(800);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    onDocument?.(doc);
    setHeight(Math.max(400, doc.documentElement.scrollHeight));
  }, [onDocument]);

  useEffect(() => { measure(); }, [measure, refreshKey]);

  const scale = boxW ? Math.min(1, boxW / width) : 1;
  return (
    <div ref={boxRef} className="w-full">
      <div className="relative mx-auto overflow-hidden" style={{ width: width * scale, height: height * scale }}>
        <iframe
          ref={frameRef}
          title={title}
          srcDoc={srcDoc}
          onLoad={() => { measure(); setTimeout(measure, 300); }}
          className={`absolute top-0 left-0 border-0 bg-white origin-top-left ${rounded ? 'rounded-[28px] shadow-xl' : 'rounded-lg'}`}
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
