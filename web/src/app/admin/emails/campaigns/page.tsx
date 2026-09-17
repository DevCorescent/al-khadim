'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import CampaignStatusBadge from '@/components/admin/email/CampaignStatusBadge';
import { RECIPIENT_TYPES } from '@/components/admin/email/AudiencePicker';
import { Eye } from 'lucide-react';

const STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'];

const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const columns = [
  { key: 'name', label: 'Name' },
  {
    key: 'recipientType', label: 'Recipient Type',
    render: (v: string) => RECIPIENT_TYPES.find(rt => rt.value === v)?.label || v,
  },
  { key: 'status', label: 'Status', render: (v: string) => <CampaignStatusBadge status={v} /> },
  { key: 'totalRecipients', label: 'Total' },
  { key: 'sentCount', label: 'Sent' },
  { key: 'failedCount', label: 'Failed' },
  {
    key: 'scheduledAt', label: 'Scheduled / Sent',
    render: (_: any, row: any) => fmtDate(row.sentAt || row.scheduledAt),
  },
  { key: 'updatedAt', label: 'Updated', render: (v: string) => fmtDate(v) },
];

export default function CampaignsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [recipientType, setRecipientType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['email-campaigns', page, status, recipientType],
    queryFn: () => api.get('/emails/campaigns', {
      params: { page, limit: 20, status: status || undefined, recipientType: recipientType || undefined },
    }).then(r => r.data),
  });

  return (
    <DataTable
      title={`Campaigns (${data?.total || 0})`}
      columns={columns}
      data={data?.data || []}
      total={data?.total}
      page={page}
      limit={20}
      isLoading={isLoading}
      onPageChange={setPage}
      onAdd={() => router.push('/admin/emails/campaigns/new')}
      addLabel="New Campaign"
      extraActions={
        <div className="flex items-center gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={recipientType} onChange={e => setRecipientType(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All recipient types</option>
            {RECIPIENT_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
          </select>
        </div>
      }
      actions={(row) => (
        <Link href={`/admin/emails/campaigns/${row.id}`} className="p-1.5 hover:bg-primary-50 rounded-lg text-primary-600 transition-colors inline-flex" title="View campaign">
          <Eye size={14} />
        </Link>
      )}
    />
  );
}
