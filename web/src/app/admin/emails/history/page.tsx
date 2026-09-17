'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import { Clock, CheckCircle, AlertCircle, XCircle, Send, Mail, Megaphone } from 'lucide-react';

const LIMIT = 20;

const STATUSES = ['PENDING', 'SENT', 'FAILED', 'CANCELLED'];

const SOURCE_TABS: { value: 'all' | 'transactional' | 'compose' | 'campaign'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'compose', label: 'Compose' },
  { value: 'campaign', label: 'Campaign' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  SENT:      'bg-emerald-100 text-emerald-700',
  FAILED:    'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const STATUS_ICONS: Record<string, any> = { PENDING: Clock, SENT: CheckCircle, FAILED: AlertCircle, CANCELLED: XCircle };

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      <Icon size={10} /> {status}
    </span>
  );
}

/** Derived client-side per the contract: campaignId present -> Campaign; else createdBy present -> Compose; else Transactional. */
function deriveSource(row: any): 'campaign' | 'compose' | 'transactional' {
  if (row.campaignId) return 'campaign';
  if (row.createdBy) return 'compose';
  return 'transactional';
}

const SOURCE_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  campaign:      { label: 'Campaign',      className: 'bg-purple-100 text-purple-700', icon: Megaphone },
  compose:       { label: 'Compose',       className: 'bg-blue-100 text-blue-700',      icon: Mail },
  transactional: { label: 'Transactional', className: 'bg-gray-100 text-gray-600',      icon: Send },
};

function SourceBadge({ row }: { row: any }) {
  const source = deriveSource(row);
  const meta = SOURCE_BADGE[source];
  const Icon = meta.icon;
  const badge = (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.className}`}>
      <Icon size={10} /> {meta.label}
    </span>
  );
  if (source === 'campaign' && row.campaignId) {
    return (
      <Link href={`/admin/emails/campaigns/${row.campaignId}`} className="hover:opacity-80 inline-flex" title={row.campaign?.name || 'View campaign'}>
        {badge}
      </Link>
    );
  }
  return badge;
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function EmailHistoryPage() {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<'all' | 'transactional' | 'compose' | 'campaign'>('all');
  const [status, setStatus] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: identities = [] } = useQuery<any[]>({
    queryKey: ['email-identities'],
    queryFn: () => api.get('/emails/identities').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['email-history', page, source, status, module, from, to, search],
    queryFn: () => api.get('/emails/scheduled', {
      params: {
        page,
        limit: LIMIT,
        status: status || undefined,
        module: module || undefined,
        source: source === 'all' ? undefined : source,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      },
    }).then(r => r.data),
  });

  const rows = data?.data || [];
  const total = data?.total ?? rows.length;

  const columns = [
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} />, exportValue: (r: any) => r.status },
    {
      key: 'source', label: 'Source',
      render: (_: any, row: any) => <SourceBadge row={row} />,
      exportValue: (row: any) => SOURCE_BADGE[deriveSource(row)].label,
    },
    { key: 'module', label: 'Module' },
    { key: 'to', label: 'To' },
    {
      key: 'subject', label: 'Subject',
      render: (v: string) => <span className="max-w-[220px] truncate inline-block align-bottom" title={v}>{v}</span>,
    },
    {
      key: 'sendAt', label: 'Sent / Send Time',
      render: (_: any, row: any) => fmtDate(row.sentAt || row.sendAt),
      exportValue: (row: any) => row.sentAt || row.sendAt ? new Date(row.sentAt || row.sendAt).toLocaleString('en-AE') : '',
    },
    {
      key: 'error', label: 'Error',
      render: (v: string | null, row: any) => row.status === 'FAILED' && v
        ? <span className="max-w-[180px] truncate inline-block align-bottom text-red-500 text-xs" title={v}>{v}</span>
        : '—',
    },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {SOURCE_TABS.map(t => (
            <button key={t.value} type="button"
              onClick={() => { setSource(t.value); setPage(1); }}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
                source === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={module} onChange={e => { setModule(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All modules</option>
            {identities.map(i => <option key={i.module} value={i.module}>{i.name}</option>)}
          </select>

          <div className="flex items-center gap-1.5 text-sm">
            <label className="text-xs text-gray-400 font-semibold">From</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg text-sm px-2.5 py-1.5" />
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <label className="text-xs text-gray-400 font-semibold">To</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg text-sm px-2.5 py-1.5" />
          </div>
        </div>
      </div>

      <DataTable
        title={`History (${total})`}
        columns={columns}
        data={rows}
        total={total}
        page={page}
        limit={LIMIT}
        isLoading={isLoading}
        onSearch={setSearchInput}
        onPageChange={setPage}
        exportFilename="email-history"
      />
    </div>
  );
}
