'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Eye, FileUp, Globe, EyeOff, Share2, Briefcase } from 'lucide-react';
import { useCategories, useIndustries } from '@/lib/taxonomy';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  SCREENING: 'bg-yellow-100 text-yellow-700',
  SHORTLISTED: 'bg-green-100 text-green-700',
  INTERVIEW_SCHEDULED: 'bg-purple-100 text-purple-700',
  INTERVIEWED: 'bg-indigo-100 text-indigo-700',
  OFFERED: 'bg-teal-100 text-teal-700',
  JOINED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  ON_HOLD: 'bg-gray-100 text-gray-600',
};

const STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'REJECTED', 'ON_HOLD'];

const columns = [
  {
    key: 'cvId', label: 'CV ID',
    render: (v: string) => v
      ? <span className="text-[11px] font-bold font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md whitespace-nowrap">{v}</span>
      : <span className="text-gray-300">—</span>,
  },
  {
    key: 'firstName', label: 'Name',
    render: (_: any, row: any) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
          {row.firstName?.[0]}{row.lastName?.[0]}
        </div>
        <span className="font-semibold text-gray-800">{row.firstName} {row.lastName}</span>
      </div>
    ),
    exportValue: (r: any) => `${r.firstName || ''} ${r.lastName || ''}`.trim(),
  },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'experience', label: 'Exp', render: (v: any) => v ? `${v} yr${v !== 1 ? 's' : ''}` : '—' },
  {
    key: 'category', label: 'Category',
    render: (v: any) => v ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${v.color}18`, color: v.color }}>{v.name}</span> : <span className="text-gray-300">—</span>,
  },
  {
    key: 'industry', label: 'Industry',
    render: (v: any) => v ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${v.color}18`, color: v.color }}>{v.name}</span> : <span className="text-gray-300">—</span>,
  },
  {
    key: 'status', label: 'Status',
    render: (v: string) => <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[v] || 'bg-gray-100 text-gray-600'}`}>{v?.replace(/_/g, ' ')}</span>,
  },
  {
    key: 'isPublic', label: 'Visibility',
    render: (v: boolean) => v
      ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit"><Globe size={10} /> Public</span>
      : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1 w-fit"><EyeOff size={10} /> Draft</span>,
    exportValue: (r: any) => r.isPublic ? 'Public' : 'Draft',
  },
];

export default function CandidatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [industryId, setIndustryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { data: categories } = useCategories();
  const { data: industries } = useIndustries();

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', page, search, industryId, categoryId],
    queryFn: () => api.get('/candidates', { params: { page, limit: 20, search, industryId: industryId || undefined, categoryId: categoryId || undefined } }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: FormData) => editing
      ? api.put(`/candidates/${editing.id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } })
      : api.post('/candidates', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(editing ? 'Candidate updated' : 'Candidate added');
      setModal(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['candidates'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete candidate'),
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.patch(`/candidates/${id}/visibility`, { isPublic }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(vars.isPublic ? 'Candidate is now public!' : 'Candidate set to draft');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <>
      {/* Industry sub-tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => { setIndustryId(''); setPage(1); }}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
            industryId === '' ? 'bg-primary-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          <Briefcase size={11} /> All Industries
        </button>
        {(industries || []).map((ind) => (
          <button key={ind.id} onClick={() => { setIndustryId(ind.id); setPage(1); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              industryId === ind.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={industryId === ind.id ? { background: ind.color } : undefined}>
            {ind.name}
          </button>
        ))}
      </div>

      <DataTable
        title={`Candidates (${data?.total || 0})`}
        columns={columns}
        data={data?.data || []}
        total={data?.total}
        page={page}
        limit={20}
        isLoading={isLoading}
        onSearch={setSearch}
        onPageChange={setPage}
        onAdd={() => { setEditing(null); setModal(true); }}
        addLabel="Add Candidate"
        exportFilename="candidates"
        importConfig={{
          endpoint: '/candidates',
          fields: [
            { key: 'firstName', label: 'First Name', required: true },
            { key: 'lastName', label: 'Last Name', required: true },
            { key: 'email', label: 'Email', required: true },
            { key: 'phone', label: 'Phone', required: true },
            { key: 'nationality', label: 'Nationality' },
            { key: 'experience', label: 'Experience (years)' },
            { key: 'currentSalary', label: 'Current Salary' },
            { key: 'expectedSalary', label: 'Expected Salary' },
            { key: 'currentLocation', label: 'Current Location' },
            { key: 'skills', label: 'Skills (comma-separated)' },
          ],
        }}
        onImportDone={() => qc.invalidateQueries({ queryKey: ['candidates'] })}
        extraActions={
          <>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
              <option value="">All Categories</option>
              {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => router.push('/admin/profile-shares/bulk')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-indigo-500/20"
            >
              <Share2 size={14} /> Bulk Share
            </button>
            <button
              onClick={() => router.push('/admin/candidates/import')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-emerald-500/20"
            >
              <FileUp size={14} /> Import from CV
            </button>
          </>
        }
        actions={(row) => (
          <div className="flex gap-1">
            <Link href={`/admin/candidates/${row.id}`} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors" title="View Profile">
              <Eye size={14} />
            </Link>
            <button
              onClick={() => toggleVisibility.mutate({ id: row.id, isPublic: !row.isPublic })}
              className={`p-1.5 rounded-lg transition-colors ${row.isPublic ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-600'}`}
              title={row.isPublic ? 'Make Private' : 'Make Public'}
            >
              {row.isPublic ? <EyeOff size={14} /> : <Globe size={14} />}
            </button>
            <button onClick={() => { setEditing(row); setModal(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Quick Edit">
              <Pencil size={14} />
            </button>
            <button onClick={() => { if (confirm('Delete this candidate?')) del.mutate(row.id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />

      <Modal isOpen={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Candidate' : 'Add Candidate'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input name="firstName" required defaultValue={editing?.firstName} className="input" /></div>
            <div><label className="label">Last Name *</label><input name="lastName" required defaultValue={editing?.lastName} className="input" /></div>
            <div><label className="label">Email *</label><input name="email" type="email" required defaultValue={editing?.email} className="input" /></div>
            <div><label className="label">Phone *</label><input name="phone" required defaultValue={editing?.phone} className="input" /></div>
            <div><label className="label">Nationality</label><input name="nationality" defaultValue={editing?.nationality} className="input" /></div>
            <div><label className="label">Experience (years)</label><input name="experience" type="number" defaultValue={editing?.experience} className="input" /></div>
            <div><label className="label">Current Salary (AED)</label><input name="currentSalary" type="number" defaultValue={editing?.currentSalary} className="input" /></div>
            <div><label className="label">Expected Salary (AED)</label><input name="expectedSalary" type="number" defaultValue={editing?.expectedSalary} className="input" /></div>
            <div><label className="label">Current Location</label><input name="currentLocation" defaultValue={editing?.currentLocation} className="input" /></div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={editing?.status || 'NEW'} className="input">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select name="source" defaultValue={editing?.source || 'WEBSITE'} className="input">
                <option value="WEBSITE">Website</option>
                <option value="REFERRAL">Referral</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="ADMIN_IMPORT">Admin Import</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Visibility</label>
              <select name="isPublic" defaultValue={editing?.isPublic ? 'true' : 'false'} className="input">
                <option value="false">Draft (Private)</option>
                <option value="true">Public</option>
              </select>
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
                {(industries || []).map((ind) => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Skills (comma-separated)</label><input name="skills" defaultValue={editing?.skills?.join(', ')} className="input" placeholder="React, Node.js, SQL" /></div>
            <div className="col-span-2"><label className="label">Upload CV (PDF/DOCX)</label><input name="cv" type="file" accept=".pdf,.doc,.docx" className="input" /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea name="notes" defaultValue={editing?.notes} rows={3} className="input resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary text-sm py-2">
              {save.isPending ? 'Saving...' : (editing ? 'Update' : 'Add')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
