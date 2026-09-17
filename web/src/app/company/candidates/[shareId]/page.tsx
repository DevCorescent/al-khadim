'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardList, FileText, Download } from 'lucide-react';
import ProfileShareView from '@/components/company/ProfileShareView';
import IndustryTrackingTabs from '@/components/IndustryTrackingTabs';

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

  async function handleDocDownload(reqId: string, title: string) {
    try {
      const res = await clientApi(accessToken!).get(`/api/profile-shares/mine/${shareId}/document-requests/${reqId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
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
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
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
