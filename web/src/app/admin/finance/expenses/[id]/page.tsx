'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle2, DollarSign, Pencil, Trash2, FileUp, FileText,
  Download, Repeat,
} from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import Modal from '@/components/admin/Modal';
import { CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../_components/constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { fmtCurrency } = useSettings();

  const [payModal, setPayModal] = useState(false);
  const [payAccountId, setPayAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.get(`/expenses/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts-list'],
    queryFn: () => api.get('/bank-accounts').then(r => r.data),
    enabled: payModal,
  });

  const approve = useMutation({
    mutationFn: () => api.patch(`/expenses/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Approve failed'),
  });

  const pay = useMutation({
    mutationFn: () => api.patch(`/expenses/${id}/pay`, {
      accountId: payAccountId || undefined,
      paymentMethod: paymentMethod || undefined,
      paymentRef: paymentRef || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense marked as paid');
      setPayModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Payment failed'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/expenses/${id}`),
    onSuccess: () => { toast.success('Expense deleted'); router.push('/admin/finance/expenses'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Delete failed'),
  });

  const uploadReceipt = useMutation({
    mutationFn: (fd: FormData) => api.post(`/expenses/${id}/receipt`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      toast.success('Receipt uploaded');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Upload failed'),
    onSettled: () => setUploading(false),
  });

  const handleReceiptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!(fd.get('file') as File)?.name) { toast.error('Choose a file first'); return; }
    setUploading(true);
    uploadReceipt.mutate(fd);
  };

  if (isLoading || !expense) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canApprove = expense.status === 'DRAFT' || expense.status === 'PENDING_APPROVAL';
  const canPay = expense.status === 'APPROVED';
  const canEdit = expense.status !== 'PAID';

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/finance/expenses')}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
            <ArrowLeft size={15} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{expense.expenseNo}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[expense.status] || 'bg-gray-100 text-gray-500'}`}>
                {STATUS_LABELS[expense.status] || expense.status}
              </span>
              {expense.isRecurring && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                  <Repeat size={10} /> {expense.recurrenceInterval || 'Recurring'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[expense.category] || expense.category} {expense.vendor ? `· ${expense.vendor}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <button onClick={() => approve.mutate()} disabled={approve.isPending}
              className="flex items-center gap-2 border border-blue-200 bg-blue-50 text-blue-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-100 disabled:opacity-60 transition-colors">
              <CheckCircle2 size={14} /> Approve
            </button>
          )}
          {canPay && (
            <button onClick={() => setPayModal(true)}
              className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors">
              <DollarSign size={14} /> Mark Paid
            </button>
          )}
          <button onClick={() => canEdit && router.push(`/admin/finance/expenses/${id}/edit`)} disabled={!canEdit}
            title={canEdit ? 'Edit' : 'Paid expenses cannot be edited'}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={() => { if (confirm(`Delete ${expense.expenseNo}?`)) del.mutate(); }}
            className="flex items-center gap-2 border border-red-200 bg-white text-red-500 font-bold text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Description</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{expense.description}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Amount Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-800">{fmtCurrency(expense.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Tax</span>
                <span className="font-semibold text-gray-800">{fmtCurrency(expense.taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total</span>
                <span className="font-black text-gray-900 text-lg">{fmtCurrency(expense.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Notes</h3>
            <p className="text-sm text-gray-500 whitespace-pre-wrap">{expense.notes || '—'}</p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 text-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-1">Details</h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Date</span>
              <span className="font-semibold text-gray-700">{expense.date ? new Date(expense.date).toLocaleDateString('en-GB') : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Due Date</span>
              <span className="font-semibold text-gray-700">{expense.dueDate ? new Date(expense.dueDate).toLocaleDateString('en-GB') : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Paid Date</span>
              <span className="font-semibold text-gray-700">{expense.paidDate ? new Date(expense.paidDate).toLocaleDateString('en-GB') : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Payment Method</span>
              <span className="font-semibold text-gray-700">{expense.paymentMethod || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Payment Ref</span>
              <span className="font-semibold text-gray-700">{expense.paymentRef || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Account</span>
              <span className="font-semibold text-gray-700">{expense.account?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Approved By</span>
              <span className="font-semibold text-gray-700">{expense.approvedBy?.name || '—'}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Receipt</h3>
            {expense.receiptPath ? (
              <a href={`${API_URL}/${expense.receiptPath}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:underline">
                <FileText size={14} /> View Receipt <Download size={12} className="opacity-60" />
              </a>
            ) : (
              <form onSubmit={handleReceiptSubmit} className="space-y-2">
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100" />
                <button type="submit" disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-bold text-xs px-4 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition-colors">
                  <FileUp size={13} /> {uploading ? 'Uploading…' : 'Upload Receipt'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Mark Paid modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Mark Expense as Paid" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Account (optional)</label>
            <select value={payAccountId} onChange={e => setPayAccountId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
              <option value="">No account (record only)</option>
              {(accounts as any[]).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} — {fmtCurrency(a.currentBalance)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Payment Method</label>
            <input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="e.g. Bank Transfer, Cash…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Payment Reference</label>
            <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Cheque no., transaction ref…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={() => setPayModal(false)}
              className="border border-gray-200 bg-white text-gray-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => pay.mutate()} disabled={pay.isPending}
              className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-60 transition-colors">
              {pay.isPending ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
