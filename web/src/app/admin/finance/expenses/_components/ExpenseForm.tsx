'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import { EXPENSE_CATEGORIES, CATEGORY_LABELS, RECURRENCE_INTERVALS } from './constants';

interface FormState {
  category: string;
  vendor: string;
  description: string;
  amount: string;
  taxAmount: string;
  date: string;
  dueDate: string;
  notes: string;
  isRecurring: boolean;
  recurrenceInterval: string;
}

const BLANK: FormState = {
  category: 'OTHER',
  vendor: '',
  description: '',
  amount: '',
  taxAmount: '0',
  date: new Date().toISOString().split('T')[0],
  dueDate: '',
  notes: '',
  isRecurring: false,
  recurrenceInterval: 'MONTHLY',
};

export default function ExpenseForm({ existing }: { existing?: any }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);

  const init = useCallback((): FormState => {
    if (!existing) return { ...BLANK };
    return {
      category: existing.category || 'OTHER',
      vendor: existing.vendor || '',
      description: existing.description || '',
      amount: existing.amount != null ? String(existing.amount) : '',
      taxAmount: existing.taxAmount != null ? String(existing.taxAmount) : '0',
      date: existing.date ? existing.date.split('T')[0] : BLANK.date,
      dueDate: existing.dueDate ? existing.dueDate.split('T')[0] : '',
      notes: existing.notes || '',
      isRecurring: !!existing.isRecurring,
      recurrenceInterval: existing.recurrenceInterval || 'MONTHLY',
    };
  }, [existing]);

  const [form, setForm] = useState<FormState>(init);
  useEffect(() => { setForm(init()); }, [init]);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const amount = Number(form.amount) || 0;
  const taxAmount = Number(form.taxAmount) || 0;
  const total = amount + taxAmount;
  const fmtN = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function save() {
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.amount || amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (!form.date) { toast.error('Date is required'); return; }

    const payload: Record<string, any> = {
      category: form.category,
      vendor: form.vendor || undefined,
      description: form.description,
      amount,
      taxAmount,
      date: form.date,
      dueDate: form.dueDate || undefined,
      notes: form.notes || undefined,
      isRecurring: form.isRecurring,
      recurrenceInterval: form.isRecurring ? form.recurrenceInterval : undefined,
    };

    setSaving(true);
    try {
      if (existing) {
        await api.put(`/expenses/${existing.id}`, payload);
        toast.success('Expense updated');
        router.push(`/admin/finance/expenses/${existing.id}`);
      } else {
        const res = await api.post('/expenses', payload);
        toast.success('Expense created');
        router.push(`/admin/finance/expenses/${res.data.id}`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/finance/expenses')}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={15} className="text-gray-500" />
          </button>
          <div>
            <p className="text-base font-bold text-gray-900">{existing ? 'Edit Expense' : 'New Expense'}</p>
            <p className="text-xs text-gray-400">{existing ? `Editing ${existing.expenseNo}` : 'Record a new business expense'}</p>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-60 transition-colors shadow-sm">
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Expense Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Category *</label>
              <select value={form.category} onChange={set('category')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Vendor</label>
              <input value={form.vendor} onChange={set('vendor')} placeholder="e.g. DEWA, Etisalat…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">Description *</label>
              <textarea value={form.description} onChange={set('description')} rows={2} placeholder="What was this expense for?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Amount ({settings.currency}) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Tax Amount ({settings.currency})</label>
              <input type="number" min="0" step="0.01" value={form.taxAmount} onChange={set('taxAmount')} placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={set('date')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="text-xs font-bold text-gray-500">Total Amount</span>
            <span className="text-lg font-black text-gray-900">{settings.currency} {fmtN(total)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Recurrence</h3>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isRecurring}
              onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-400/30" />
            <span className="text-sm font-semibold text-gray-700">This is a recurring expense</span>
          </label>
          {form.isRecurring && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Recurrence Interval</label>
              <select value={form.recurrenceInterval} onChange={set('recurrenceInterval')}
                className="w-full sm:w-60 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                {RECURRENCE_INTERVALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Notes</h3>
          <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Any additional notes…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
        </div>

        <div className="flex items-center justify-end gap-2 pb-6">
          <button onClick={() => router.push('/admin/finance/expenses')}
            className="border border-gray-200 bg-white text-gray-600 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors shadow-sm">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
