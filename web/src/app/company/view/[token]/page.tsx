'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Lock, ClipboardList, FileText, Download } from 'lucide-react';
import ProfileShareView from '@/components/company/ProfileShareView';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';

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

  async function handleDocDownload(reqId: string, title: string) {
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/document-requests/${reqId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
    }
  }

  async function handleDownload(docId: string, title: string) {
    try {
      const res = await axios.get(`${API}/api/profile-shares/public/${token}/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
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
      <ProfileShareView data={data} mode="public" onDownload={handleDownload} />

      {docRequests && docRequests.length > 0 && (
        <div className="max-w-3xl mx-auto mt-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText size={13} /> Verified Documents
          </h3>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
            {docRequests.map((r: any) => (
              <button key={r.id} onClick={() => handleDocDownload(r.id, r.title)}
                className="w-full flex items-center justify-between gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition-colors text-left">
                <span className="text-sm font-semibold text-gray-700">{r.title}</span>
                <Download size={14} className="text-gray-400" />
              </button>
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
    </div>
  );
}
