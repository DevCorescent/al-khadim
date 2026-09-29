'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import toast from 'react-hot-toast';
import { FileText, Upload, Download, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, FolderOpen } from 'lucide-react';
import { saveResponseAsFile } from '@/lib/fileDownload';

interface DocRequest {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: 'REQUESTED' | 'UPLOADED' | 'APPROVED' | 'REJECTED';
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Status as the company sees it; an unanswered request past its due date is Overdue. */
function displayStatus(d: DocRequest) {
  const overdue = !!d.dueDate && new Date(d.dueDate) < new Date() && (d.status === 'REQUESTED' || d.status === 'REJECTED');
  if (overdue) return { key: 'OVERDUE', label: 'Overdue', cls: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle };
  switch (d.status) {
    case 'UPLOADED': return { key: d.status, label: 'Under review', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock };
    case 'APPROVED': return { key: d.status, label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
    case 'REJECTED': return { key: d.status, label: 'Re-upload needed', cls: 'bg-red-50 text-red-600 border-red-200', icon: XCircle };
    default:         return { key: d.status, label: 'To upload', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Upload };
  }
}

export default function CompanyDocumentsPage() {
  const { accessToken } = useClientAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');

  const { data = [], isLoading } = useQuery<DocRequest[]>({
    queryKey: ['company-documents'],
    queryFn: () => clientApi(accessToken!).get('/api/client-auth/documents').then(r => r.data),
    enabled: !!accessToken,
  });

  function pick(id: string) {
    setTarget(id);
    fileInput.current?.click();
  }

  async function upload(file: File) {
    if (!target) return;
    const id = target;
    setUploading(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await clientApi(accessToken!).post(`/api/client-auth/documents/${id}/upload`, fd);
      toast.success('Uploaded. Al Khadim will review it shortly.');
      qc.invalidateQueries({ queryKey: ['company-documents'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(null);
      setTarget(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function download(d: DocRequest) {
    try {
      const res = await clientApi(accessToken!).get(`/api/client-auth/documents/${d.id}/download`, { responseType: 'blob' });
      saveResponseAsFile(res, d.title);
    } catch {
      toast.error('Download failed');
    }
  }

  const withStatus = data.map(d => ({ d, s: displayStatus(d) }));
  const count = (k: string) => withStatus.filter(x => x.s.key === k).length;
  const tiles = [
    { key: 'ALL', label: 'All documents', value: data.length, cls: 'text-gray-800' },
    { key: 'REQUESTED', label: 'To upload', value: count('REQUESTED') + count('REJECTED') + count('OVERDUE'), cls: 'text-amber-600' },
    { key: 'UPLOADED', label: 'Under review', value: count('UPLOADED'), cls: 'text-blue-600' },
    { key: 'APPROVED', label: 'Approved', value: count('APPROVED'), cls: 'text-emerald-600' },
  ];
  const shown = withStatus.filter(({ s }) =>
    filter === 'ALL' || (filter === 'REQUESTED' ? ['REQUESTED', 'REJECTED', 'OVERDUE'].includes(s.key) : s.key === filter));

  return (
    <div className="p-4 sm:p-6 w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Documents Al Khadim has requested from your company, and where each one stands</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`bg-white border rounded-2xl p-4 text-left transition-all ${filter === t.key ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300'}`}>
            <p className={`text-2xl font-bold ${t.cls}`}>{t.value}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">{t.label}</p>
          </button>
        ))}
      </div>

      <input ref={fileInput} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
      ) : !shown.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <FolderOpen size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">{data.length ? 'No documents in this view' : 'No documents requested yet'}</p>
          <p className="text-xs text-gray-400 mt-1">When Al Khadim needs a document from you, it will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {shown.map(({ d, s }) => {
            const canUpload = d.status !== 'APPROVED';
            const Icon = s.icon;
            return (
              <div key={d.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-primary-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">{d.title}</p>
                    {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      Requested {fmt(d.createdAt)}
                      {d.dueDate && <> · Due {fmt(d.dueDate)}</>}
                      {d.uploadedAt && <> · Uploaded {fmt(d.uploadedAt)}{d.uploadedByName && <> by {d.uploadedByName}</>}</>}
                    </p>
                    {d.status === 'REJECTED' && d.reviewNote && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mt-2"><strong>Al Khadim:</strong> {d.reviewNote}</p>
                    )}
                    {d.status === 'APPROVED' && d.reviewNote && (
                      <p className="text-xs text-emerald-700 mt-1.5"><strong>Al Khadim:</strong> {d.reviewNote}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.cls}`}>
                    <Icon size={11} /> {s.label}
                  </span>
                  {d.fileName && (
                    <button onClick={() => download(d)}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold px-3 py-2 rounded-xl">
                      <Download size={13} /> Download
                    </button>
                  )}
                  {canUpload && (
                    <button onClick={() => pick(d.id)} disabled={uploading === d.id}
                      className="flex items-center gap-1.5 bg-primary-400 hover:bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-60">
                      {uploading === d.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {d.status === 'REQUESTED' ? 'Upload' : d.status === 'UPLOADED' ? 'Replace' : 'Re-upload'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
