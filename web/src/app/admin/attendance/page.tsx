'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT: 'bg-red-100 text-red-700',
  LEAVE: 'bg-yellow-100 text-yellow-700',
  HALF_DAY: 'bg-orange-100 text-orange-700',
};

const columns = [
  { key: 'employee', label: 'Employee', render: (_: any, r: any) => `${r.employee?.firstName} ${r.employee?.lastName}`, exportValue: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
  { key: 'employee', label: 'Emp ID', render: (_: any, r: any) => r.employee?.employeeId, exportValue: (r: any) => r.employee?.employeeId || '' },
  { key: 'date', label: 'Date', render: (v: string) => new Date(v).toLocaleDateString() },
  { key: 'checkIn', label: 'Check In', render: (v: string) => v ? new Date(v).toLocaleTimeString() : '—' },
  { key: 'checkOut', label: 'Check Out', render: (v: string) => v ? new Date(v).toLocaleTimeString() : '—' },
  { key: 'hoursWorked', label: 'Hours', render: (v: number) => v ? `${v.toFixed(1)}h` : '—' },
  { key: 'overtime', label: 'OT (hrs)', render: (v: number) => v ? `${v.toFixed(1)}h` : '—' },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v] || 'bg-gray-100'}`}>{v}</span> },
];

export default function AttendancePage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance', month, year],
    queryFn: () => api.get(`/attendance?month=${month}&year=${year}`).then(r => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees?limit=200').then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => api.post('/attendance', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Attendance saved'); setModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    save.mutate(Object.fromEntries(form.entries()));
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input w-32">
          {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-24">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setModal(true)} className="btn-primary text-sm py-2 ml-auto">
          <Plus size={14} /> Mark Attendance
        </button>
      </div>

      <DataTable
        title={`Attendance — ${monthNames[month - 1]} ${year} (${records?.length || 0} records)`}
        columns={columns}
        data={records || []}
        isLoading={isLoading}
      />

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Mark Attendance">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Employee *</label>
            <select name="employeeId" required className="input">
              <option value="">Select Employee</option>
              {(employees || []).map((e: any) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.employeeId}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Check In</label>
              <input name="checkIn" type="time" className="input" />
            </div>
            <div>
              <label className="label">Check Out</label>
              <input name="checkOut" type="time" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hours Worked</label>
              <input name="hoursWorked" type="number" step="0.5" className="input" />
            </div>
            <div>
              <label className="label">Overtime (hours)</label>
              <input name="overtime" type="number" step="0.5" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue="PRESENT" className="input">
              {['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">
              {save.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
