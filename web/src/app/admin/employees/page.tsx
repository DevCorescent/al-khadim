'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  ON_LEAVE: 'bg-yellow-100 text-yellow-700',
  TERMINATED: 'bg-red-100 text-red-700',
  RESIGNED: 'bg-orange-100 text-orange-700',
};

const columns = [
  { key: 'employeeId', label: 'ID' },
  { key: 'firstName', label: 'Name', render: (_: any, row: any) => `${row.firstName} ${row.lastName}`, exportValue: (r: any) => `${r.firstName || ''} ${r.lastName || ''}`.trim() },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'basicSalary', label: 'Salary', render: (v: number, row: any) => `${row.currency} ${v?.toLocaleString()}` },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v]}`}>{v}</span> },
  { key: 'joiningDate', label: 'Joined', render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
];

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => api.get(`/employees?page=${page}&limit=20&search=${search}`).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: FormData) => editing
      ? api.put(`/employees/${editing.id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } })
      : api.post('/employees', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Saved'); setModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete employee'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save.mutate(new FormData(e.currentTarget));
  };

  return (
    <>
      <DataTable
        title={`Employees (${data?.total || 0})`}
        columns={columns}
        data={data?.data || []}
        total={data?.total}
        page={page}
        limit={20}
        isLoading={isLoading}
        onSearch={setSearch}
        onPageChange={setPage}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Employee"
        exportFilename="employees"
        importConfig={{
          endpoint: '/employees',
          fields: [
            { key: 'employeeId', label: 'Employee ID', required: true },
            { key: 'firstName', label: 'First Name', required: true },
            { key: 'lastName', label: 'Last Name', required: true },
            { key: 'email', label: 'Email', required: true },
            { key: 'phone', label: 'Phone', required: true },
            { key: 'designation', label: 'Designation', required: true },
            { key: 'department', label: 'Department' },
            { key: 'basicSalary', label: 'Basic Salary', required: true },
            { key: 'joiningDate', label: 'Joining Date', required: true },
            { key: 'nationality', label: 'Nationality' },
            { key: 'passportNo', label: 'Passport No' },
            { key: 'visaNo', label: 'Visa No' },
            { key: 'emiratesId', label: 'Emirates ID' },
          ],
        }}
        onImportDone={() => qc.invalidateQueries({ queryKey: ['employees'] })}
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Employee' : 'Add Employee'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID *</label>
              <input name="employeeId" required defaultValue={editing?.employeeId} className="input" placeholder="EMP001" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={editing?.status || 'ACTIVE'} className="input">
                {['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">First Name *</label>
              <input name="firstName" required defaultValue={editing?.firstName} className="input" />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input name="lastName" required defaultValue={editing?.lastName} className="input" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input name="email" type="email" required defaultValue={editing?.email} className="input" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input name="phone" required defaultValue={editing?.phone} className="input" />
            </div>
            <div>
              <label className="label">Designation *</label>
              <input name="designation" required defaultValue={editing?.designation} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <input name="department" defaultValue={editing?.department} className="input" />
            </div>
            <div>
              <label className="label">Basic Salary (AED) *</label>
              <input name="basicSalary" type="number" required defaultValue={editing?.basicSalary} className="input" />
            </div>
            <div>
              <label className="label">Joining Date *</label>
              <input name="joiningDate" type="date" required defaultValue={editing?.joiningDate?.split('T')[0]} className="input" />
            </div>
            <div>
              <label className="label">Nationality</label>
              <input name="nationality" defaultValue={editing?.nationality} className="input" />
            </div>
            <div>
              <label className="label">Passport No.</label>
              <input name="passportNo" defaultValue={editing?.passportNo} className="input" />
            </div>
            <div>
              <label className="label">Passport Expiry</label>
              <input name="passportExpiry" type="date" defaultValue={editing?.passportExpiry?.split('T')[0]} className="input" />
            </div>
            <div>
              <label className="label">Visa No.</label>
              <input name="visaNo" defaultValue={editing?.visaNo} className="input" />
            </div>
            <div>
              <label className="label">Visa Expiry</label>
              <input name="visaExpiry" type="date" defaultValue={editing?.visaExpiry?.split('T')[0]} className="input" />
            </div>
            <div>
              <label className="label">Emirates ID</label>
              <input name="emiratesId" defaultValue={editing?.emiratesId} className="input" />
            </div>
            <div>
              <label className="label">Emirates ID Expiry</label>
              <input name="emiratesExpiry" type="date" defaultValue={editing?.emiratesExpiry?.split('T')[0]} className="input" />
            </div>
            <div>
              <label className="label">Bank Name</label>
              <input name="bankName" defaultValue={editing?.bankName} className="input" />
            </div>
            <div>
              <label className="label">IBAN</label>
              <input name="iban" defaultValue={editing?.iban} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Photo</label>
              <input name="photo" type="file" accept="image/*" className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">
              {save.isPending ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
