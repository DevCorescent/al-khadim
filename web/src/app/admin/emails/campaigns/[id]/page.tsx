'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from '@/components/admin/Modal';
import CampaignStatusBadge from '@/components/admin/email/CampaignStatusBadge';
import { RECIPIENT_TYPES } from '@/components/admin/email/AudiencePicker';
import { ArrowLeft, Pencil, Ban, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';

const EMAIL_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  SENT:      'bg-emerald-100 text-emerald-700',
  FAILED:    'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const EMAIL_STATUS_ICONS: Record<string, any> = { PENDING: Clock, SENT: CheckCircle, FAILED: AlertCircle, CANCELLED: XCircle };

const fmtDate = (v?: string | null) => v ? new Date(v).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const qc = useQueryClient();
  const id = params.id as string;
  const [page, setPage] = useState(1);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['email-campaign', id, page],
    queryFn: () => api.get(`/emails/campaigns/${id}`, { params: { page, limit: 20 } }).then(r => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'SENDING' ? 5000 : false),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/emails/campaigns/${id}/cancel`),
    onSuccess: () => {
      toast.success('Campaign cancelled');
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ['email-campaign', id] });
      qc.invalidateQueries({ queryKey: ['email-campaigns'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to cancel'),
  });

  if (isLoading || !campaign) {
    return <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>;
  }

  const breakdown: { status: string; _count: number }[] = campaign.recipientBreakdown || [];
  const scheduled = campaign.scheduledEmails || { data: [], total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil(scheduled.total / scheduled.limit);
  const canCancel = campaign.status === 'SCHEDULED' || campaign.status === 'SENDING';

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/emails/campaigns')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-gray-400">{campaign.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'DRAFT' && (
            <button onClick={() => router.push(`/admin/emails/campaigns/${id}/edit`)}
              className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <Pencil size={13} /> Edit
            </button>
          )}
          {canCancel && (
            <button onClick={() => setCancelOpen(true)}
              className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5">
              <Ban size={13} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Recipient Type" value={RECIPIENT_TYPES.find(rt => rt.value === campaign.recipientType)?.label || campaign.recipientType} />
        <StatTile label="Total Recipients" value={campaign.totalRecipients ?? 0} />
        <StatTile label="Sent" value={campaign.sentCount ?? 0} />
        <StatTile label="Failed" value={campaign.failedCount ?? 0} />
      </div>

      {breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recipient Status Breakdown</h3>
          <div className="flex flex-wrap gap-2">
            {breakdown.map(b => (
              <span key={b.status} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${EMAIL_STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                {b.status}: {b._count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <StatTile label="Scheduled For" value={fmtDate(campaign.scheduledAt)} />
        <StatTile label="Sent At" value={fmtDate(campaign.sentAt)} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Recipients</h3>
          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{scheduled.total}</span>
        </div>
        {scheduled.data.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No recipients yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Recipient</th>
                  <th className="px-4 py-2">To</th>
                  <th className="px-4 py-2">Error</th>
                  <th className="px-4 py-2">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scheduled.data.map((e: any, i: number) => {
                  const Icon = EMAIL_STATUS_ICONS[e.status] || Clock;
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${EMAIL_STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>
                          <Icon size={10} /> {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{e.recipientName || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{e.to}</td>
                      <td className="px-4 py-2.5 text-xs text-red-500 max-w-[220px] truncate">{e.error || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDate(e.sentAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Campaign" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          This cancels all remaining pending sends for &ldquo;{campaign.name}&rdquo;. Emails already sent are not affected. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setCancelOpen(false)} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Keep Campaign
          </button>
          <button onClick={() => cancel.mutate()} disabled={cancel.isPending}
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-60">
            {cancel.isPending ? 'Cancelling…' : 'Cancel Campaign'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
