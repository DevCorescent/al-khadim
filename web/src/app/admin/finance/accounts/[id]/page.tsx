'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { useSettings } from '@/lib/useSettings';
import { ArrowLeft, Plus, Pencil, Trash2, Landmark, Wallet, Banknote } from 'lucide-react';

const TYPE_META: Record<string, { label: string; badge: string; icon: any }> = {
  BANK: { label: 'Bank', badge: 'bg-blue-100 text-blue-700', icon: Landmark },
  CASH: { label: 'Cash', badge: 'bg-green-100 text-green-700', icon: Wallet },
  PETTY_CASH: { label: 'Petty Cash', badge: 'bg-amber-100 text-amber-700', icon: Banknote },
};

const TXN_COLORS: Record<string, string> = {
  DEPOSIT: 'bg-green-100 text-green-700',
  WITHDRAWAL: 'bg-red-100 text-red-600',
  TRANSFER_IN: 'bg-teal-100 text-teal-700',
  TRANSFER_OUT: 'bg-orange-100 text-orange-700',
  INVOICE_PAYMENT: 'bg-blue-100 text-blue-700',
  EXPENSE_PAYMENT: 'bg-purple-100 text-purple-700',
  PAYROLL_PAYMENT: 'bg-indigo-100 text-indigo-700',
  ADJUSTMENT: 'bg-gray-100 text-gray-600',
};

function relatedLabel(row: any): { text: string; href?: string } | null {
  if (row.relatedInvoice) return { text: `Invoice ${row.relatedInvoice.invoiceNo}`, href: `/admin/crm/invoices/${row.relatedInvoice.id}` };
  if (row.relatedExpense) return { text: `Expense ${row.relatedExpense.expenseNo}`, href: `/admin/finance/expenses/${row.relatedExpense.id}` };
  if (row.relatedPayroll) {
    const emp = row.relatedPayroll.employee;
    return { text: `Payroll ${row.relatedPayroll.month}/${row.relatedPayroll.year}${emp ? ` — ${emp.firstName} ${emp.lastName}` : ''}` };
  }
  return null;
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { fmtCurrency } = useSettings();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [txnModal, setTxnModal] = useState(false);
  const [editModal, setEditModal] = useState(false);

  const { data: account, isLoading } = useQuery({
    queryKey: ['bank-account', id, page],
    queryFn: () => api.get(`/bank-accounts/${id}?page=${page}&limit=${limit}`).then(r => r.data),
  });

  const recordTxn = useMutation({
    mutationFn: (body: any) => api.post(`/bank-accounts/${id}/transactions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-account', id] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Transaction recorded');
      setTxnModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to record transaction'),
  });

  const updateAccount = useMutation({
    mutationFn: (body: any) => api.put(`/bank-accounts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-account', id] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Account updated');
      setEditModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update account'),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete(`/bank-accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Account deleted');
      router.push('/admin/finance/accounts');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete account'),
  });

  function handleTxnSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(form.entries());
    body.amount = parseFloat(body.amount as string);
    if (!body.date) delete body.date;
    recordTxn.mutate(body);
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = { name: form.get('name'), isActive: form.get('isActive') === 'on' };
    updateAccount.mutate(body);
  }

  const columns = [
    { key: 'date', label: 'Date', render: (v: string) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { key: 'type', label: 'Type', render: (v: string) => <span className={`badge ${TXN_COLORS[v] || 'bg-gray-100 text-gray-600'}`}>{v.replace(/_/g, ' ')}</span> },
    { key: 'description', label: 'Description', render: (v: string) => v || <span className="text-gray-300">—</span> },
    {
      key: 'related', label: 'Related',
      exportValue: (row: any) => relatedLabel(row)?.text || '',
      render: (_: any, row: any) => {
        const rel = relatedLabel(row);
        if (!rel) return <span className="text-gray-300">—</span>;
        return rel.href
          ? <Link href={rel.href} className="text-xs font-semibold text-primary-500 hover:underline">{rel.text}</Link>
          : <span className="text-xs text-gray-500">{rel.text}</span>;
      },
    },
    {
      key: 'amount', label: 'Amount',
      exportValue: (row: any) => row.amount,
      render: (v: number) => (
        <span className={`font-semibold ${v < 0 ? 'text-red-500' : 'text-green-600'}`}>
          {v < 0 ? '-' : '+'}{fmtCurrency(Math.abs(v))}
        </span>
      ),
    },
  ];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
  if (!account) return <p className="p-8 text-red-500">Account not found.</p>;

  const meta = TYPE_META[account.type] || TYPE_META.BANK;
  const Icon = meta.icon;
  const negative = account.currentBalance < 0;
  const transactions = account.transactions?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/finance/accounts')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft size={15} className="text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Account Details</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-gray-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-gray-900 text-lg">{account.name}</p>
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
                {!account.isActive && <span className="badge bg-red-100 text-red-600">Inactive</span>}
              </div>
              {account.type === 'BANK' && (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  {account.bankName && <p>{account.bankName}</p>}
                  {account.accountNumber && <p>Acc No: <span className="font-mono">{account.accountNumber}</span></p>}
                  {account.iban && <p>IBAN: <span className="font-mono">{account.iban}</span></p>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setEditModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50"
            >
              <Pencil size={13} /> Edit Account
            </button>
            <button
              onClick={() => { if (confirm(`Delete account "${account.name}"? This cannot be undone.`)) deleteAccount.mutate(); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 bg-white px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <Trash2 size={13} /> Delete Account
            </button>
            <button onClick={() => setTxnModal(true)} className="btn-primary text-sm py-2 px-4">
              <Plus size={14} /> Record Transaction
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Current Balance</p>
          <p className={`text-3xl font-black ${negative ? 'text-red-500' : 'text-gray-900'}`}>{fmtCurrency(account.currentBalance)}</p>
          <p className="text-xs text-gray-400 mt-1">{account.currency} · Opening balance {fmtCurrency(account.openingBalance)}</p>
        </div>
      </div>

      <DataTable
        title={`Transaction Ledger (${account.transactions?.total || 0})`}
        columns={columns}
        data={transactions}
        total={account.transactions?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        exportFilename={`${account.name}-transactions`}
      />

      {/* Record Transaction Modal */}
      <Modal isOpen={txnModal} onClose={() => setTxnModal(false)} title="Record Transaction">
        <form onSubmit={handleTxnSubmit} className="space-y-4">
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="DEPOSIT">
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
          <div>
            <label className="label">Amount *</label>
            <input name="amount" type="number" step="0.01" required className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" placeholder="Optional note" />
          </div>
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setTxnModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={recordTxn.isPending} className="btn-primary text-sm py-2">
              {recordTxn.isPending ? 'Saving...' : 'Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Account">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" required defaultValue={account.name} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" name="isActive" defaultChecked={account.isActive} />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={updateAccount.isPending} className="btn-primary text-sm py-2">
              {updateAccount.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
