'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Building2, Mail, Phone, Briefcase, MessageSquare, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Eye, ExternalLink } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

const STATUS_STYLES: Record<string, string> = {
  NEW:        'bg-blue-50 text-blue-700 border-blue-200',
  REVIEWING:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  CONNECTED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED:     'bg-gray-100 text-gray-500 border-gray-200',
  REJECTED:   'bg-red-50 text-red-600 border-red-200',
};

const STATUSES = ['NEW', 'REVIEWING', 'CONNECTED', 'CLOSED', 'REJECTED'];

export default function ProfileRequestsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ['profile-requests'],
    queryFn: () => api.get('/candidates/profile-requests').then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.put(`/candidates/profile-requests/${id}`, { status, adminNotes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-requests'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Update failed'),
  });

  const filtered = filter === 'ALL' ? data : data.filter((r: any) => r.status === filter);
  const counts: Record<string, number> = { ALL: data.length };
  data.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Profile Requests</h1>
        <p className="text-gray-500 text-sm mt-1">Recruiters and companies requesting candidate profiles from the talent pool</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', key: 'ALL', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { label: 'New', key: 'NEW', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Reviewing', key: 'REVIEWING', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
          { label: 'Connected', key: 'CONNECTED', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
        ].map(({ label, key, color, bg }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`border rounded-2xl p-4 text-left transition-all ${bg} ${filter === key ? 'ring-2 ring-primary-300' : ''}`}>
            <p className={`text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['ALL', ...STATUSES] as string[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              filter === s ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}>
            {s === 'ALL' ? `All (${counts.ALL || 0})` : s}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading…</div>}

      <div className="space-y-3">
        {filtered.map((r: any) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-4 p-4">
              {/* Candidate preview */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {r.candidate?.photo
                  ? <img src={`${API_URL}/${r.candidate.photo}`} className="w-full h-full object-cover rounded-xl" alt="" />
                  : `${r.candidate?.firstName?.[0]}${r.candidate?.lastName?.[0]}`}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">
                    {r.requesterName} <span className="text-gray-400 font-normal">from</span> {r.companyName}
                  </p>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  Requested: <span className="font-semibold text-gray-700">{r.candidate?.firstName} {r.candidate?.lastName}</span>
                  {r.candidate?.headline && <span className="text-gray-400"> · {r.candidate.headline}</span>}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[r.status] || STATUS_STYLES.NEW}`}>
                  {r.status}
                </span>
                <span className="text-xs text-gray-400 hidden sm:block">{new Date(r.createdAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  {expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Expanded */}
            {expanded === r.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
                {/* Requester details */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requester Details</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 size={13} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-800">{r.companyName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={13} className="text-gray-400 shrink-0" />
                      <a href={`mailto:${r.email}`} className="text-primary-500 hover:underline">{r.email}</a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={13} className="text-gray-400 shrink-0" />
                      <a href={`tel:${r.phone}`} className="text-gray-700">{r.phone}</a>
                    </div>
                    {r.position && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase size={13} className="text-gray-400 shrink-0" />
                        <span className="text-gray-700">{r.position}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested Candidate</p>
                    <Link href={`/admin/candidates/${r.candidateId}`}
                      className="flex items-center gap-3 hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {r.candidate?.firstName?.[0]}{r.candidate?.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{r.candidate?.firstName} {r.candidate?.lastName}</p>
                        {r.candidate?.headline && <p className="text-xs text-gray-500 truncate">{r.candidate.headline}</p>}
                      </div>
                      <ExternalLink size={12} className="text-gray-300 group-hover:text-primary-400 transition-colors shrink-0" />
                    </Link>
                  </div>
                </div>

                {/* Message */}
                {r.message && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <MessageSquare size={10} /> Message from Recruiter
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{r.message}</p>
                  </div>
                )}

                {/* Admin notes + status update */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin Actions</p>
                  <textarea
                    className="input text-sm h-20 resize-none w-full"
                    placeholder="Internal notes (not visible to requester)…"
                    value={adminNotes[r.id] ?? (r.adminNotes || '')}
                    onChange={e => setAdminNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateMutation.mutate({ id: r.id, status: s, notes: adminNotes[r.id] ?? r.adminNotes })}
                        disabled={updateMutation.isPending}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50 ${
                          r.status === s
                            ? (STATUS_STYLES[s] || 'bg-gray-100 text-gray-600 border-gray-200') + ' ring-2 ring-offset-1 ring-primary-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                        }`}>
                        {s === 'NEW' && <Clock size={10} className="inline mr-1" />}
                        {s === 'CONNECTED' && <CheckCircle size={10} className="inline mr-1" />}
                        {s === 'REJECTED' && <XCircle size={10} className="inline mr-1" />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Eye size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No profile requests yet</p>
            <p className="text-xs text-gray-400 mt-1">Requests submitted from the candidates page will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
