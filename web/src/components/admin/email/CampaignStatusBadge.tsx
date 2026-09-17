import { Clock, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING:   'bg-amber-100 text-amber-700',
  SENT:      'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const CAMPAIGN_STATUS_ICONS: Record<string, any> = {
  DRAFT: Clock,
  SCHEDULED: Send,
  SENDING: Loader2,
  SENT: CheckCircle,
  CANCELLED: XCircle,
};

export default function CampaignStatusBadge({ status }: { status: string }) {
  const Icon = CAMPAIGN_STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${CAMPAIGN_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      <Icon size={10} className={status === 'SENDING' ? 'animate-spin' : undefined} />
      {status}
    </span>
  );
}
