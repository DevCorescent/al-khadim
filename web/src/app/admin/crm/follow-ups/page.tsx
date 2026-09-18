'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { CheckCircle, Pencil, Trash2 } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  CALL: 'bg-blue-100 text-blue-700',
  EMAIL: 'bg-green-100 text-green-700',
  MEETING: 'bg-purple-100 text-purple-700',
  WHATSAPP: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

const columns = [
  { key: 'subject', label: 'Subject' },
  { key: 'type', label: 'Type', render: (v: string) => <span className={`badge ${TYPE_COLORS[v]}`}>{v}</span> },
  { key: 'client', label: 'Client', render: (_: any, r: any) => r.client?.companyName || '—', exportValue: (r: any) => r.client?.companyName || '' },
  { key: 'dueDate', label: 'Due Date', render: (v: string) => {
    const d = new Date(v);
    const overdue = d < new Date();
    return <span className={overdue ? 'text-red-500 font-medium' : ''}>{d.toLocaleDateString()}</span>;
  }},
  { key: 'user', label: 'Assigned To', render: (_: any, r: any) => r.user?.name || '—' },
  { key: 'isCompleted', label: 'Status', render: (v: boolean) => <span className={`badge ${v ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v ? 'Done' : 'Pending'}</span> },
];

export default function FollowUpsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('false');

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['follow-ups', filter],
    // "All" ('') must omit the param: the API treats any value other than 'true' as false.
    queryFn: () => api.get('/follow-ups', { params: filter ? { isCompleted: filter } : {} }).then(r => r.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients?limit=100').then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: (d: any) => api.post('/follow-ups', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up created'); setModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.put(`/follow-ups/${id}`, { isCompleted: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Marked complete'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update follow-up'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/follow-ups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete follow-up'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[['false', 'Pending'], ['true', 'Completed'], ['', 'All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === val ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{label}</button>
        ))}
      </div>

      <DataTable
        title={`Follow-Ups (${followUps?.length || 0})`}
        columns={columns}
        data={followUps || []}
        isLoading={isLoading}
        onAdd={() => setModal(true)}
        addLabel="Add Follow-Up"
        actions={(row) => !row.isCompleted ? (
          <div className="flex gap-1.5">
            <button onClick={() => complete.mutate(row.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600"><CheckCircle size={14} /></button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        ) : null}
      />

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Add Follow-Up">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Subject *</label>
            <input name="subject" required className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input">
                {['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'OTHER'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input name="dueDate" type="datetime-local" required className="input" />
            </div>
          </div>
          <div>
            <label className="label">Client</label>
            <select name="clientId" className="input">
              <option value="">None</option>
              {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" rows={3} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-2">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
