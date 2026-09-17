'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Link from 'next/link';
import { Eye } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DOWNLOADED: 'bg-purple-100 text-purple-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  INTERVIEW_REQUESTED: 'bg-amber-100 text-amber-700',
  INTERVIEW_SCHEDULED: 'bg-indigo-100 text-indigo-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

const STATUSES = ['SENT', 'VIEWED', 'DOWNLOADED', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED', 'WITHDRAWN'];

const columns = [
  {
    key: 'candidate', label: 'Candidate',
    render: (v: any) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
          {v?.firstName?.[0]}{v?.lastName?.[0]}
        </div>
        <span className="font-semibold text-gray-800">{v?.firstName} {v?.lastName}</span>
      </div>
    ),
    exportValue: (r: any) => `${r.candidate?.firstName || ''} ${r.candidate?.lastName || ''}`.trim(),
  },
  { key: 'client', label: 'Company', render: (v: any) => v?.companyName || '—', exportValue: (r: any) => r.client?.companyName || '' },
  { key: 'job', label: 'Job', render: (v: any) => v?.title || <span className="text-gray-400">General</span> },
  { key: 'method', label: 'Method' },
  {
    key: 'status', label: 'Status',
    render: (v: string) => <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[v] || 'bg-gray-100 text-gray-600'}`}>{v?.replace(/_/g, ' ')}</span>,
  },
  { key: 'sentByUser', label: 'Sent By', render: (v: any) => v?.name || '—' },
  { key: 'sentAt', label: 'Sent', render: (v: string) => new Date(v).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) },
];

export default function ProfileSharesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['profile-shares-list', page, status],
    queryFn: () => api.get('/profile-shares', { params: { page, limit: 20, status: status || undefined } }).then(r => r.data),
    staleTime: 0,
    refetchInterval: 20000,
  });

  return (
    <DataTable
      title={`Profile Shares (${data?.total || 0})`}
      columns={columns}
      data={data?.data || []}
      total={data?.total}
      page={page}
      limit={20}
      isLoading={isLoading}
      onPageChange={setPage}
      onAdd={() => router.push('/admin/profile-shares/bulk')}
      addLabel="Bulk Share"
      extraActions={
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      }
      actions={(row) => (
        <Link href={`/admin/profile-shares/${row.id}`} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors inline-flex" title="View timeline">
          <Eye size={14} />
        </Link>
      )}
    />
  );
}
