'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import { useQuery } from '@tanstack/react-query';
import { Users2, Search } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  VIEWED: { label: 'Viewed', color: 'bg-indigo-100 text-indigo-700' },
  DOWNLOADED: { label: 'Downloaded', color: 'bg-purple-100 text-purple-700' },
  SHORTLISTED: { label: 'Shortlisted', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  INTERVIEW_REQUESTED: { label: 'Interview Requested', color: 'bg-amber-100 text-amber-700' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'bg-indigo-100 text-indigo-700' },
};

export default function CompanyCandidatesPage() {
  const { accessToken } = useClientAuth();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data: shares, isLoading } = useQuery({
    queryKey: ['company-shares-all', status],
    queryFn: () => clientApi(accessToken!).get('/api/profile-shares/mine', { params: { status: status || undefined } }).then(r => r.data),
    enabled: !!accessToken,
    staleTime: 0,
    refetchInterval: 20000,
  });

  const filtered = (shares || []).filter((s: any) => {
    if (!search) return true;
    const name = [s.snapshotData?.fields?.firstName, s.snapshotData?.fields?.lastName].filter(Boolean).join(' ').toLowerCase();
    return name.includes(search.toLowerCase()) || (s.job?.title || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Shared Candidates</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Users2 size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No candidates found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s: any) => {
            const status = STATUS_LABELS[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-600' };
            const name = [s.snapshotData?.fields?.firstName, s.snapshotData?.fields?.lastName].filter(Boolean).join(' ') || 'Candidate';
            return (
              <Link key={s.id} href={`/company/candidates/${s.id}`} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3 hover:border-primary-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 text-sm font-bold flex items-center justify-center shrink-0">
                    {name[0] || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.job?.title || 'General profile'} · {new Date(s.sentAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>{status.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
