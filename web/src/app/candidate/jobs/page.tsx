'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MapPin, Clock, Star, CheckCircle, XCircle, Calendar, AlertCircle, ArrowRight, Search } from 'lucide-react';

const STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: any; desc: string }> = {
  NEW:                 { label: 'Applied',             color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   icon: Clock,         desc: 'Your application has been received.' },
  SCREENING:           { label: 'Under Review',        color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: AlertCircle, desc: 'Our team is reviewing your profile.' },
  SHORTLISTED:         { label: 'Shortlisted',         color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Star,        desc: "Great news! You've been shortlisted." },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Calendar,   desc: 'An interview has been arranged.' },
  INTERVIEWED:         { label: 'Interviewed',         color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: CheckCircle, desc: 'Interview completed. Awaiting decision.' },
  OFFERED:             { label: 'Offer Extended!',     color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: Star,     desc: 'Congratulations! An offer has been made.' },
  JOINED:              { label: 'Placed & Joined',     color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle, desc: "You've successfully joined." },
  REJECTED:            { label: 'Not Selected',        color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: XCircle,     desc: "We'll keep your profile for future roles." },
  ON_HOLD:             { label: 'On Hold',             color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',     icon: Clock,       desc: 'This role is currently on hold.' },
};

const PROGRESS_STEPS = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'JOINED'];

export default function CandidateJobsPage() {
  const { accessToken } = useCandidateAuth();
  const api = candidateApi(accessToken!);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-me'],
    queryFn: () => api.get('/api/candidate-auth/me').then(r => r.data),
    enabled: !!accessToken,
  });

  const apps: any[] = profile?.applications || [];

  const filtered = apps.filter(a => {
    const matchFilter = filter === 'ALL' || a.status === filter;
    const matchSearch = !search ||
      a.job?.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.job?.client?.companyName?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts: Record<string, number> = { ALL: apps.length };
  apps.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Applications</h1>
        <p className="text-gray-500 text-sm mt-1">Track the status of all your job applications</p>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by job or company…" className="input pl-9 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                filter === s ? 'bg-primary-400 text-white border-primary-400' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
              }`}>
              {s === 'ALL' ? `All (${counts.ALL || 0})` : STATUS_INFO[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading applications…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">{search ? 'No results found' : 'No applications yet'}</p>
          <p className="text-xs text-gray-400 mb-5">
            {search ? 'Try a different keyword' : 'Start applying to open positions'}
          </p>
          <Link href="/careers" className="btn-primary text-sm py-2.5 px-5">Browse Jobs <ArrowRight size={14} /></Link>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((app: any) => {
          const s = STATUS_INFO[app.status] || STATUS_INFO['NEW'];
          const Icon = s.icon;
          const progressIdx = PROGRESS_STEPS.indexOf(app.status);

          return (
            <div key={app.id} className={`bg-white rounded-2xl border ${s.bg} overflow-hidden`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-snug">{app.job?.title}</h3>
                    <p className={`text-sm font-semibold mt-0.5 ${s.color}`}>{app.job?.client?.companyName || 'Al Khadim Client'}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      {app.job?.location && (
                        <span className="flex items-center gap-1"><MapPin size={11} /> {app.job.location}</span>
                      )}
                      {app.job?.jobType && (
                        <span className="flex items-center gap-1"><Briefcase size={11} /> {app.job.jobType}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> Applied {new Date(app.appliedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${s.color} ${s.bg}`}>
                    <Icon size={11} /> {s.label}
                  </span>
                </div>

                {/* Progress bar (only for non-terminal statuses) */}
                {!['REJECTED', 'ON_HOLD'].includes(app.status) && progressIdx !== -1 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-0 mb-1.5">
                      {PROGRESS_STEPS.map((step, i) => (
                        <div key={step} className="flex items-center flex-1">
                          <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                            i <= progressIdx ? 'bg-primary-400 border-primary-400' : 'bg-white border-gray-300'
                          }`} />
                          {i < PROGRESS_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 ${i < progressIdx ? 'bg-primary-400' : 'bg-gray-200'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                      <span>Applied</span><span>Review</span><span>Shortlisted</span><span>Interview</span><span>Offer</span><span>Placed</span>
                    </div>
                  </div>
                )}

                <p className={`text-xs ${s.color} bg-white/50 rounded-lg px-3 py-2 border border-current/10`}>{s.desc}</p>

                {app.notes && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <strong>Note from team:</strong> {app.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-6">
          Showing {filtered.length} of {apps.length} applications ·{' '}
          <Link href="/careers" className="text-primary-500 hover:underline">Browse more jobs →</Link>
        </p>
      )}
    </div>
  );
}
