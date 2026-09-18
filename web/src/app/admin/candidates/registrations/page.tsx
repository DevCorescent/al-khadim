'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { UserCheck, XCircle, ChevronDown, ChevronUp, Eye, FileText } from 'lucide-react';
import TemporaryPasswordPanel, { TemporaryPasswordInfo } from '@/components/admin/TemporaryPasswordPanel';

const STATUS_COLORS: Record<string, string> = {
  NEW:      'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CONVERTED:'bg-emerald-100 text-emerald-700',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

export default function RegistrationsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');

  const { data = [], isLoading } = useQuery({
    queryKey: ['registrations'],
    queryFn: () => api.get('/registrations').then(r => r.data),
  });

  const [tempPassword, setTempPassword] = useState<TemporaryPasswordInfo | null>(null);

  const approveMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean; who?: string }) =>
      api.post(`/registrations/${id}/approve`, { isPublic }).then(r => r.data),
    onSuccess: (res: any, vars) => {
      qc.invalidateQueries({ queryKey: ['registrations'] });
      toast.success('Candidate approved! Portal account created.');
      // Registrations without a password get a random temporary one; show it so staff can pass it on.
      if (res?.temporaryPassword) {
        setTempPassword({
          password: res.temporaryPassword,
          who: vars.who,
          note: 'It was also emailed to the candidate, if email is configured.',
        });
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/registrations/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registrations'] }); toast.success('Registration rejected.'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const filtered = filter === 'ALL' ? data : data.filter((r: any) => r.status === filter);
  const counts: Record<string, number> = { ALL: data.length };
  data.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CV Registrations</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve candidate applications submitted via the website</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['ALL', 'All'], ['NEW', 'Pending'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all ${
              filter === v ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}>
            {l} ({counts[v] || 0})
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Loading…</div>}

      <div className="space-y-3">
        {filtered.map((r: any) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0 font-bold text-primary-600 text-sm">
                {r.firstName?.[0]}{r.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{r.email} · {r.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                  {r.status}
                </span>
                <span className="text-xs text-gray-400 hidden sm:block">{new Date(r.createdAt).toLocaleDateString()}</span>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  {expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === r.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {[
                    ['Nationality', r.nationality],
                    ['Location', r.currentLocation],
                    ['Experience', r.experience ? `${r.experience} yrs` : null],
                    ['LinkedIn', r.linkedIn],
                    ['Headline', r.headline],
                  ].map(([label, value]) => value ? (
                    <div key={label as string} className="bg-white rounded-xl border border-gray-100 p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-sm text-gray-700 font-medium truncate">{value}</p>
                    </div>
                  ) : null)}
                </div>

                {r.skills && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.skills.split(',').map((s: string) => s.trim()).filter(Boolean).map((s: string) => (
                        <span key={s} className="text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100 px-2.5 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {r.summary && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Summary</p>
                    <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-xl border border-gray-100 p-3">{r.summary}</p>
                  </div>
                )}

                {/* Parsed Data (raw from CV) */}
                {r.parsedData && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Raw CV Parsed Data</p>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(r.parsedData as Record<string, any>)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([k, v]) => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0) ? (
                          <div key={k} className="bg-white/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-blue-400 font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
                            <span className="text-gray-700">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                          </div>
                        ) : null)}
                    </div>
                  </div>
                )}

                {r.education && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Education</p>
                    <p className="text-sm text-gray-600 bg-white rounded-xl border border-gray-100 p-3">{r.education}</p>
                  </div>
                )}

                {/* CV link */}
                {r.cvPath && (
                  <a href={`${API_URL}/${r.cvPath}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-primary-500 bg-primary-50 border border-primary-100 px-3 py-2 rounded-xl hover:bg-primary-100 transition-colors">
                    <FileText size={13} /> View CV / Resume
                  </a>
                )}

                {/* Actions */}
                {r.status === 'NEW' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => { if (confirm(`Approve ${r.firstName} ${r.lastName} and create their portal account?`)) approveMutation.mutate({ id: r.id, isPublic: true, who: `${r.firstName} ${r.lastName} (${r.email})` }); }}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <UserCheck size={13} /> Approve & Make Public
                    </button>
                    <button
                      onClick={() => { if (confirm(`Approve ${r.firstName} as private (not shown on public page)?`)) approveMutation.mutate({ id: r.id, isPublic: false, who: `${r.firstName} ${r.lastName} (${r.email})` }); }}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <UserCheck size={13} /> Approve (Private)
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for rejection (optional):');
                        if (reason === null) return; // cancelled — don't reject
                        rejectMutation.mutate({ id: r.id, reason });
                      }}
                      disabled={rejectMutation.isPending}
                      className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                )}

                {r.status === 'APPROVED' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <UserCheck size={14} /> Portal account created. Candidate can log in.
                    {r.convertedTo && <span className="text-gray-400 ml-2">ID: {r.convertedTo}</span>}
                  </div>
                )}

                {r.notes && r.status === 'REJECTED' && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    Rejection reason: {r.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No registrations found.</div>
        )}
      </div>
      <TemporaryPasswordPanel info={tempPassword} onClose={() => setTempPassword(null)} />
    </div>
  );
}
