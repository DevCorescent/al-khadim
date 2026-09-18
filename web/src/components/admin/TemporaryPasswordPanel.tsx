'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, Copy, Check, X } from 'lucide-react';

export interface TemporaryPasswordInfo {
  password: string;
  /** Who the password belongs to, e.g. "Jane Doe (jane@example.com)". */
  who?: string;
  /** Extra context, e.g. that the candidate email could not be sent. */
  note?: string;
}

/**
 * Staff-facing, dismissible panel that shows a candidate portal temporary password returned by the
 * API, with a copy button. It stays until staff close it so the password isn't lost.
 */
export default function TemporaryPasswordPanel({ info, onClose }: { info: TemporaryPasswordInfo | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!info) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the password and copy it manually.');
    }
  }

  return (
    <div role="alertdialog" aria-label="Temporary password"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] z-[60] bg-white border border-amber-200 rounded-2xl shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <KeyRound size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Candidate portal temporary password</p>
          {info.who && <p className="text-xs text-gray-500 mt-0.5 truncate">{info.who}</p>}
          {info.note && <p className="text-xs text-amber-700 mt-1">{info.note}</p>}
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-gray-800 select-all">
              {info.password}
            </code>
            <button onClick={copy}
              className="flex items-center gap-1 text-xs font-bold text-primary-600 border border-primary-200 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Share this with the candidate. It won&apos;t be shown again once you close this.</p>
        </div>
        <button onClick={onClose} title="Dismiss"
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
