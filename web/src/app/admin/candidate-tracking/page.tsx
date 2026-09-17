'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Link from 'next/link';
import { useTrackingTemplates } from '@/lib/industryTracking';
import { Eye, EyeOff, Users2, User } from 'lucide-react';

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
  { key: 'industry', label: 'Industry', render: (v: any) => v?.name || '—' },
  {
    key: 'visibility', label: 'Visibility',
    render: (v: string, row: any) => v === 'PUBLIC' ? (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><Eye size={10} /> Public</span>
        {row.visibleToCandidate && <User size={12} className="text-gray-400" aria-label="Visible to candidate" />}
        {row.visibleToCompany && <Users2 size={12} className="text-gray-400" aria-label="Visible to company" />}
      </div>
    ) : (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1 w-fit"><EyeOff size={10} /> Private</span>
    ),
  },
  { key: 'updatedByUser', label: 'Updated By', render: (v: any) => v?.name || '—' },
  { key: 'updatedAt', label: 'Last Updated', render: (v: string) => new Date(v).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) },
];

export default function CandidateTrackingListPage() {
  const [page, setPage] = useState(1);
  const [industry, setIndustry] = useState('');
  const { data: templates } = useTrackingTemplates();

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-tracking-list', page, industry],
    queryFn: () => api.get('/candidate-tracking', { params: { page, limit: 20, industry: industry || undefined } }).then(r => r.data),
    staleTime: 0,
  });

  return (
    <DataTable
      title={`Candidate Tracking (${data?.total || 0})`}
      columns={columns}
      data={data?.data || []}
      total={data?.total}
      page={page}
      limit={20}
      isLoading={isLoading}
      onPageChange={setPage}
      extraActions={
        <select value={industry} onChange={e => setIndustry(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
          <option value="">All industries</option>
          {Object.entries(templates || {}).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      }
      actions={(row) => (
        <Link href={`/admin/candidates/${row.candidate.id}?tab=tracking`} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors inline-flex" title="Open tracking">
          <Eye size={14} />
        </Link>
      )}
    />
  );
}
