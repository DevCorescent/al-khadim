'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useSettings } from '@/lib/useSettings';
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Wallet, PieChart as PieChartIcon,
  FileText, Landmark, Target, BarChart2, ArrowRight,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

function KpiCard({ label, value, icon: Icon, color = '#6366f1', sub }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className="text-xl font-black text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
  );
}

function QuickLink({ href, label, icon: Icon }: any) {
  return (
    <Link href={href}
      className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:border-primary-200 hover:shadow-sm transition-all group">
      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
        <Icon size={16} className="text-primary-500" />
      </div>
      <span className="text-sm font-bold text-gray-700 flex-1">{label}</span>
      <ArrowRight size={14} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
    </Link>
  );
}

export default function FinanceOverviewPage() {
  const { fmtCurrency, settings } = useSettings();
  const year = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ['finance-report', year],
    queryFn: () => api.get(`/reports/finance?from=${year}-01-01&to=${year}-12-31`).then(r => r.data),
  });

  const revenue        = data?.pnl?.revenue ?? 0;
  const totalExpenses  = data?.pnl?.totalExpenses ?? 0;
  const payrollExpense = data?.pnl?.payrollExpense ?? 0;
  const netProfit       = data?.pnl?.netProfit ?? (revenue - totalExpenses - payrollExpense);

  const accountsSummary: any[] = data?.accountsSummary ?? [];
  const cashPosition = accountsSummary.reduce((sum, a) => sum + (a?.currentBalance ?? 0), 0);

  const budgetVsActual: any[] = data?.budgetVsActual ?? [];
  const budgetUtilization = budgetVsActual.length
    ? Math.round(budgetVsActual.reduce((s, b) => s + (b?.pctUsed ?? 0), 0) / budgetVsActual.length)
    : null;

  // Months after the current one haven't happened yet; plotting them as zero would read as real data.
  const currentMonth = new Date().getMonth();
  const cashflowMonthly: any[] = (data?.cashflow?.monthly ?? []).slice(0, currentMonth + 1);
  const cashflow = data?.cashflow;

  return (
    <div className="p-5 min-h-screen bg-gray-50 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance Overview</h1>
        <p className="text-xs text-gray-400 mt-0.5">Financial Year {year} · Revenue, expenses, cash flow & budgets at a glance</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard label="Revenue" value={fmtCurrency(revenue)} icon={TrendingUp} color="#6366f1" />
            <KpiCard label="Total Expenses" value={fmtCurrency(totalExpenses)} icon={Receipt} color="#f59e0b" />
            <KpiCard label="Payroll Expense" value={fmtCurrency(payrollExpense)} icon={DollarSign} color="#8b5cf6" />
            <KpiCard
              label="Net Profit"
              value={fmtCurrency(netProfit)}
              icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              color={netProfit >= 0 ? '#10b981' : '#ef4444'}
            />
            <KpiCard label="Cash Position" value={fmtCurrency(cashPosition)} icon={Wallet} color="#0ea5e9" />
            <KpiCard
              label="Budget Utilization"
              value={budgetUtilization !== null ? `${budgetUtilization}%` : '—'}
              icon={PieChartIcon}
              color="#ec4899"
              sub={budgetVsActual.length ? `${budgetVsActual.length} categories` : 'No budgets set'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* P&L summary */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">P&amp;L Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Revenue</span>
                  <span className="font-bold text-gray-800">{fmtCurrency(revenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Expenses</span>
                  <span className="font-bold text-gray-800">-{fmtCurrency(totalExpenses)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Payroll</span>
                  <span className="font-bold text-gray-800">-{fmtCurrency(payrollExpense)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="font-bold text-gray-700">Net Profit</span>
                  <span className={`font-black text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtCurrency(netProfit)}
                  </span>
                </div>
                {data?.pnl?.netMarginPct != null && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Net Margin</span>
                    <span>{Number(data.pnl.netMarginPct).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cash flow chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Cash Flow Trend</h3>
                <span className="text-xs text-gray-400 font-mono">{settings.currency}</span>
              </div>
              {cashflow && (
                <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
                  {[
                    { label: 'Opening', value: cashflow.openingBalance, cls: 'text-gray-700' },
                    { label: 'Cash In', value: cashflow.cashIn, cls: 'text-emerald-600' },
                    { label: 'Cash Out', value: -cashflow.cashOut, cls: 'text-red-500' },
                    { label: 'Closing', value: cashflow.closingBalance, cls: 'text-gray-900' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-gray-400">{s.label}</p>
                      <p className={`font-bold ${s.cls}`}>{fmtCurrency(s.value)}</p>
                    </div>
                  ))}
                </div>
              )}
              {cashflowMonthly.some(m => m.in || m.out) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={cashflowMonthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={m => String(m).split(' ')[0]} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48}
                      tickFormatter={v => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtCurrency(name === 'Cash Out' ? -v : v), name]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      cursor={{ fill: '#f9fafb' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#d1d5db" />
                    <Bar dataKey="in" fill="#10b981" fillOpacity={0.8} name="Cash In" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="out" fill="#ef4444" fillOpacity={0.8} name="Cash Out" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    {/* Straight segments: monthly totals are discrete points, so smoothing would invent values between months. */}
                    <Line type="linear" dataKey="net" stroke="#6366f1" strokeWidth={2} name="Net"
                      dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart2 size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No cash flow data yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Quick Links</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <QuickLink href="/admin/finance/expenses" label="Expenses" icon={Receipt} />
              <QuickLink href="/admin/finance/accounts" label="Accounts" icon={Landmark} />
              <QuickLink href="/admin/finance/budgets" label="Budgets" icon={Target} />
              <QuickLink href="/admin/crm/invoices" label="Invoices" icon={FileText} />
              <QuickLink href="/admin/payroll" label="Payroll" icon={DollarSign} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
