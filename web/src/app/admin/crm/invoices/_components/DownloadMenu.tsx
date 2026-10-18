'use client';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Code2, Download, FileImage, FileSpreadsheet, FileText, FileType2, Loader2 } from 'lucide-react';
import type { PrintInvoice } from './printEngine';
import type { ExportFormat } from './exportInvoice';

const OPTIONS: { id: ExportFormat; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'pdf',  label: 'PDF document',       hint: 'Exactly as printed · .pdf',      icon: <FileText size={15} className="text-red-500" /> },
  { id: 'docx', label: 'Word document',      hint: 'Editable in Word / Docs · .docx', icon: <FileType2 size={15} className="text-blue-600" /> },
  { id: 'xlsx', label: 'Excel spreadsheet',  hint: 'Line items & totals · .xlsx',    icon: <FileSpreadsheet size={15} className="text-emerald-600" /> },
  { id: 'png',  label: 'Image',              hint: 'High-resolution · .png',         icon: <FileImage size={15} className="text-violet-600" /> },
  { id: 'html', label: 'Web page',           hint: 'Printable HTML · .html',         icon: <Code2 size={15} className="text-gray-600" /> },
];

/** "Download" button with a format menu; `getInvoice` returns the print-engine input. */
export default function DownloadMenu({ getInvoice, className = '', compact = false }: { getInvoice: () => PrintInvoice | null; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function run(fmt: ExportFormat) {
    const inv = getInvoice();
    if (!inv) return;
    setBusy(fmt);
    setOpen(false);
    try {
      const { exportInvoice } = await import('./exportInvoice');
      await exportInvoice(inv, fmt);
    } catch (e) {
      console.error('[invoice export]', e);
      toast.error('Could not create the file — please try again');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={!!busy} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-70">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        {busy ? `Preparing ${busy.toUpperCase()}…` : compact ? '' : 'Download'}
        {!busy && <ChevronDown size={12} className={`transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white shadow-xl ring-1 ring-black/5 border border-gray-100 py-1.5 z-30">
          {OPTIONS.map(o => (
            <button key={o.id} type="button" role="menuitem" onClick={() => run(o.id)}
              className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-gray-50">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-gray-50 border border-gray-100">{o.icon}</span>
              <span>
                <span className="block text-[13px] font-semibold text-gray-800">{o.label}</span>
                <span className="block text-[11px] text-gray-400">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
