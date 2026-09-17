'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-gray-100 text-gray-600',
};

const columns = [
  { key: 'candidate', label: 'Candidate', render: (_: any, r: any) => `${r.candidate?.firstName} ${r.candidate?.lastName}`, exportValue: (r: any) => `${r.candidate?.firstName || ''} ${r.candidate?.lastName || ''}`.trim() },
  { key: 'job', label: 'Position', render: (_: any, r: any) => r.job?.title, exportValue: (r: any) => r.job?.title || '' },
  { key: 'job', label: 'Client', render: (_: any, r: any) => r.job?.client?.companyName, exportValue: (r: any) => r.job?.client?.companyName || '' },
  { key: 'scheduledAt', label: 'Date & Time', render: (v: string) => new Date(v).toLocaleString() },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v] || 'bg-gray-100'}`}>{v}</span> },
  { key: 'rating', label: 'Rating', render: (v: number) => v ? `${v}/5 ★` : '—' },
];

export default function InterviewsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => api.get('/interviews?limit=50').then(r => r.data),
  });
  const { data: candidates } = useQuery({
    queryKey: ['candidates-list'],
    queryFn: () => api.get('/candidates?limit=200').then(r => r.data.data),
  });
  const { data: jobs } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: () => api.get('/jobs?limit=200&status=OPEN').then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/interviews/${editing.id}`, d) : api.post('/interviews', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interviews'] }); toast.success('Saved'); setModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/interviews/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['interviews'] }); toast.success('Deleted'); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    save.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <>
      <DataTable
        title={`Interviews (${data?.total || data?.data?.length || 0})`}
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Schedule Interview"
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Update Interview' : 'Schedule Interview'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Candidate *</label>
            <select name="candidateId" required defaultValue={editing?.candidateId} className="input">
              <option value="">Select Candidate</option>
              {(candidates || []).map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Job Position *</label>
            <select name="jobId" required defaultValue={editing?.jobId} className="input">
              <option value="">Select Job</option>
              {(jobs || []).map((j: any) => <option key={j.id} value={j.id}>{j.title} — {j.client?.companyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date & Time *</label>
              <input name="scheduledAt" type="datetime-local" required defaultValue={editing?.scheduledAt?.slice(0, 16)} className="input" />
            </div>
            <div>
              <label className="label">Interview Type</label>
              <select name="type" defaultValue={editing?.type || 'VIDEO'} className="input">
                <option value="VIDEO">Video</option>
                <option value="IN_PERSON">In Person</option>
                <option value="PHONE">Phone</option>
                <option value="TECHNICAL">Technical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={editing?.status || 'SCHEDULED'} className="input">
              {['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {editing && (
            <>
              <div>
                <label className="label">Rating (1–5)</label>
                <input name="rating" type="number" min="1" max="5" defaultValue={editing?.rating} className="input" />
              </div>
              <div>
                <label className="label">Feedback</label>
                <textarea name="feedback" defaultValue={editing?.feedback} rows={3} className="input resize-none" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
