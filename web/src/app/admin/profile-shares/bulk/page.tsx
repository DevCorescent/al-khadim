'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { SHAREABLE_FIELD_GROUPS } from '@/lib/shareableFields';
import {
  ArrowLeft, Search, FileText, Mail, Globe, Send, CheckSquare, Square, X,
} from 'lucide-react';

const STATUSES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'REJECTED', 'ON_HOLD'];

export default function BulkShareCandidatesPage() {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [skills, setSkills] = useState('');
  const [nationality, setNationality] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [page, setPage] = useState(1);

  // Selection persists across pages/filter changes
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Share settings
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [includeCv, setIncludeCv] = useState(true);
  const [method, setMethod] = useState<'PORTAL' | 'EMAIL' | 'BOTH'>('BOTH');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bulk-candidates', search, status, skills, nationality, minExperience, page],
    queryFn: () => api.get('/candidates', {
      params: {
        search: search || undefined,
        status: status || undefined,
        skills: skills || undefined,
        nationality: nationality || undefined,
        minExperience: minExperience || undefined,
        page, limit: 20,
      },
    }).then(r => r.data),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-picker'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then(r => r.data.data),
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs-picker', clientId],
    queryFn: () => api.get('/jobs', { params: { clientId, limit: 100 } }).then(r => r.data.data),
    enabled: !!clientId,
  });

  const candidates = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const allOnPageSelected = candidates.length > 0 && candidates.every((c: any) => selected.has(c.id));

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        candidates.forEach((c: any) => next.delete(c.id));
      } else {
        candidates.forEach((c: any) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleField(key: string) {
    setFields(f => f.includes(key) ? f.filter(x => x !== key) : [...f, key]);
  }

  const bulkShareMutation = useMutation({
    mutationFn: () => api.post('/profile-shares/bulk', {
      candidateIds: Array.from(selected),
      clientId,
      jobId: jobId || undefined,
      sharedFields: fields,
      includeCv,
      method,
      message: message || undefined,
    }),
    onSuccess: (res) => {
      const { created, failed } = res.data;
      if (failed.length > 0) {
        toast(`Shared with ${created} candidate${created !== 1 ? 's' : ''}, ${failed.length} failed`, { icon: '⚠️' });
      } else {
        toast.success(`Shared with ${created} candidate${created !== 1 ? 's' : ''}`);
      }
      router.push('/admin/profile-shares');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Bulk share failed'),
  });

  const canSubmit = selected.size > 0 && clientId && (fields.length > 0 || includeCv);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bulk Share Profiles</h1>
          <p className="text-sm text-gray-500">Filter candidates, select many, and share them with one company in a single action</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: filters + candidate list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name/email…"
                className="input pl-8 text-sm w-full" />
            </div>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input text-sm">
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <input value={skills} onChange={e => { setSkills(e.target.value); setPage(1); }} placeholder="Skill (e.g. Figma)"
              className="input text-sm" />
            <input value={nationality} onChange={e => { setNationality(e.target.value); setPage(1); }} placeholder="Nationality"
              className="input text-sm" />
            <input value={minExperience} onChange={e => { setMinExperience(e.target.value); setPage(1); }} type="number" min="0" placeholder="Min experience (yrs)"
              className="input text-sm" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <button onClick={toggleAllOnPage} className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
                {allOnPageSelected ? <CheckSquare size={15} className="text-primary-500" /> : <Square size={15} className="text-gray-400" />}
                Select all on page
              </button>
              <span className="text-xs text-gray-400">{total} candidate{total !== 1 ? 's' : ''} match filters</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : candidates.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No candidates match these filters</div>
              ) : candidates.map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-gray-400 truncate">{c.headline || c.email} · {c.nationality || '—'} · {c.experience ? `${c.experience} yrs` : '—'}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{c.status?.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: share settings, sticky */}
        <div className="lg:sticky lg:top-4 h-fit space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">{selected.size} selected</h3>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company *</label>
                <select className="input text-sm w-full" value={clientId} onChange={e => { setClientId(e.target.value); setJobId(''); }}>
                  <option value="">Select company…</option>
                  {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Job (optional)</label>
                <select className="input text-sm w-full" value={jobId} onChange={e => setJobId(e.target.value)} disabled={!clientId}>
                  <option value="">General profile</option>
                  {(jobs || []).map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Fields to share <span className="text-gray-400 font-normal">— applied to every selected candidate</span>
                </label>
                <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 max-h-48 overflow-y-auto">
                  {SHAREABLE_FIELD_GROUPS.map(g => (
                    <div key={g.group}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{g.group}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.fields.map(f => (
                          <button key={f.key} type="button" onClick={() => toggleField(f.key)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              fields.includes(f.key) ? 'bg-primary-400 border-primary-400 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
                            }`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={includeCv} onChange={e => setIncludeCv(e.target.checked)} />
                <FileText size={13} className="text-gray-400" /> Include each candidate's CV
              </label>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Delivery</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { v: 'PORTAL', label: 'Portal', icon: Globe },
                    { v: 'EMAIL', label: 'Email', icon: Mail },
                    { v: 'BOTH', label: 'Both', icon: Send },
                  ].map(({ v, label, icon: Icon }) => (
                    <button key={v} type="button" onClick={() => setMethod(v as any)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                        method === v ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message (optional)</label>
                <textarea className="input w-full h-16 resize-none text-sm" value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="e.g. Batch of candidates for the HR Manager opening." />
              </div>

              <button onClick={() => bulkShareMutation.mutate()} disabled={!canSubmit || bulkShareMutation.isPending}
                className="w-full btn-primary justify-center py-3 rounded-xl text-sm disabled:opacity-50">
                {bulkShareMutation.isPending ? 'Sharing…' : `Share with ${selected.size} Candidate${selected.size !== 1 ? 's' : ''}`}
              </button>
              {!canSubmit && (
                <p className="text-xs text-gray-400 text-center">
                  Select candidates, a company, and at least one field or the CV
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
