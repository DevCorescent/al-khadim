'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const columns = [
  { key: 'employee', label: 'Employee', render: (_: any, r: any) => `${r.employee?.firstName} ${r.employee?.lastName}`, exportValue: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
  { key: 'leaveType', label: 'Leave Type' },
  { key: 'startDate', label: 'Start', render: (v: string) => new Date(v).toLocaleDateString() },
  { key: 'endDate', label: 'End', render: (v: string) => new Date(v).toLocaleDateString() },
  { key: 'days', label: 'Days' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v]}`}>{v}</span> },
];

export default function LeavePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('PENDING');

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leave', filter],
    queryFn: () => api.get(`/leave${filter ? `?status=${filter}` : ''}`).then(r => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees?limit=200').then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: (d: any) => api.post('/leave', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave'] }); toast.success('Leave request created'); setModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => api.put(`/leave/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave'] }); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update leave status'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === s ? 'bg-primary-400 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s || 'All'}
          </button>
        ))}
        <button onClick={() => setModal(true)} className="btn-primary text-sm py-2 ml-auto">
          <Plus size={14} /> New Leave Request
        </button>
      </div>

      <DataTable
        title={`Leave Requests (${leaves?.length || 0})`}
        columns={columns}
        data={leaves || []}
        isLoading={isLoading}
        actions={(row) => row.status === 'PENDING' ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => updateStatus.mutate({ id: row.id, status: 'APPROVED' })}
              className="p-1.5 hover:bg-green-50 rounded text-green-600"
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={() => updateStatus.mutate({ id: row.id, status: 'REJECTED' })}
              className="p-1.5 hover:bg-red-50 rounded text-red-500"
            >
              <XCircle size={14} />
            </button>
          </div>
        ) : null}
      />

      <Modal isOpen={modal} onClose={() => setModal(false)} title="New Leave Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Employee *</label>
            <select name="employeeId" required className="input">
              <option value="">Select Employee</option>
              {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Leave Type *</label>
            <select name="leaveType" required className="input">
              <option value="Annual">Annual Leave</option>
              <option value="Sick">Sick Leave</option>
              <option value="Emergency">Emergency Leave</option>
              <option value="Maternity">Maternity Leave</option>
              <option value="Unpaid">Unpaid Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input name="startDate" type="date" required className="input" />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input name="endDate" type="date" required className="input" />
            </div>
          </div>
          <div>
            <label className="label">Number of Days *</label>
            <input name="days" type="number" required min="1" className="input" />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea name="reason" rows={3} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-2">Submit</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
