'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardList, FileText, Download, Eye } from 'lucide-react';
import ProfileShareView from '@/components/company/ProfileShareView';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import { isViewableMime, mimeFromResponse, previewUrlFromResponse, saveResponseAsFile } from '@/lib/fileDownload';

export default function CompanyShareDetailPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { accessToken } = useClientAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['company-share', shareId],
    queryFn: () => clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}`).then(r => r.data),
    enabled: !!accessToken && !!shareId,
    staleTime: 0,
  });

  const { data: tracking } = useQuery({
    queryKey: ['company-share-tracking', shareId],
    queryFn: () => clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/tracking`).then(r => r.data),
    enabled: !!accessToken && !!shareId,
    staleTime: 0,
  });

  const { data: docRequests } = useQuery({
    queryKey: ['company-share-documents', shareId],
    queryFn: () => clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/document-requests`).then(r => r.data),
    enabled: !!accessToken && !!shareId,
    staleTime: 0,
  });

  /** Preview overlay state; `url` is an object URL we own and must revoke. */
  const [preview, setPreview] = useState<{ title: string; url: string | null; mimeType?: string | null; loading: boolean; download: () => void } | null>(null);

  function closePreview() {
    setPreview(p => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
  }

  async function handleDocDownload(reqId: string, title: string) {
    try {
      const res = await clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/document-requests/${reqId}/download`, { responseType: 'blob' });
      saveResponseAsFile(res, title);
    } catch {
      toast.error('Failed to download document');
    }
  }

  async function handleDocView(reqId: string, title: string) {
    setPreview({ title, url: null, loading: true, download: () => handleDocDownload(reqId, title) });
    try {
      const res = await clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/document-requests/${reqId}/download?inline=1`, { responseType: 'blob' });
      const mimeType = mimeFromResponse(res);
      if (!isViewableMime(mimeType)) {
        // Not something the browser can render — fall back to downloading it.
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

  const respondMutation = useMutation({
    mutationFn: ({ action, reason, preferredAt, interviewerEmails }: { action: string; reason?: string; preferredAt?: string; interviewerEmails?: string }) =>
      clientApi(accessToken!).post(`/api/profile-shares/mine/${shareId}/respond`, { action, reason, preferredAt, interviewerEmails }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-share', shareId] });
      qc.invalidateQueries({ queryKey: ['company-shares'] });
      toast.success('Response recorded');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to submit response'),
  });

  async function handleDownload(docId: string, title: string) {
    try {
      const res = await clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/documents/${docId}/download`, { responseType: 'blob' });
      // Name and type come from the response headers, so a CV saves as a .pdf.
      saveResponseAsFile(res, title);
      qc.invalidateQueries({ queryKey: ['company-share', shareId] });
    } catch {
      toast.error('Failed to download document');
    }
  }

  async function handleView(docId: string, title: string) {
    setPreview({ title, url: null, loading: true, download: () => handleDownload(docId, title) });
    try {
      const res = await clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/documents/${docId}/download?inline=1`, { responseType: 'blob' });
      const mimeType = mimeFromResponse(res);
      if (!isViewableMime(mimeType)) {
        closePreview();
        saveResponseAsFile(res, title);
        return;
      }
      setPreview(p => (p ? { ...p, url: previewUrlFromResponse(res), mimeType, loading: false } : p));
      // A preview moves the share to VIEWED server-side.
      qc.invalidateQueries({ queryKey: ['company-share', shareId] });
    } catch {
      setPreview(p => (p ? { ...p, loading: false } : p));
      toast.error('Failed to open document');
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Profile not found</div>;

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => router.push('/company/candidates')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={14} /> Back to candidates
      </button>
      <ProfileShareView
        data={data}
        mode="portal"
        onDownload={handleDownload}
        onView={handleView}
        onRespond={async (action, reason, preferredAt, interviewerEmails) => {
          await respondMutation.mutateAsync({ action, reason, preferredAt, interviewerEmails });
        }}
        responding={respondMutation.isPending}
      />

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
