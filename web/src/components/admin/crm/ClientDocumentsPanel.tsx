'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FilePlus2, Download, CheckCircle2, XCircle, Trash2, FileText, Loader2, FolderOpen, ClipboardCheck } from 'lucide-react';
import { saveResponseAsFile } from '@/lib/fileDownload';

const STATUS: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: 'Requested',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  UPLOADED:  { label: 'Needs review',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED:  { label: 'Approved',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED:  { label: 'Rejected',      cls: 'bg-red-50 text-red-600 border-red-200' },
  OVERDUE:   { label: 'Overdue',       cls: 'bg-red-50 text-red-600 border-red-200' },
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });

function statusKey(d: any) {
  const open = d.status === 'REQUESTED' || d.status === 'REJECTED';
  return open && d.dueDate && new Date(d.dueDate) < new Date() ? 'OVERDUE' : d.status;
}

/** Super Admin: request documents from a company and review what it uploads. */
export default function ClientDocumentsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', dueDate: '' });
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['client-documents', clientId],
    queryFn: () => api.get('/client-documents', { params: { clientId } }).then(r => r.data),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['client-documents', clientId] });

  const create = useMutation({
    mutationFn: () => api.post('/client-documents', { clientId, ...form, dueDate: form.dueDate || undefined }),
    onSuccess: () => {
      toast.success('Request sent. The company has been emailed.');
      setForm({ title: '', description: '', dueDate: '' });
      setOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Could not create request'),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      api.post(`/client-documents/${id}/review`, { action, note: notes[id] || undefined }),
    onSuccess: (_r, { action }) => { toast.success(action === 'APPROVE' ? 'Approved' : 'Rejected: the company was asked to re-upload'); refresh(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Action failed'),
  });

  const applyChecklist = useMutation({
    mutationFn: () => api.post('/client-documents/apply-checklist', { clientId }),
    onSuccess: (r) => {
      const n = r.data.created;
      if (n) toast.success(`${n} onboarding document${n === 1 ? '' : 's'} requested. The company has been emailed.`);
      else toast('This client already has every onboarding document requested.', { icon: 'ℹ️' });
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Could not apply the checklist'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/client-documents/${id}`),
    onSuccess: () => { toast.success('Request deleted'); refresh(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
  });

  async function download(d: any) {
    try {
      const res = await api.get(`/client-documents/${d.id}/download`, { responseType: 'blob' });
      saveResponseAsFile(res, d.title);
    } catch {
      toast.error('Download failed');
    }
  }

  const rows: any[] = data?.data || [];
  const counts = data?.counts || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 mr-auto">
          {(['REQUESTED', 'UPLOADED', 'APPROVED', 'REJECTED'] as const).map(k => (
            <span key={k} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS[k].cls}`}>
              {STATUS[k].label}: {counts[k] ?? 0}
            </span>
          ))}
        </div>
        <button onClick={() => applyChecklist.mutate()} disabled={applyChecklist.isPending}
          className="flex items-center gap-1.5 border border-primary-200 text-primary-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-50 transition-colors disabled:opacity-50">
          <ClipboardCheck size={13} /> {applyChecklist.isPending ? 'Applying…' : 'Apply onboarding checklist'}
        </button>
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-500 transition-colors">
          <FilePlus2 size={13} /> Request Document
        </button>
      </div>

      {open && (
        <form onSubmit={e => { e.preventDefault(); create.mutate(); }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 mb-1">Document *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Trade Licence" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">Note for the company</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Valid copy, all pages" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Due date</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
          </div>
          <div className="md:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-gray-500 px-3 py-2">Cancel</button>
            <button type="submit" disabled={create.isPending}
              className="bg-primary-400 hover:bg-primary-500 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-60">
              {create.isPending ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
      ) : !rows.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <FolderOpen size={26} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">No documents requested from this company yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {rows.map(d => {
            const s = STATUS[statusKey(d)];
            return (
              <div key={d.id} className="p-4 space-y-2">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText size={18} className="text-primary-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{d.title}</p>
                      {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Requested {fmt(d.createdAt)}{d.requestedBy?.name && <> by {d.requestedBy.name}</>}
                        {d.dueDate && <> · Due {fmt(d.dueDate)}</>}
                        {d.uploadedAt && <> · Uploaded {fmt(d.uploadedAt)}{d.uploadedByName && <> by {d.uploadedByName}</>}</>}
                        {d.reviewedAt && <> · {d.status === 'APPROVED' ? 'Approved' : 'Rejected'} {fmt(d.reviewedAt)}{d.reviewedBy?.name && <> by {d.reviewedBy.name}</>}</>}
                      </p>
                      {d.reviewNote && <p className="text-xs text-gray-600 mt-1">Note: {d.reviewNote}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${s.cls}`}>{s.label}</span>
                    {d.filePath && (
                      <button onClick={() => download(d)}
                        className="flex items-center gap-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold px-3 py-1.5 rounded-xl">
                        <Download size={12} /> Download
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Delete the request "${d.title}"? Any uploaded file is removed too.`)) remove.mutate(d.id); }}
                      title="Delete request" className="p-1.5 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {d.status === 'UPLOADED' && (
                  <div className="flex flex-col sm:flex-row gap-2 lg:pl-8">
                    <input value={notes[d.id] || ''} onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                      placeholder="Note to company (required to reject)"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    <button disabled={review.isPending}
                      onClick={() => { if (!notes[d.id]?.trim()) { toast.error('Add a note so the company knows what to fix'); return; } review.mutate({ id: d.id, action: 'REJECT' }); }}
                      className="flex items-center justify-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50">
                      <XCircle size={13} /> Reject
                    </button>
                    <button disabled={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'APPROVE' })}
                      className="flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50">
                      <CheckCircle2 size={13} /> Approve
                    </button>
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
