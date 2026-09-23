'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import toast from 'react-hot-toast';
import { FileText, Upload, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';
import { saveResponseAsFile } from '@/lib/fileDownload';

const STATUS_STYLE: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: { label: 'Upload needed', color: 'bg-amber-100 text-amber-700', icon: Clock },
  UPLOADED: { label: 'Under review', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  VERIFIED: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  REJECTED: { label: 'Re-upload needed', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function CandidateDocumentRequests() {
  const { accessToken } = useCandidateAuth();
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ['candidate-document-requests'],
    queryFn: () => candidateApi(accessToken!).get('/api/candidate-auth/me/document-requests').then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 0,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return candidateApi(accessToken!).post(`/api/candidate-auth/me/document-requests/${id}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onMutate: ({ id }) => setUploadingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate-document-requests'] });
      toast.success('Document uploaded — Al Khadim will review it');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Upload failed'),
    onSettled: () => setUploadingId(null),
  });

  function download(id: string, title: string) {
    candidateApi(accessToken!).get(`/api/candidate-auth/me/document-requests/${id}/download`, { responseType: 'blob' })
      .then((res) => saveResponseAsFile(res, title))
      .catch(() => toast.error('Download failed'));
  }

  if (isLoading || !requests || requests.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3">
        <FileText size={14} className="text-primary-400" /> Documents Requested
      </h2>
      <div className="space-y-2">
        {requests.map((r: any) => {
          const s = STATUS_STYLE[r.status];
          const Icon = s.icon;
          const canUpload = r.status === 'REQUESTED' || r.status === 'REJECTED';
          return (
            <div key={r.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                  {r.rejectionReason && <p className="text-xs text-red-500 mt-1">Al Khadim's note: {r.rejectionReason}</p>}
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${s.color}`}>
                  <Icon size={10} /> {s.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {canUpload && (
                  <>
                    <button
                      onClick={() => fileInputs.current[r.id]?.click()}
                      disabled={uploadingId === r.id}
                      className="flex items-center gap-1.5 text-xs font-bold bg-primary-400 text-white px-3 py-1.5 rounded-lg hover:bg-primary-500 disabled:opacity-50"
                    >
                      <Upload size={12} /> {uploadingId === r.id ? 'Uploading…' : canUpload && r.status === 'REJECTED' ? 'Re-upload' : 'Upload'}
                    </button>
                    <input
                      ref={(el) => { fileInputs.current[r.id] = el; }}
                      type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate({ id: r.id, file: f }); e.target.value = ''; }}
                    />
                  </>
                )}
                {['UPLOADED', 'VERIFIED'].includes(r.status) && (
                  <button onClick={() => download(r.id, r.title)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    <Download size={12} /> View my upload
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
