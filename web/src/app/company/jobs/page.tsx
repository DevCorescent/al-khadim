'use client';
import { useState } from 'react';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Briefcase, MapPin, Clock, CheckCircle2, Eye } from 'lucide-react';
import { useCategories, useIndustries } from '@/lib/taxonomy';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  FILLED: 'bg-blue-100 text-blue-700',
};

const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE'];

const INITIAL_FORM = {
  title: '', description: '', location: '', country: 'UAE', jobType: '',
  experience: '', positionsCount: '1', salaryMin: '', salaryMax: '', currency: 'AED', deadline: '',
  categoryId: '', industryId: '',
};

export default function CompanyJobsPage() {
  const { accessToken } = useClientAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const { data: categories } = useCategories();
  const { data: industries } = useIndustries();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['company-jobs'],
    queryFn: () => clientApi(accessToken!).get('/api/jobs/mine').then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 0,
  });

  function setField(field: keyof typeof INITIAL_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const submitMutation = useMutation({
    mutationFn: () => clientApi(accessToken!).post('/api/jobs/mine', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-jobs'] });
      toast.success('Job request submitted — Al Khadim will review it');
      setOpen(false);
      setForm(INITIAL_FORM);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to submit job request'),
  });

  const list = jobs || [];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
          <p className="text-xs text-gray-400 mt-0.5">Tell Al Khadim what roles you're hiring for</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-500 transition-colors">
          <Plus size={13} /> Post a Job
        </button>
      </div>

      {open && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 mb-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Job Title *</label>
              <input className="input" value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Senior Site Engineer" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Role responsibilities, requirements…" />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="e.g. Dubai" />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="UAE" />
            </div>
            <div>
              <label className="label">Job Type</label>
              <select className="input" value={form.jobType} onChange={(e) => setField('jobType', e.target.value)}>
                <option value="">Select type</option>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Experience</label>
              <input className="input" value={form.experience} onChange={(e) => setField('experience', e.target.value)} placeholder="e.g. 3+ years" />
            </div>
            <div>
              <label className="label">Positions</label>
              <input className="input" type="number" min="1" value={form.positionsCount} onChange={(e) => setField('positionsCount', e.target.value)} />
            </div>
            <div>
              <label className="label">Deadline</label>
              <input className="input" type="date" value={form.deadline} onChange={(e) => setField('deadline', e.target.value)} />
            </div>
            <div>
              <label className="label">Min Salary</label>
              <input className="input" type="number" value={form.salaryMin} onChange={(e) => setField('salaryMin', e.target.value)} />
            </div>
            <div>
              <label className="label">Max Salary</label>
              <input className="input" type="number" value={form.salaryMax} onChange={(e) => setField('salaryMax', e.target.value)} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)}>
                <option value="">None</option>
                {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Industry</label>
              <select className="input" value={form.industryId} onChange={(e) => setField('industryId', e.target.value)}>
                <option value="">None</option>
                {(industries || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Note:</strong> Your job request is internal-only. Al Khadim will review it and publish it to the public careers page when ready.
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button onClick={() => submitMutation.mutate()} disabled={!form.title || submitMutation.isPending} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
              {submitMutation.isPending ? 'Submitting…' : 'Submit Job Request'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-800 text-sm">Your Job Requests ({list.length})</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <Briefcase size={28} className="text-gray-300 mx-auto mb-3" />
            No job requests yet — post one above.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((job: any) => (
              <div key={job.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">{job.title}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                    {job.location && <span className="flex items-center gap-1"><MapPin size={10} /> {job.location}</span>}
                    {job.experience && <span className="flex items-center gap-1"><Clock size={10} /> {job.experience}</span>}
                    <span>{job.positionsCount} position{job.positionsCount !== 1 ? 's' : ''}</span>
                  </div>
                  {(job.category || job.industry) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {job.category && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${job.category.color}18`, color: job.category.color }}>{job.category.name}</span>}
                      {job.industry && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${job.industry.color}18`, color: job.industry.color }}>{job.industry.name}</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-500'}`}>
                    {job.status}
                  </span>
                  {job.isPublished ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      <Eye size={9} /> Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={9} /> Awaiting Publish
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
