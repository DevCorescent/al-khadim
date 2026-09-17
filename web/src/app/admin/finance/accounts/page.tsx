'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Modal from '@/components/admin/Modal';
import toast from 'react-hot-toast';
import { useSettings } from '@/lib/useSettings';
import { Plus, ArrowLeftRight, Landmark, Wallet, Banknote } from 'lucide-react';

const TYPE_META: Record<string, { label: string; badge: string; icon: any }> = {
  BANK: { label: 'Bank', badge: 'bg-blue-100 text-blue-700', icon: Landmark },
  CASH: { label: 'Cash', badge: 'bg-green-100 text-green-700', icon: Wallet },
  PETTY_CASH: { label: 'Petty Cash', badge: 'bg-amber-100 text-amber-700', icon: Banknote },
};

export default function AccountsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { fmtCurrency } = useSettings();
  const [newModal, setNewModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [newType, setNewType] = useState('BANK');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank-accounts').then(r => r.data),
  });

  const createAccount = useMutation({
    mutationFn: (body: any) => api.post('/bank-accounts', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Account created');
      setNewModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create account'),
  });

  const transfer = useMutation({
    mutationFn: (body: any) => api.post('/bank-accounts/transfer', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Transfer completed');
      setTransferModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Transfer failed'),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(form.entries());
    body.openingBalance = parseFloat(body.openingBalance as string) || 0;
    if (body.type !== 'BANK') {
      delete body.bankName;
      delete body.accountNumber;
      delete body.iban;
    }
    createAccount.mutate(body);
  }

  function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(form.entries());
    if (body.fromAccountId === body.toAccountId) {
      toast.error('From and To accounts must be different');
      return;
    }
    body.amount = parseFloat(body.amount as string);
    transfer.mutate(body);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Bank & Cash Accounts</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTransferModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftRight size={14} /> Transfer Funds
          </button>
          <button onClick={() => { setNewType('BANK'); setNewModal(true); }} className="btn-primary text-sm py-2 px-4">
            <Plus size={14} /> New Account
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : accounts?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a: any) => {
            const meta = TYPE_META[a.type] || TYPE_META.BANK;
            const Icon = meta.icon;
            const negative = a.currentBalance < 0;
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/admin/finance/accounts/${a.id}`)}
                className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
                      {a.type === 'BANK' && a.bankName && <p className="text-xs text-gray-400 truncate">{a.bankName}</p>}
                    </div>
                  </div>
                  <span className={`badge ${meta.badge} shrink-0`}>{meta.label}</span>
                </div>
                <div className="mt-4">
                  <p className={`text-xl font-black ${negative ? 'text-red-500' : 'text-gray-900'}`}>{fmtCurrency(a.currentBalance)}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {a.currency}
                    {!a.isActive && <span className="text-red-400 font-semibold ml-2">Inactive</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No accounts yet. Create your first bank or cash account.
        </div>
      )}

      {/* New Account Modal */}
      <Modal isOpen={newModal} onClose={() => setNewModal(false)} title="New Account">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" placeholder="e.g. Main Operating Account" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="PETTY_CASH">Petty Cash</option>
            </select>
          </div>
          {newType === 'BANK' && (
            <>
              <div>
                <label className="label">Bank Name</label>
                <input name="bankName" className="input" placeholder="e.g. Emirates NBD" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Account Number</label>
                  <input name="accountNumber" className="input" />
                </div>
                <div>
                  <label className="label">IBAN</label>
                  <input name="iban" className="input" />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="label">Opening Balance</label>
            <input name="openingBalance" type="number" step="0.01" defaultValue={0} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setNewModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createAccount.isPending} className="btn-primary text-sm py-2">
              {createAccount.isPending ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Funds Modal */}
      <Modal isOpen={transferModal} onClose={() => setTransferModal(false)} title="Transfer Funds">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="label">From Account *</label>
            <select name="fromAccountId" required className="input" defaultValue="">
              <option value="" disabled>Select account</option>
              {accounts?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To Account *</label>
            <select name="toAccountId" required className="input" defaultValue="">
              <option value="" disabled>Select account</option>
              {accounts?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount *</label>
            <input name="amount" type="number" step="0.01" min="0.01" required className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" className="input" placeholder="Optional note" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setTransferModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={transfer.isPending} className="btn-primary text-sm py-2">
              {transfer.isPending ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
