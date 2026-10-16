'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export type Device = 'desktop' | 'tablet' | 'mobile';
const WIDTHS: Record<Device, number> = { desktop: 1440, tablet: 834, mobile: 390 };

const MSG = { ready: 'hp:ready', update: 'hp:update', select: 'hp:select', pick: 'hp:pick' };

/**
 * The real homepage in an iframe (`/?preview=1`), fed the unsaved draft over
 * postMessage and scaled down to fit the panel at the chosen device width.
 */
export default function Preview({ draft, device, selectedId, onPick, focusSlide }: {
  draft: { homepage: any; navbar: any; footer: any };
  device: Device;
  selectedId: string | null;
  onPick: (id: string) => void;
  /** A hero slide opened in the editor; the preview shows and holds it. */
  focusSlide?: { index: number; n: number } | null;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const post = (msg: any) => frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === MSG.ready) {
        setReady(true);
        post({ type: MSG.update, ...draftRef.current });
      } else if (e.data?.type === MSG.pick && e.data.id) {
        onPickRef.current(e.data.id);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Push draft edits, lightly debounced so typing stays smooth.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => post({ type: MSG.update, ...draft }), 120);
    return () => clearTimeout(t);
  }, [draft, ready]);

  useEffect(() => {
    if (ready) post({ type: MSG.select, id: selectedId });
  }, [selectedId, ready]);

  useEffect(() => {
    if (ready && focusSlide) post({ type: 'hp:slide', index: focusSlide.index });
  }, [focusSlide, ready]);

  const width = WIDTHS[device];
  const scale = box.w ? Math.min(1, (box.w - (device === 'desktop' ? 0 : 48)) / width) : 1;
  const frameH = box.h ? box.h / scale : 900;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden flex justify-center bg-[#e9ebe8]">
      <div className={`relative shrink-0 origin-top ${device === 'desktop' ? '' : 'mt-0'}`}
        style={{ width, height: frameH, transform: `scale(${scale})` }}>
        <iframe
          ref={frameRef}
          src="/?preview=1"
          title="Homepage preview"
          className={`w-full h-full bg-white ${device === 'desktop' ? '' : 'shadow-2xl ring-1 ring-black/10'}`}
        />
      </div>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-[#e9ebe8]/70 pointer-events-none">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading preview…</div>
        </div>
      )}
    </div>
  );
}
