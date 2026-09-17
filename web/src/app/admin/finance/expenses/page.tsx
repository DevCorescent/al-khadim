'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useSettings } from '@/lib/useSettings';
import {
  Plus, Search, Receipt, CheckCircle2, Clock, Hash, Eye, Pencil,
} from 'lucide-react';
import DataTable from '@/components/admin/DataTable';
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, EXPENSE_STATUSES, STATUS_COLORS, STATUS_LABELS } from './_components/constants';

function KpiCard({ label, value, icon: Icon, color = '#6366f1' }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '18' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-lg font-bold text-gray-900 tracking-tight leading-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function ExpensesListPage() {
  const router = useRouter();
  const { fmtCurrency } = useSettings();

  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const buildParams = () => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (category) p.set('category', category);
    if (status) p.set('status', status);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    if (search) p.set('search', search);
    return p.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', category, status, dateFrom, dateTo, search, page],
    queryFn: () => api.get(`/expenses?${buildParams()}`).then(r => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ['expense-stats', new Date().getFullYear()],
    queryFn: () => api.get(`/expenses/stats?year=${new Date().getFullYear()}`).then(r => r.data),
  });

  const expenses = data?.data || [];
  const total = data?.total || 0;

  const columns = [
    {
      key: 'expenseNo', label: 'Expense No',
      render: (v: string, row: any) => (
        <button onClick={() => router.push(`/admin/finance/expenses/${row.id}`)}
          className="font-mono text-xs font-bold text-primary-600 hover:underline">
          {v}
        </button>
      ),
    },
    {
      key: 'category', label: 'Category',
      render: (v: string) => <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{CATEGORY_LABELS[v] || v}</span>,
      exportValue: (row: any) => CATEGORY_LABELS[row.category] || row.category,
    },
    { key: 'vendor', label: 'Vendor', render: (v: string) => v || '—' },
    {
      key: 'description', label: 'Description', className: 'max-w-[220px] truncate',
      render: (v: string) => <span className="truncate block max-w-[220px]" title={v}>{v}</span>,
    },
    {
      key: 'totalAmount', label: 'Amount',
      render: (v: number) => <span className="font-bold text-gray-800">{fmtCurrency(v)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (v: string) => <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[v] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABELS[v] || v}</span>,
      exportValue: (row: any) => STATUS_LABELS[row.status] || row.status,
    },
    {
      key: 'date', label: 'Date',
      render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB') : '—',
    },
  ];

  return (
    <div className="p-5 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track and manage business expenses</p>
        </div>
        <button onClick={() => router.push('/admin/finance/expenses/new')}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors">
          <Plus size={15} /> New Expense
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Total Expenses" value={fmtCurrency(stats?.total ?? 0)} icon={Receipt} color="#6366f1" />
        <KpiCard label="Paid"           value={fmtCurrency(stats?.paid ?? 0)}  icon={CheckCircle2} color="#10b981" />
        <KpiCard label="Pending"        value={fmtCurrency(stats?.pending ?? 0)} icon={Clock}      color="#f59e0b" />
        <KpiCard label="Count"          value={stats?.count ?? 0}              icon={Hash}          color="#3b82f6" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by vendor, description…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white" />
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          <option value="">All Status</option>
          {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
      </div>

      <DataTable
        title={`Expenses (${total})`}
        columns={columns}
        data={expenses}
        total={total}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={setPage}
        exportFilename="expenses"
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => router.push(`/admin/finance/expenses/${row.id}`)}
              title="View" className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400"><Eye size={13} /></button>
            <button onClick={() => router.push(`/admin/finance/expenses/${row.id}/edit`)}
              title="Edit" className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400"><Pencil size={13} /></button>
          </div>
        )}
      />
    </div>
  );
}
