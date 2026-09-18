'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCategories, useIndustries } from '@/lib/taxonomy';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
  FILLED: 'bg-blue-100 text-blue-700',
};

const columns = [
  { key: 'title', label: 'Job Title' },
  { key: 'client', label: 'Client', render: (_: any, row: any) => row.client?.companyName, exportValue: (r: any) => r.client?.companyName || '' },
  { key: 'source', label: 'Source', render: (v: string) => (
    <span className={`badge ${v === 'COMPANY_REQUEST' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
      {v === 'COMPANY_REQUEST' ? 'Company Request' : 'Staff'}
    </span>
  ) },
  { key: 'category', label: 'Category', render: (v: any) => v ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${v.color}18`, color: v.color }}>{v.name}</span> : <span className="text-gray-300">—</span> },
  { key: 'industry', label: 'Industry', render: (v: any) => v ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${v.color}18`, color: v.color }}>{v.name}</span> : <span className="text-gray-300">—</span> },
  { key: 'location', label: 'Location' },
  { key: 'positionsCount', label: 'Positions' },
  { key: 'salaryMin', label: 'Salary Range', render: (_: any, row: any) =>
    row.salaryMin ? `${row.currency} ${row.salaryMin?.toLocaleString()}–${row.salaryMax?.toLocaleString()}` : '—',
    exportValue: (r: any) => r.salaryMin ? `${r.currency} ${r.salaryMin}-${r.salaryMax || ''}` : '',
  },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v]}`}>{v}</span> },
  { key: 'isPublished', label: 'Published', render: (v: boolean) => (
    <span className={`badge ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {v ? 'Published' : 'Awaiting Publish'}
    </span>
  ) },
];

export default function JobsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, search, industryId],
    queryFn: () => api.get('/jobs', { params: { page, limit: 20, search, industryId: industryId || undefined } }).then(r => r.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients?limit=100').then(r => r.data.data),
  });
  const { data: categories } = useCategories();
  const { data: industries } = useIndustries();

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/jobs/${editing.id}`, d) : api.post('/jobs', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Saved'); setModal(false); setEditing(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete job'),
  });

  const togglePublish = useMutation({
    mutationFn: (row: any) => api.patch(`/jobs/${row.id}/${row.isPublished ? 'unpublish' : 'publish'}`),
    onSuccess: (_data, row: any) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(row.isPublished ? 'Job unpublished' : 'Job published to the website');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    save.mutate(Object.fromEntries(form.entries()));
  };

  return (
    <>
      <DataTable
        title={`Job Orders (${data?.total || 0})`}
        columns={columns}
        data={data?.data || []}
        total={data?.total}
        page={page}
        limit={20}
        isLoading={isLoading}
        onSearch={setSearch}
        onPageChange={setPage}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Job"
        extraActions={
          <select value={industryId} onChange={(e) => { setIndustryId(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
            <option value="">All Industries</option>
            {(industries || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        }
        actions={(row) => (
          <div className="flex gap-1.5">
            <button onClick={() => togglePublish.mutate(row)} title={row.isPublished ? 'Unpublish' : 'Publish to website'}
              className={`p-1.5 rounded ${row.isPublished ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}>
              {row.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={14} /></button>
            <button onClick={() => { if (confirm('Delete?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Job' : 'Add Job'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Job Title *</label>
              <input name="title" required defaultValue={editing?.title} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Client *</label>
              <select name="clientId" required defaultValue={editing?.clientId} className="input">
                <option value="">Select Client</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input name="location" defaultValue={editing?.location} className="input" />
            </div>
            <div>
              <label className="label">Country</label>
              <input name="country" defaultValue={editing?.country || 'UAE'} className="input" />
            </div>
            <div>
              <label className="label">Min Salary</label>
              <input name="salaryMin" type="number" defaultValue={editing?.salaryMin} className="input" />
            </div>
            <div>
              <label className="label">Max Salary</label>
              <input name="salaryMax" type="number" defaultValue={editing?.salaryMax} className="input" />
            </div>
            <div>
              <label className="label">Positions Count</label>
              <input name="positionsCount" type="number" defaultValue={editing?.positionsCount || 1} className="input" />
            </div>
            <div>
              <label className="label">Experience Required</label>
              <input name="experience" defaultValue={editing?.experience} className="input" placeholder="e.g. 3+ years" />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="categoryId" defaultValue={editing?.categoryId || ''} className="input">
                <option value="">None</option>
                {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Industry</label>
              <select name="industryId" defaultValue={editing?.industryId || ''} className="input">
                <option value="">None</option>
                {(industries || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={editing?.status || 'OPEN'} className="input">
                <option value="OPEN">Open</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="FILLED">Filled</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="label">Deadline</label>
              <input name="deadline" type="date" defaultValue={editing?.deadline?.split('T')[0]} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea name="description" defaultValue={editing?.description} rows={3} className="input resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">
              {save.isPending ? 'Saving...' : 'Save Job'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
