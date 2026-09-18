'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Modal from '@/components/admin/Modal';

const fmtN = (n: number, cur = 'AED') =>
  `${cur} ${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  /** The invoice being marked paid, or null when closed. */
  invoice: any | null;
  onClose: () => void;
  saving: boolean;
  /** Called with the chosen bank account id, or undefined to record no account transaction. */
  onConfirm: (accountId: string | undefined) => void;
}

/**
 * Confirms marking an invoice PAID and lets staff pick the (active) bank account that received the
 * money. PUT /invoices/:id with `accountId` posts an INVOICE_PAYMENT transaction to that account.
 */
export default function MarkPaidModal({ invoice, onClose, saving, onConfirm }: Props) {
  const [accountId, setAccountId] = useState('');
  useEffect(() => { if (invoice) setAccountId(''); }, [invoice]);

  const { data: accounts = [], isError } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank-accounts').then(r => r.data),
    enabled: !!invoice,
    retry: false,
  });
  const active = (accounts as any[]).filter(a => a.isActive !== false);

  return (
    <Modal isOpen={!!invoice} onClose={onClose} title="Mark Invoice Paid" size="sm">
      {invoice && (
        <form
          onSubmit={e => { e.preventDefault(); onConfirm(accountId || undefined); }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-500">
            <span className="font-mono font-semibold text-gray-700">{invoice.invoiceNo}</span>
            {invoice.client?.companyName ? ` · ${invoice.client.companyName}` : ''} ·{' '}
            <span className="font-semibold text-gray-800">{fmtN(invoice.totalAmount, invoice.currency)}</span>
          </p>
          <div>
            <label className="label">Received Into Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input">
              <option value="">— None (don&apos;t record in Accounts) —</option>
              {active.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}{a.currency ? ` (${a.currency})` : ''}</option>
              ))}
            </select>
            {isError && (
              <p className="text-xs text-amber-600 mt-1">Couldn&apos;t load bank accounts (finance access needed). You can still mark it paid without an account.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-60">
              {saving ? 'Saving...' : 'Mark Paid'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
