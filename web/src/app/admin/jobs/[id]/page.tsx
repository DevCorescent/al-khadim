'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCan } from '@/lib/auth';
import Modal from '@/components/admin/Modal';
import ShareProfileModal from '@/components/admin/ShareProfileModal';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ChevronRight, Briefcase, MapPin, DollarSign, Users,
  Calendar, Clock, CheckCircle2, Circle, Building2, Phone, Mail,
  User, Award, FileText, Edit2, Trash2, Target, Eye, EyeOff, Send,
  UserPlus, Search, Share2,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  FILLED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  ON_HOLD: 'bg-amber-100 text-amber-700',
};

const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  SCREENING: 'bg-blue-100 text-blue-700',
  SHORTLISTED: 'bg-indigo-100 text-indigo-700',
  INTERVIEW_SCHEDULED: 'bg-amber-100 text-amber-700',
  INTERVIEWED: 'bg-purple-100 text-purple-700',
  OFFERED: 'bg-cyan-100 text-cyan-700',
  JOINED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
  ON_HOLD: 'bg-gray-100 text-gray-500',
};

const PIPELINE_STAGES = ['NEW','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','JOINED'];

function KpiCard({ label, value, icon: Icon, color = '#6366f1', sub }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '18' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>}
    </div>
  );
}

const TABS = ['Overview', 'Applicants', 'Interviews', 'Pipeline'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [statusEdit, setStatusEdit] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [shareCandidate, setShareCandidate] = useState<any>(null);
  const can = useCan();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/jobs/${id}`).then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/jobs/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job', id] }); toast.success('Status updated'); setStatusEdit(false); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const updateCandidateStatus = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      api.put(`/jobs/applications/${appId}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job', id] }); toast.success('Updated'); },
    onError: () => toast.error('Update failed'),
  });

  // POST /candidates/:id/apply creates the CandidateJob (409 if already assigned).
  const addApplicant = useMutation({
    mutationFn: (candidateId: string) => api.post(`/candidates/${candidateId}/apply`, { jobId: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job', id] }); toast.success('Applicant added'); setAddOpen(false); },
    // Show the server's message for client errors (e.g. 409 "already assigned"); 5xx may carry internals.
    onError: (e: any) => toast.error(
      (e.response?.status < 500 && e.response?.data?.error) || 'Failed to add applicant',
    ),
  });

  const togglePublish = useMutation({
    mutationFn: () => api.patch(`/jobs/${id}/${job?.isPublished ? 'unpublish' : 'publish'}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] });
      toast.success(job?.isPublished ? 'Job unpublished' : 'Job published to the website');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );

  if (error || !job) return (
    <div className="p-8 text-center text-red-500">
      <p className="font-semibold">Failed to load job order.</p>
      <button onClick={() => router.back()} className="mt-3 text-sm text-gray-500 underline">Go back</button>
    </div>
  );

  const applications = job.applications || [];
  const interviews   = job.interviews   || [];
  const joined       = applications.filter((a: any) => a.status === 'JOINED').length;
  const offered      = applications.filter((a: any) => a.status === 'OFFERED').length;
  const fillPct      = job.positionsCount ? Math.round((job.filledCount / job.positionsCount) * 100) : 0;

  // Pipeline counts per stage
  const stageCounts = PIPELINE_STAGES.map(s => ({
    stage: s,
    count: applications.filter((a: any) => a.status === s).length,
  }));

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={15} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Link href="/admin/jobs" className="hover:text-gray-600">Job Orders</Link>
            <ChevronRight size={12} />
            <span className="text-gray-700 font-semibold">{job.title}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-100 flex items-center justify-center shrink-0">
              <Briefcase size={22} className="text-primary-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Status badge / editor */}
                {statusEdit ? (
                  <div className="flex items-center gap-2">
                    <select defaultValue={job.status} onChange={e => setNewStatus(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                      {['OPEN','ON_HOLD','FILLED','CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => updateStatus.mutate(newStatus || job.status)}
                      className="text-xs font-bold text-emerald-600 hover:underline">Save</button>
                    <button onClick={() => setStatusEdit(false)}
                      className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setNewStatus(job.status); setStatusEdit(true); }}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-500'}`}>
                    {job.status}
                  </button>
                )}
                {job.client && (
                  <Link href={`/admin/crm/clients/${job.clientId}`}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-500">
                    <Building2 size={11} /> {job.client.companyName}
                  </Link>
                )}
                {job.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={11} /> {job.location}{job.country ? `, ${job.country}` : ''}
                  </span>
                )}
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${job.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {job.isPublished ? 'Published' : 'Awaiting Publish'}
                </span>
              </div>
              {job.source === 'COMPANY_REQUEST' && (
                <p className="flex items-center gap-1.5 text-xs text-indigo-500 mt-2">
                  <Send size={11} /> Requested by {job.requestedByClientUser?.name || 'a company user'} ({job.client?.companyName})
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => togglePublish.mutate()}
            disabled={togglePublish.isPending}
            className={`shrink-0 flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
              job.isPublished ? 'border border-amber-200 text-amber-600 hover:bg-amber-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {job.isPublished ? <EyeOff size={15} /> : <Eye size={15} />}
            {togglePublish.isPending ? 'Updating…' : job.isPublished ? 'Unpublish' : 'Publish to Website'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-gray-100 -mb-4">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? 'border-primary-400 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t}
              {t === 'Applicants' && applications.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-bold">
                  {applications.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* OVERVIEW */}
        {tab === 'Overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard label="Applicants"   value={applications.length} icon={Users}        color="#6366f1" />
              <KpiCard label="Positions"    value={`${job.filledCount}/${job.positionsCount}`} icon={Target} color="#10b981" sub="filled / total" />
              <KpiCard label="Offered"      value={offered}             icon={Award}        color="#f59e0b" />
              <KpiCard label="Joined"       value={joined}              icon={CheckCircle2} color="#3b82f6" />
            </div>

            {/* Fill progress */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-700">Position Fill Rate</p>
                <span className="text-sm font-bold text-primary-500">{fillPct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${fillPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{job.filledCount} of {job.positionsCount} position{job.positionsCount !== 1 ? 's' : ''} filled</p>
            </div>

            {/* Job details card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Job Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Job Type',    value: job.jobType    || '—', icon: Briefcase },
                  { label: 'Experience',  value: job.experience  || '—', icon: Clock },
                  { label: 'Salary Range',
                    value: job.salaryMin ? `${job.currency} ${job.salaryMin?.toLocaleString()}–${job.salaryMax?.toLocaleString()}` : '—',
                    icon: DollarSign },
                  { label: 'Deadline',   value: job.deadline ? new Date(job.deadline).toLocaleDateString('en-GB') : '—', icon: Calendar },
                  { label: 'Posted',     value: new Date(job.createdAt).toLocaleDateString('en-GB'), icon: Calendar },
                  { label: 'Location',   value: [job.location, job.country].filter(Boolean).join(', ') || '—', icon: MapPin },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <Icon size={13} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client info */}
            {job.client && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">Client</h3>
                  <Link href={`/admin/crm/clients/${job.clientId}`}
                    className="text-xs text-primary-500 font-semibold hover:underline">View Profile →</Link>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                    <span className="text-primary-600 font-bold">{job.client.companyName[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{job.client.companyName}</p>
                    <p className="text-xs text-gray-400">{job.client.contactPerson} · {job.client.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Description / Requirements */}
            {(job.description || job.requirements) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                {job.description && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">Description</h3>
                    <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{job.description}</p>
                  </div>
                )}
                {job.requirements && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">Requirements</h3>
                    <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{job.requirements}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* APPLICANTS */}
        {tab === 'Applicants' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {can('candidates', 'edit') && (
              <div className="flex justify-end px-4 py-3 border-b border-gray-100">
                <button onClick={() => setAddOpen(true)} className="btn-primary text-sm py-2 flex items-center gap-1.5">
                  <UserPlus size={15} /> Add applicant
                </button>
              </div>
            )}
            {applications.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No applicants yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Candidate','Nationality','Applied','Status','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app: any) => (
                    <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <User size={13} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">
                              {app.candidate?.firstName} {app.candidate?.lastName}
                            </p>
                            <p className="text-[10px] text-gray-400">{app.candidate?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{app.candidate?.nationality || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(app.appliedAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CANDIDATE_STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-500'}`}>
                          {app.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select defaultValue={app.status}
                          onChange={e => updateCandidateStatus.mutate({ appId: app.id, status: e.target.value })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
                          {['NEW','SCREENING','SHORTLISTED','INTERVIEW_SCHEDULED','INTERVIEWED','OFFERED','JOINED','REJECTED','ON_HOLD'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        {/* POST /profile-shares requires candidates:edit */}
                        {app.candidate && can('candidates', 'edit') && (
                          <button onClick={() => setShareCandidate(app.candidate)}
                            className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
                            <Share2 size={12} /> Share with Company
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add applicant">
          <AddApplicantForm
            assignedIds={applications.map((a: any) => a.candidateId)}
            saving={addApplicant.isPending}
            onSubmit={candidateId => addApplicant.mutate(candidateId)}
          />
        </Modal>

        {/* Company/job come from this job order, not user input; the server re-checks the job belongs to the company. */}
        {shareCandidate && (
          <ShareProfileModal key={shareCandidate.id} isOpen onClose={() => setShareCandidate(null)}
            candidate={shareCandidate} initialClientId={job.clientId} initialJobId={job.id} />
        )}

        {/* INTERVIEWS */}
        {tab === 'Interviews' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {interviews.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No interviews scheduled</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Candidate','Type','Scheduled','Status','Notes'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((iv: any) => (
                    <tr key={iv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {iv.candidate?.firstName} {iv.candidate?.lastName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{iv.type || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          iv.status === 'PASSED' ? 'bg-emerald-100 text-emerald-700' :
                          iv.status === 'FAILED' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>{iv.status || 'PENDING'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{iv.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* PIPELINE */}
        {tab === 'Pipeline' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {stageCounts.map(({ stage, count }) => (
                <div key={stage} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 leading-tight">{stage.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>

            {/* Funnel visual */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Recruitment Funnel</h3>
              <div className="space-y-2">
                {stageCounts.map(({ stage, count }, i) => {
                  const pct = applications.length ? Math.round((count / applications.length) * 100) : 0;
                  const colors = ['#6366f1','#3b82f6','#0ea5e9','#f59e0b','#a855f7','#10b981','#10b981'];
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-semibold text-gray-600">{stage.replace(/_/g, ' ')}</span>
                        <span className="text-gray-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-6 bg-gray-50 rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg transition-all flex items-center px-2"
                          style={{ width: `${Math.max(pct, 3)}%`, background: colors[i] }}>
                          {count > 0 && <span className="text-white text-[10px] font-bold">{count}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Candidate picker for "Add applicant"; candidates already on this job are shown but can't be picked. */
function AddApplicantForm({ assignedIds, saving, onSubmit }: {
  assignedIds: string[];
  saving: boolean;
  onSubmit: (candidateId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', 'picker', search],
    queryFn: () => api.get('/candidates', { params: { limit: 20, search } }).then(r => r.data),
  });
  const candidates: any[] = data?.data || [];

  return (
    <form onSubmit={e => { e.preventDefault(); if (selected) onSubmit(selected); }} className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone or CV ID…" className="input pl-9" />
      </div>

      <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {isLoading ? (
          <p className="text-center py-8 text-sm text-gray-400">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-400">No candidates found</p>
        ) : candidates.map(c => {
          const assigned = assignedIds.includes(c.id);
          return (
            <label key={c.id}
              className={`flex items-center gap-3 px-3 py-2.5 ${assigned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
              <input type="radio" name="candidate" value={c.id} disabled={assigned}
                checked={selected === c.id} onChange={() => setSelected(c.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{c.firstName} {c.lastName}</p>
                <p className="text-[11px] text-gray-400 truncate">{[c.cvId, c.email].filter(Boolean).join(' · ')}</p>
              </div>
              {assigned && <span className="text-[10px] font-bold text-gray-400 shrink-0">Already added</span>}
            </label>
          );
        })}
      </div>

      <button type="submit" disabled={!selected || saving} className="btn-primary w-full text-sm py-2 disabled:opacity-50">
        {saving ? 'Adding…' : 'Add applicant'}
      </button>
    </form>
  );
}
