'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Download, CheckCircle2, XCircle, Clock, Users2, Trash2,
} from 'lucide-react';

const STATUS_STYLE: Record<string, { label: string; color: string; icon: any }> = {
  REQUESTED: { label: 'Awaiting Upload', color: 'bg-amber-100 text-amber-700', icon: Clock },
  UPLOADED: { label: 'Uploaded — Review', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  VERIFIED: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function DocumentRequestsPanel({ candidateId, trackingId }: { candidateId: string; trackingId?: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['document-requests', candidateId],
    queryFn: () => api.get('/document-requests', { params: { candidateId } }).then((r) => r.data),
    enabled: !!candidateId,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/document-requests', { candidateId, trackingId, title, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-requests', candidateId] });
      toast.success('Document requested — candidate notified by email');
      setFormOpen(false); setTitle(''); setDescription('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to request document'),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, approved, rejectionReason }: { id: string; approved: boolean; rejectionReason?: string }) =>
      api.post(`/document-requests/${id}/verify`, { approved, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-requests', candidateId] });
      toast.success('Updated');
      setRejectingId(null); setRejectReason('');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, visibleToCompany }: { id: string; visibleToCompany: boolean }) =>
      api.patch(`/document-requests/${id}/visibility`, { visibleToCompany }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-requests', candidateId] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update visibility'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/document-requests/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-requests', candidateId] }); toast.success('Removed'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  function download(id: string, title: string) {
    api.get(`/document-requests/${id}/download`, { responseType: 'blob' }).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    }).catch(() => toast.error('Failed to download'));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Requested Documents</h3>
        <button onClick={() => setFormOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:underline">
          <Plus size={13} /> Request Document
        </button>
      </div>

      {formOpen && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2.5">
          <input className="input text-sm w-full" placeholder="Document title (e.g. BOSIET Certificate)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input text-sm w-full h-16 resize-none" placeholder="Instructions for the candidate (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50">{createMutation.isPending ? 'Sending…' : 'Send Request'}</button>
            <button onClick={() => setFormOpen(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (requests || []).length === 0 ? (
        <p className="text-xs text-gray-400">No documents requested yet</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const s = STATUS_STYLE[r.status];
            const Icon = s.icon;
            return (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                    {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                    {r.rejectionReason && <p className="text-xs text-red-500 mt-1">Rejected: {r.rejectionReason}</p>}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${s.color}`}>
                    <Icon size={10} /> {s.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {['UPLOADED', 'VERIFIED', 'REJECTED'].includes(r.status) && (
                    <button onClick={() => download(r.id, r.title)} className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">
                      <Download size={11} /> Download
                    </button>
                  )}
                  {r.status === 'UPLOADED' && (
                    <>
                      <button onClick={() => verifyMutation.mutate({ id: r.id, approved: true })} className="flex items-center gap-1 text-xs font-semibold text-white bg-emerald-500 rounded-lg px-2.5 py-1 hover:bg-emerald-600">
                        <CheckCircle2 size={11} /> Verify
                      </button>
                      <button onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)} className="flex items-center gap-1 text-xs font-semibold text-red-500 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50">
                        <XCircle size={11} /> Reject
                      </button>
                    </>
                  )}
                  {r.status === 'VERIFIED' && (
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer ml-auto">
                      <input type="checkbox" checked={r.visibleToCompany} onChange={(e) => visibilityMutation.mutate({ id: r.id, visibleToCompany: e.target.checked })} />
                      <Users2 size={12} /> Visible to Company
                    </label>
                  )}
                  <button onClick={() => { if (confirm('Remove this document request?')) deleteMutation.mutate(r.id); }} className="text-gray-300 hover:text-red-500 p-1 ml-auto">
                    <Trash2 size={12} />
                  </button>
                </div>
                {rejectingId === r.id && (
                  <div className="flex gap-2 mt-2">
                    <input className="input text-xs flex-1" placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    <button onClick={() => verifyMutation.mutate({ id: r.id, approved: false, rejectionReason: rejectReason })}
                      className="text-xs font-bold bg-red-500 text-white px-3 py-1.5 rounded-lg">Confirm Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
