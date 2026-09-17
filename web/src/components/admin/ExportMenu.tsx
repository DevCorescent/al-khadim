'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import toast from 'react-hot-toast';
import { runExport, ExportColumn, ExportFormat } from '@/lib/tableExport';

interface ExportMenuProps {
  columns: ExportColumn[];
  data: any[];
  filename: string;
  title?: string;
  /** Disable when there's nothing loaded yet, e.g. still fetching. */
  disabled?: boolean;
}

const OPTIONS: { format: ExportFormat; label: string; icon: any }[] = [
  { format: 'csv', label: 'CSV', icon: FileText },
  { format: 'xlsx', label: 'Excel (XLSX)', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', icon: FileType },
];

export default function ExportMenu({ columns, data, filename, title, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handle(format: ExportFormat) {
    setOpen(false);
    if (!data.length) return toast.error('Nothing to export yet');
    const ok = runExport(format, columns, data, filename, title);
    if (ok) toast.success(`Exported ${data.length} row${data.length !== 1 ? 's' : ''} as ${format.toUpperCase()}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Export"
        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download size={14} className="text-gray-600" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-30">
          {OPTIONS.map(({ format, label, icon: Icon }) => (
            <button
              key={format}
              type="button"
              onClick={() => handle(format)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon size={13} className="text-gray-400" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
