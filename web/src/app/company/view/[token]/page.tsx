'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Lock, ClipboardList, FileText, Download, Eye } from 'lucide-react';
import ProfileShareView from '@/components/company/ProfileShareView';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import { isViewableMime, mimeFromResponse, previewUrlFromResponse, saveResponseAsFile } from '@/lib/fileDownload';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function PublicShareViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [tracking, setTracking] = useState<any[]>([]);
  const [docRequests, setDocRequests] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/profile-shares/public/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
    axios.get(`${API}/api/profile-shares/public/${token}/tracking`)
      .then(r => setTracking(r.data))
      .catch(() => {});
    axios.get(`${API}/api/profile-shares/public/${token}/document-requests`)
      .then(r => setDocRequests(r.data))
      .catch(() => {});
  }, [token]);

  const [preview, setPreview] = useState<{ title: string; url: string | null; mimeType?: string | null; loading: boolean; download: () => void } | null>(null);

  function closePreview() {
    setPreview(p => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
  }

  async function handleDocDownload(reqId: string, title: string) {
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/document-requests/${reqId}/download`, { responseType: 'blob' });
      saveResponseAsFile(res, title);
    } catch {
      toast.error('Failed to download document');
    }
  }

  async function handleDocView(reqId: string, title: string) {
    setPreview({ title, url: null, loading: true, download: () => handleDocDownload(reqId, title) });
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/document-requests/${reqId}/download?inline=1`, { responseType: 'blob' });
      const mimeType = mimeFromResponse(res);
      if (!isViewableMime(mimeType)) {
        closePreview();
        saveResponseAsFile(res, title);
        return;
      }
      setPreview(p => (p ? { ...p, url: previewUrlFromResponse(res), mimeType, loading: false } : p));
    } catch {
      setPreview(p => (p ? { ...p, loading: false } : p));
      toast.error('Failed to open document');
    }
  }

  async function handleDownload(docId: string, title: string) {
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/documents/${docId}/download`, { responseType: 'blob' });
      // Name and type come from the response headers, so a CV saves as a .pdf.
      saveResponseAsFile(res, title);
    } catch {
      toast.error('Failed to download document');
    }
  }

  async function handleView(docId: string, title: string) {
    setPreview({ title, url: null, loading: true, download: () => handleDownload(docId, title) });
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/documents/${docId}/download?inline=1`, { responseType: 'blob' });
      const mimeType = mimeFromResponse(res);
      if (!isViewableMime(mimeType)) {
        closePreview();
        saveResponseAsFile(res, title);
        return;
      }
      setPreview(p => (p ? { ...p, url: previewUrlFromResponse(res), mimeType, loading: false } : p));
    } catch {
      setPreview(p => (p ? { ...p, loading: false } : p));
      toast.error('Failed to open document');
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <Lock size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-900 mb-2">Link unavailable</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto mb-5 flex items-center gap-2">
        <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">A</span>
        </div>
        <span className="font-bold text-gray-900 text-sm">Al Khadim</span>
        <span className="text-xs text-gray-400 ml-2">Shared candidate profile</span>
      </div>
      <ProfileShareView data={data} mode="public" onDownload={handleDownload}
        onView={handleView} />

      {docRequests && docRequests.length > 0 && (
        <div className="max-w-3xl mx-auto mt-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText size={13} /> Verified Documents
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
            {docRequests.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                <FileText size={14} className="text-primary-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 truncate">{r.title}</span>
                <button
                  onClick={() => handleDocView(r.id, r.title)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-white hover:bg-primary-400 border border-primary-200 hover:border-primary-400 rounded-full px-3 py-1.5 transition-colors shrink-0"
                >
                  <Eye size={13} /> View
                </button>
                <button
                  onClick={() => handleDocDownload(r.id, r.title)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-full px-3 py-1.5 transition-colors shrink-0"
                >
                  <Download size={13} /> <span className="hidden sm:inline">Download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tracking && tracking.length > 0 && (
        <div className="max-w-3xl mx-auto mt-5 space-y-4">
          {tracking.map((t: any) => (
            <div key={t.id}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ClipboardList size={13} /> {t.industry.name} Tracking
              </h3>
              <IndustryTrackingTabs industry={t.industry.key} data={t.data} mode="view" />
            </div>
          ))}
        </div>
      )}
    
      {preview && (
        <DocumentPreviewModal
          title={preview.title}
          url={preview.url}
          mimeType={preview.mimeType}
          loading={preview.loading}
          onClose={closePreview}
          onDownload={preview.download}
        />
      )}
    </div>
  );
}
