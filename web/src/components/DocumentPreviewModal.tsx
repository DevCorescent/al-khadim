'use client';
/**
 * Full-screen preview for a document already fetched as a blob URL.
 *
 * PDFs render in an <iframe> (the browser's own viewer), images in an <img>.
 * The caller creates the object URL and is responsible for revoking it, since
 * it usually also caches the fetch.
 */
import { useEffect } from 'react';
import { Download, FileText, X } from 'lucide-react';

interface Props {
  title: string;
  /** Object URL from previewUrlFromResponse, or null while loading. */
  url: string | null;
  mimeType?: string | null;
  loading?: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export default function DocumentPreviewModal({
  title,
  url,
  mimeType,
  loading,
  onClose,
  onDownload,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the overlay from scrolling.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isImage = !!mimeType?.startsWith('image/');

  return (
    <div
      className="fixed inset-0 z-[100] bg-gray-900/70 backdrop-blur-sm flex flex-col p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex-1 min-h-0 w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-200 shrink-0">
          <FileText size={16} className="text-primary-500 shrink-0" />
          <h2 className="flex-1 text-sm font-bold text-gray-900 truncate">{title}</h2>
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary-600 border border-gray-200 hover:border-primary-300 rounded-full px-3 py-1.5 transition-colors"
            >
              <Download size={13} /> Download
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 bg-gray-100">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading document…</p>
            </div>
          )}

          {!loading && !url && (
            <div className="h-full flex items-center justify-center px-6">
              <p className="text-sm text-red-500 text-center">This document could not be loaded.</p>
            </div>
          )}

          {!loading && url && (
            isImage ? (
              <div className="h-full overflow-auto flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <iframe src={url} title={title} className="w-full h-full border-0" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
