'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';

const columns = [
  { key: 'employee', label: 'Employee', render: (_: any, r: any) => `${r.employee?.firstName} ${r.employee?.lastName}`, exportValue: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
  { key: 'clientName', label: 'Deployed At' },
  { key: 'designation', label: 'Designation' },
  { key: 'startDate', label: 'Start', render: (v: string) => new Date(v).toLocaleDateString() },
  { key: 'endDate', label: 'End', render: (v: string) => v ? new Date(v).toLocaleDateString() : 'Ongoing' },
  { key: 'salary', label: 'Salary', render: (v: number, r: any) => `${r.currency} ${v?.toLocaleString()}` },
  { key: 'visaStatus', label: 'Visa Status' },
  { key: 'isActive', label: 'Status', render: (v: boolean) => <span className={`badge ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{v ? 'Active' : 'Ended'}</span> },
];

export default function OutsourcingPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: records, isLoading } = useQuery({
    queryKey: ['outsourcing'],
    queryFn: () => api.get('/outsourcing').then(r => r.data),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees?limit=200').then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/outsourcing/${editing.id}`, d) : api.post('/outsourcing', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outsourcing'] }); toast.success('Saved'); setModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/outsourcing/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outsourcing'] }); toast.success('Deleted'); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    save.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <>
      <DataTable
        title={`Outsourcing (${records?.length || 0})`}
        columns={columns}
        data={records || []}
        isLoading={isLoading}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Assignment"
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Assignment' : 'New Outsourcing Assignment'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Employee *</label>
            <select name="employeeId" required defaultValue={editing?.employeeId} className="input">
              <option value="">Select Employee</option>
              {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.employeeId}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Client / Company Name *</label>
            <input name="clientName" required defaultValue={editing?.clientName} className="input" />
          </div>
          <div>
            <label className="label">Designation *</label>
            <input name="designation" required defaultValue={editing?.designation} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input name="startDate" type="date" required defaultValue={editing?.startDate?.split('T')[0]} className="input" />
            </div>
            <div>
              <label className="label">End Date</label>
              <input name="endDate" type="date" defaultValue={editing?.endDate?.split('T')[0]} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Salary *</label>
              <input name="salary" type="number" required defaultValue={editing?.salary} className="input" />
            </div>
            <div>
              <label className="label">Visa Status</label>
              <select name="visaStatus" defaultValue={editing?.visaStatus || 'COMPANY'} className="input">
                <option value="COMPANY">Company Visa</option>
                <option value="CLIENT">Client Visa</option>
                <option value="OWN">Own Visa</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Accommodation</label>
            <input name="accommodation" defaultValue={editing?.accommodation} className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="isActive" defaultValue={String(editing?.isActive ?? true)} className="input">
              <option value="true">Active</option>
              <option value="false">Ended</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
