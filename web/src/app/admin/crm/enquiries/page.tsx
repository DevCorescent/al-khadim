'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  CONVERTED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const columns = [
  { key: 'companyName', label: 'Company' },
  { key: 'contactName', label: 'Contact', render: (v: string, row: any) => (
    <div>
      <p>{v}</p>
      {row.designation && <p className="text-xs text-gray-400">{row.designation}</p>}
    </div>
  ), exportValue: (r: any) => r.designation ? `${r.contactName} (${r.designation})` : r.contactName },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'service', label: 'Service Required' },
  { key: 'message', label: 'Message', render: (v: string) => v ? v.slice(0, 60) + (v.length > 60 ? '...' : '') : '—' },
  { key: 'status', label: 'Status', render: (v: string) => <span className={`badge ${STATUS_COLORS[v] || 'bg-gray-100'}`}>{v}</span> },
  { key: 'createdAt', label: 'Date', render: (v: string) => new Date(v).toLocaleDateString() },
];

export default function EnquiriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['enquiries'],
    queryFn: () => api.get('/enquiries').then(r => r.data),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => api.put(`/enquiries/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enquiries'] }); toast.success('Status updated'); },
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.post(`/enquiries/${id}/convert`).then(r => r.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] });
      toast.success(`Converted — deal "${result.deal?.title}" created`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to convert enquiry'),
  });

  return (
    <DataTable
      title={`Client Enquiries (${data?.length || 0})`}
      columns={columns}
      data={data || []}
      isLoading={isLoading}
      actions={(row) => (
        <div className="flex items-center gap-2">
          <select
            value={row.status}
            onChange={e => update.mutate({ id: row.id, status: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
          >
            {['NEW', 'IN_PROGRESS', 'CONVERTED', 'CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => convert.mutate(row.id)}
            disabled={row.status === 'CONVERTED' || convert.isPending}
            className="text-xs font-bold text-primary-500 border border-primary-200 rounded-lg px-2 py-1 hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            Convert to Deal
          </button>
        </div>
      )}
    />
  );
}
