'use client';
import Link from 'next/link';
import { useClientAuth, clientApi } from '@/lib/clientAuth';
import { useQuery } from '@tanstack/react-query';
import { Users2, Star, Calendar, Clock, ArrowRight, CalendarCheck } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  VIEWED: { label: 'Viewed', color: 'bg-indigo-100 text-indigo-700' },
  DOWNLOADED: { label: 'Downloaded', color: 'bg-purple-100 text-purple-700' },
  SHORTLISTED: { label: 'Shortlisted', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  INTERVIEW_REQUESTED: { label: 'Interview Requested', color: 'bg-amber-100 text-amber-700' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'bg-indigo-100 text-indigo-700' },
};

export default function CompanyDashboard() {
  const { clientUser, accessToken } = useClientAuth();

  const { data: shares } = useQuery({
    queryKey: ['company-shares'],
    queryFn: () => clientApi(accessToken!).get('/api/profile-shares/mine').then(r => r.data),
    enabled: !!accessToken,
    staleTime: 0,
    refetchInterval: 20000,
  });

  const list = shares || [];
  const stats = [
    { label: 'Total Shared', value: list.length, icon: Users2, color: 'text-blue-500 bg-blue-50' },
    { label: 'New', value: list.filter((s: any) => s.status === 'SENT').length, icon: Clock, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Shortlisted', value: list.filter((s: any) => s.status === 'SHORTLISTED').length, icon: Star, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Interview Requests', value: list.filter((s: any) => s.status === 'INTERVIEW_REQUESTED').length, icon: Calendar, color: 'text-amber-500 bg-amber-50' },
    { label: 'Interviews Scheduled', value: list.filter((s: any) => s.status === 'INTERVIEW_SCHEDULED').length, icon: CalendarCheck, color: 'text-indigo-500 bg-indigo-50' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome, {clientUser?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Candidate profiles shared with {clientUser?.client?.companyName}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">Recent Shares</h2>
        <Link href="/company/candidates" className="text-xs text-primary-500 font-semibold flex items-center gap-1 hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <Users2 size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No profiles shared yet</p>
          <p className="text-xs text-gray-400 mt-1">Al Khadim will share candidate profiles with you here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.slice(0, 5).map((s: any) => {
            const status = STATUS_LABELS[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-600' };
            const name = [s.snapshotData?.fields?.firstName, s.snapshotData?.fields?.lastName].filter(Boolean).join(' ') || 'Candidate';
            return (
              <Link key={s.id} href={`/company/candidates/${s.id}`} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3 hover:border-primary-200 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.job?.title || 'General profile'}</p>
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
