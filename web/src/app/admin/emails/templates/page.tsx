'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import DataTable from '@/components/admin/DataTable';
import { RECIPIENT_TYPES } from '@/components/admin/email/AudiencePicker';
import { Pencil, Copy, Power, Trash2 } from 'lucide-react';

const CATEGORIES = ['TRANSACTIONAL', 'CAMPAIGN'];
const CATEGORY_COLORS: Record<string, string> = {
  TRANSACTIONAL: 'bg-blue-100 text-blue-700',
  CAMPAIGN: 'bg-purple-100 text-purple-700',
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category', render: (v: string) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[v] || 'bg-gray-100 text-gray-600'}`}>{v}</span> },
  { key: 'module', label: 'Module', render: (v: string) => <span className="font-mono text-xs text-gray-500">{v}</span> },
  { key: 'recipientType', label: 'Recipient Type', render: (v: string) => v ? (RECIPIENT_TYPES.find(rt => rt.value === v)?.label || v) : '—' },
  { key: 'updatedAt', label: 'Updated', render: (v: string) => new Date(v).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) },
  {
    key: 'isActive', label: 'Active',
    render: (v: boolean) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{v ? 'Active' : 'Inactive'}</span>,
  },
];

export default function TemplatesListPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [recipientType, setRecipientType] = useState('');

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ['email-templates', search, category, recipientType],
    queryFn: () => api.get('/emails/templates', {
      params: { search: search || undefined, category: category || undefined, recipientType: recipientType || undefined },
    }).then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['email-templates'] });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.post(`/emails/templates/${id}/duplicate`, {}),
    onSuccess: () => { toast.success('Template duplicated'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to duplicate'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/emails/templates/${id}`, { isActive }),
    onSuccess: () => { toast.success('Template updated'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/emails/templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  return (
    <DataTable
      title={`Templates (${templates.length})`}
      columns={columns}
      data={templates}
      isLoading={isLoading}
      onSearch={setSearch}
      onAdd={() => router.push('/admin/emails/templates/new')}
      addLabel="New Template"
      extraActions={
        <div className="flex items-center gap-2">
          <select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={recipientType} onChange={e => setRecipientType(e.target.value)} className="border border-gray-200 rounded-lg text-sm px-3 py-2">
            <option value="">All recipient types</option>
            {RECIPIENT_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
          </select>
        </div>
      }
      actions={(row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => router.push(`/admin/emails/templates/${row.id}/edit`)} title="Edit"
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => duplicate.mutate(row.id)} title="Duplicate" disabled={duplicate.isPending}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
            <Copy size={13} />
          </button>
          <button onClick={() => toggleActive.mutate({ id: row.id, isActive: !row.isActive })}
            title={row.isActive ? 'Deactivate' : 'Activate'} disabled={toggleActive.isPending}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${row.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
            <Power size={13} />
          </button>
          <button
            onClick={() => {
              if (row.category !== 'CAMPAIGN') return;
              if (confirm(`Delete template "${row.name}"? This cannot be undone.`)) remove.mutate(row.id);
            }}
            disabled={row.category !== 'CAMPAIGN'}
            title={row.category === 'CAMPAIGN' ? 'Delete' : 'Transactional templates must be deactivated, not deleted'}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    />
  );
}
