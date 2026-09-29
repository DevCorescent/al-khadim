'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Mail } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  /** Main text; may include simple markup such as <strong>. */
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive actions (red), `primary` otherwise. */
  tone?: 'primary' | 'danger';
  icon?: React.ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app replacement for window.confirm(): branded, keyboard-friendly, covers the whole screen. */
export default function ConfirmDialog({
  open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', icon, busy, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const danger = tone === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-500'}`}>
            {icon || (danger ? <AlertTriangle size={18} /> : <Mail size={18} />)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-title" className="text-base font-bold text-gray-900">{title}</h3>
            <div className="text-sm text-gray-600 mt-1.5 leading-relaxed">{children}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} autoFocus
            className={`px-4 py-2 text-sm font-bold text-white rounded-xl flex items-center gap-2 disabled:opacity-60 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-400 hover:bg-primary-500'}`}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
