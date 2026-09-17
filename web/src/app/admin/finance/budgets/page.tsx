'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSettings } from '@/lib/useSettings';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const CATEGORIES = [
  'RENT', 'UTILITIES', 'OFFICE_SUPPLIES', 'MARKETING', 'TRAVEL', 'PROFESSIONAL_FEES',
  'MAINTENANCE', 'INSURANCE', 'IT_SOFTWARE', 'BANK_CHARGES', 'TAXES', 'OTHER',
];

function categoryLabel(c: string) {
  return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
}

const YEARS = [2023, 2024, 2025, 2026];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
}));

function queryString(params: Record<string, any>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export default function BudgetsPage() {
  const qc = useQueryClient();
  const { fmtCurrency } = useSettings();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);

  function periodParams() {
    const p: Record<string, any> = { year, period: periodType };
    if (periodType === 'MONTHLY') p.month = month;
    if (periodType === 'QUARTERLY') p.quarter = quarter;
    return p;
  }

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', year, periodType, month, quarter],
    queryFn: () => api.get(`/budgets?${queryString(periodParams())}`).then(r => r.data),
  });

  const { data: vsActual, isLoading: vsLoading } = useQuery({
    queryKey: ['budgets-vs-actual', year, periodType, month, quarter],
    queryFn: () => api.get(`/budgets/vs-actual?${queryString(periodParams())}`).then(r => r.data),
  });

  const saveBudget = useMutation({
    mutationFn: (body: any) => api.post('/budgets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['budgets-vs-actual'] });
      toast.success('Budget saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save budget'),
  });

  function budgetFor(category: string) {
    return budgets?.find((b: any) => b.category === category);
  }

  function handleBlur(category: string, value: string) {
    if (value === '') return;
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) return;
    const existing = budgetFor(category);
    if (existing && existing.amount === amount) return;
    saveBudget.mutate({ category, ...periodParams(), amount });
  }

  const periodKey = `${year}-${periodType}-${month}-${quarter}-${isLoading ? 'l' : 'r'}`;
  const chartData = (vsActual || []).map((v: any) => ({ ...v, label: categoryLabel(v.category) }));
  const overBudgetCount = (vsActual || []).filter((v: any) => v.pctUsed > 100).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Budgets</h2>
      </div>

      {/* Period controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={periodType} onChange={e => setPeriodType(e.target.value as any)} className="input w-40">
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </select>
        {periodType === 'MONTHLY' && (
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input w-36">
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        )}
        {periodType === 'QUARTERLY' && (
          <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="input w-28">
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        )}
      </div>

      {/* Category budget table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Category Budgets</h3>
          <p className="text-xs text-gray-400 mt-0.5">Set an amount per category for the selected period — saves automatically on blur.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Category</th>
              <th className="text-left text-xs font-medium text-gray-500 px-6 py-3 w-56">Budgeted Amount</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(cat => {
              const existing = budgetFor(cat);
              return (
                <tr key={cat} className="border-t border-gray-50">
                  <td className="px-6 py-3 text-gray-700 font-medium">{categoryLabel(cat)}</td>
                  <td className="px-6 py-3">
                    <input
                      key={`${cat}-${periodKey}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={existing?.amount ?? ''}
                      placeholder="0.00"
                      onBlur={e => handleBlur(cat, e.target.value)}
                      className="input py-2"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Budget vs Actual */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Budget vs Actual</h3>
          {overBudgetCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
              <AlertTriangle size={12} /> {overBudgetCount} over budget
            </span>
          )}
        </div>
        {vsLoading ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : chartData.length ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budgeted" fill="#6366f1" name="Budgeted" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#f59e0b" name="Actual" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <table className="w-full text-sm mt-6">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="text-left pb-2 text-[11px] font-bold text-gray-400 uppercase">Category</th>
                  <th className="text-right pb-2 text-[11px] font-bold text-gray-400 uppercase">Budgeted</th>
                  <th className="text-right pb-2 text-[11px] font-bold text-gray-400 uppercase">Actual</th>
                  <th className="text-right pb-2 text-[11px] font-bold text-gray-400 uppercase">Variance</th>
                  <th className="text-right pb-2 text-[11px] font-bold text-gray-400 uppercase">% Used</th>
                </tr>
              </thead>
              <tbody>
                {vsActual.map((v: any) => {
                  const over = v.pctUsed > 100;
                  return (
                    <tr key={v.id} className={`border-b border-gray-50 ${over ? 'bg-red-50/60' : ''}`}>
                      <td className="py-2.5 text-gray-700 font-medium">{categoryLabel(v.category)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmtCurrency(v.budgeted)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmtCurrency(v.actual)}</td>
                      <td className={`py-2.5 text-right font-semibold ${v.variance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {v.variance < 0 ? '-' : '+'}{fmtCurrency(Math.abs(v.variance))}
                      </td>
                      <td className={`py-2.5 text-right font-bold ${over ? 'text-red-500' : 'text-gray-700'}`}>{v.pctUsed.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No budget lines set for this period yet.</div>
        )}
      </div>
    </div>
  );
}
