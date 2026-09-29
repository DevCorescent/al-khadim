'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, Search, UserCog, ExternalLink, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const TABS = [
  { key: 'PENDING',   label: 'Pending' },
  { key: 'APPROVED',  label: 'Approved' },
  { key: 'REJECTED',  label: 'Rejected' },
  { key: 'WITHDRAWN', label: 'Withdrawn' },
  { key: '',          label: 'All' },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:  'bg-red-50 text-red-600 border-red-200',
  WITHDRAWN: 'bg-gray-100 text-gray-500 border-gray-200',
};

const LABELS: Record<string, string> = {
  firstName: 'First name', lastName: 'Last name', phone: 'Phone',
  headline: 'Headline', summary: 'Summary', nationality: 'Nationality',
  currentLocation: 'Location', visaStatus: 'Visa status', experience: 'Experience (yrs)',
  skills: 'Skills', languages: 'Languages', education: 'Education',
  linkedIn: 'LinkedIn', portfolio: 'Portfolio', introVideoUrl: 'Intro video',
  cvPath: 'CV', photo: 'Photo',
  currentSalary: 'Current salary', expectedSalary: 'Expected salary', currency: 'Currency',
};

const fmtDate = (d: string) => new Date(d).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function show(v: any) {
  if (v === null || v === undefined || v === '') return <span className="text-gray-300">—</span>;
  if (Array.isArray(v)) return v.length ? v.join(', ') : <span className="text-gray-300">—</span>;
  return String(v);
}

function FileValue({ path, isPhoto }: { path: string | null; isPhoto: boolean }) {
  if (!path) return <span className="text-gray-300">—</span>;
  const url = `${API_URL}/${path}`;
  return isPhoto
    ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" /></a>
    : <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-500 hover:underline"><FileText size={12} /> Open CV</a>;
}

export default function ProfileChangesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['profile-changes', status, search],
    queryFn: () => api.get('/profile-changes', { params: { status: status || undefined, search: search || undefined, limit: 50 } }).then(r => r.data),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.post(`/profile-changes/${id}/${action}`, { note: notes[id] || undefined }),
    onSuccess: (_r, { action }) => {
      toast.success(action === 'approve' ? 'Approved: the profile is updated and the candidate was notified' : 'Rejected: the candidate was notified');
      qc.invalidateQueries({ queryKey: ['profile-changes'] });
      qc.invalidateQueries({ queryKey: ['profile-changes-count'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Action failed'),
  });

  const rows: any[] = data?.data || [];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
            <UserCog size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Profile Approvals</h1>
            <p className="text-xs text-gray-400">Candidate profile changes wait here until a Super Admin approves them</p>
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, CV ID"
            className="border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm bg-white w-64 focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key || 'all'} onClick={() => setStatus(t.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              status === t.key ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
            {t.label}{t.key === 'PENDING' && data?.pendingCount ? ` (${data.pendingCount})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !rows.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
          <p className="text-sm font-semibold text-gray-700 mt-2">{status === 'PENDING' ? 'All caught up' : 'Nothing here'}</p>
          <p className="text-xs text-gray-400 mt-1">{status === 'PENDING' ? 'No profile changes are waiting for approval.' : 'No requests match this filter.'}</p>
        </div>
      ) : (
        <div className="grid 2xl:grid-cols-2 gap-4">
          {rows.map(r => {
            const c = r.candidate;
            const changes: Record<string, { old: any; new: any }> = r.changes || {};
            const pending = r.status === 'PENDING';
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/candidates/${c.id}`} className="font-bold text-gray-900 hover:text-primary-500 inline-flex items-center gap-1">
                      {c.firstName} {c.lastName} <ExternalLink size={11} />
                    </Link>
                    <p className="text-xs text-gray-400">{c.email}{c.cvId && <> · {c.cvId}</>}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={11} /> {fmtDate(r.createdAt)}</span>
                </div>

                <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <span className="font-bold text-gray-500">Reason: </span>{r.reason}
                </div>

                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[120px_1fr_1fr] gap-3 px-3 py-1.5 bg-gray-50 text-[10px] font-bold uppercase text-gray-400">
                    <span>Field</span><span>Current</span><span>Requested</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {Object.entries(changes).map(([f, v]) => (
                      <div key={f} className="grid grid-cols-[120px_1fr_1fr] gap-3 px-3 py-2 text-xs items-start">
                        <span className="font-semibold text-gray-500">{LABELS[f] || f}</span>
                        <span className="text-gray-500 break-words">
                          {f === 'cvPath' || f === 'photo' ? <FileValue path={v.old} isPhoto={f === 'photo'} /> : show(v.old)}
                        </span>
                        <span className="text-emerald-700 font-medium break-words">
                          {f === 'cvPath' || f === 'photo'
                            ? (r.status === 'REJECTED' || r.status === 'WITHDRAWN' ? <span className="text-gray-400">File discarded</span> : <FileValue path={v.new} isPhoto={f === 'photo'} />)
                            : show(v.new)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {pending ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Note to candidate (required to reject)" maxLength={1000}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                    <button onClick={() => {
                        if (!notes[r.id]?.trim()) { toast.error('Add a note so the candidate knows why'); return; }
                        decide.mutate({ id: r.id, action: 'reject' });
                      }}
                      disabled={decide.isPending}
                      className="flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-50">
                      <XCircle size={14} /> Reject
                    </button>
                    <button onClick={() => decide.mutate({ id: r.id, action: 'approve' })} disabled={decide.isPending}
                      className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-50">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  </div>
                ) : r.reviewedAt && (
                  <p className="text-[11px] text-gray-400">
                    {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {r.reviewedBy?.name || 'a Super Admin'} on {fmtDate(r.reviewedAt)}
                    {r.reviewNote && <> · <span className="text-gray-600">&ldquo;{r.reviewNote}&rdquo;</span></>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
