'use client';
import { useCandidateAuth, candidateApi } from '@/lib/candidateAuth';
import { useQuery } from '@tanstack/react-query';
import { Share2, Building2 } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Shared', color: 'bg-blue-100 text-blue-700' },
  VIEWED: { label: 'Viewed by Company', color: 'bg-indigo-100 text-indigo-700' },
  DOWNLOADED: { label: 'Downloaded', color: 'bg-purple-100 text-purple-700' },
  SHORTLISTED: { label: 'Shortlisted', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Not Selected', color: 'bg-red-100 text-red-700' },
  INTERVIEW_REQUESTED: { label: 'Interview Requested', color: 'bg-amber-100 text-amber-700' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'bg-indigo-100 text-indigo-700' },
};

export default function SharedWithPage() {
  const { accessToken } = useCandidateAuth();

  const { data: shares, isLoading } = useQuery({
    queryKey: ['candidate-shares'],
    queryFn: () => candidateApi(accessToken!).get('/api/candidate-auth/me/shares').then(r => r.data),
    enabled: !!accessToken,
    staleTime: 0,
  });

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shared With</h1>
        <p className="text-gray-500 text-sm mt-1">Companies your profile has been shared with</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (shares || []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <Share2 size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Not shared yet</p>
          <p className="text-xs text-gray-400 mt-1">When Al Khadim shares your profile with a company, it'll show up here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shares.map((s: any) => {
            const status = STATUS_LABELS[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-600' };
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.client?.companyName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.job?.title || 'General profile'} · {new Date(s.sentAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>{status.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
