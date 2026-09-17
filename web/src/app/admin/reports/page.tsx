'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, Users, Briefcase, DollarSign, Building2,
  UserCheck, BarChart3, Calendar, FileText, ArrowUpRight,
  ArrowDownRight, Download, ChevronRight, Award,
  Clock, Activity, Target, Layers, Image, Table, Sheet,
  GitMerge, Loader2, Landmark,
} from 'lucide-react';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#a855f7','#ec4899','#14b8a6','#f97316','#84cc16'];
const RC = { INDIGO:'#6366f1', GREEN:'#10b981', AMBER:'#f59e0b', RED:'#ef4444', BLUE:'#3b82f6', PURPLE:'#a855f7' };

const SECTIONS = [
  { id: 'overview',          label: 'Overview',             icon: BarChart3 },
  { id: 'recruitment',       label: 'Recruitment',          icon: UserCheck },
  { id: 'placements-detail', label: 'Placements',           icon: Award },
  { id: 'pipeline',          label: 'Pipeline',              icon: GitMerge },
  { id: 'revenue',           label: 'Revenue',               icon: DollarSign },
  { id: 'finance',           label: 'Financial Statements', icon: Landmark },
  { id: 'hr',                label: 'HR & Workforce',        icon: Users },
  { id: 'crm',               label: 'CRM & Clients',         icon: Building2 },
];

/* ── helpers ── */
function KpiCard({ label, value, icon: Icon, color = '#6366f1', trend }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-sm font-semibold text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {sub && <p className="text-sm text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-sm font-bold text-gray-700 mb-4">{title}</p>
      {children}
    </div>
  );
}

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-xs">
      {label && <p className="font-bold text-gray-700 mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name || p.dataKey}:</span>
          <span className="font-bold text-gray-800">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function Loader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
}

function Empty({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
      <BarChart3 size={28} />
      <p className="text-xs font-semibold text-gray-400">{label}</p>
    </div>
  );
}

function useReport(path: string, params: Record<string, string>) {
  const [data, setData]   = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const key = path + JSON.stringify(params);

  useEffect(() => {
    setData(null);
    setError(null);
    const query = new URLSearchParams(params).toString();
    api.get(`${path}?${query}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, error };
}

/* ── tabs ── */
function OverviewTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/overview', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;
  const { kpis, revenueByMonth } = data;

  return (
    <>
      <Section title="Key Performance Indicators" sub="Platform-wide summary for the selected year">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Total Candidates"  value={kpis.totalCandidates}  icon={Users}     color={RC.INDIGO} />
          <KpiCard label="New This Year"     value={kpis.newCandidates}    icon={UserCheck} color={RC.GREEN} />
          <KpiCard label="Placed"            value={kpis.placed}           icon={Award}     color={RC.AMBER} />
          <KpiCard label="Open Jobs"         value={kpis.openJobs}         icon={Briefcase} color={RC.BLUE} />
          <KpiCard label="Active Clients"    value={kpis.activeClients}    icon={Building2} color={RC.PURPLE} />
          <KpiCard label="Active Employees"  value={kpis.activeEmployees}  icon={Users}     color={RC.GREEN} />
          <KpiCard label="Total Revenue"     value={`AED ${(kpis.totalRevenue||0).toLocaleString()}`} icon={DollarSign} color={RC.INDIGO} />
          <KpiCard label="Paid Revenue"      value={`AED ${(kpis.paidRevenue||0).toLocaleString()}`}  icon={TrendingUp} color={RC.GREEN} />
          <KpiCard label="Pending Leaves"    value={kpis.pendingLeaves}    icon={Calendar}  color={RC.AMBER} />
          <KpiCard label="New Registrations" value={kpis.registrations}    icon={FileText}  color={RC.RED} />
        </div>
      </Section>

      <Section title="Revenue Trend" sub="Monthly revenue breakdown">
        <ChartCard title="Revenue by Month (Paid vs Total)">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="total" name="Total Invoiced" fill={RC.INDIGO} radius={[4,4,0,0]} fillOpacity={0.3} />
              <Bar  dataKey="paid"  name="Paid"           fill={RC.GREEN}  radius={[4,4,0,0]} />
              <Line dataKey="paid"  name="Paid Trend"     stroke={RC.AMBER} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </>
  );
}

function RecruitmentTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/recruitment', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <Section title="Recruitment KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Candidates"      value={data.summary.totalCandidates}          icon={Users}     color={RC.INDIGO} />
          <KpiCard label="Applications"    value={data.summary.totalApplications}         icon={FileText}  color={RC.BLUE} />
          <KpiCard label="Placed"          value={data.summary.placed}                    icon={Award}     color={RC.GREEN} />
          <KpiCard label="Interviews"      value={data.summary.totalInterviews}           icon={Calendar}  color={RC.AMBER} />
          <KpiCard label="Open Jobs"       value={data.summary.openJobs}                  icon={Briefcase} color={RC.PURPLE} />
          <KpiCard label="Filled Jobs"     value={data.summary.filledJobs}                icon={Target}    color={RC.GREEN} />
          <KpiCard label="Conversion Rate" value={`${data.summary.conversionRate}%`}      icon={TrendingUp} color={RC.INDIGO} />
          <KpiCard label="Registrations"   value={data.summary.registrations}             icon={UserCheck} color={RC.AMBER} />
        </div>
      </Section>

      <Section title="Monthly Pipeline Trends">
        <ChartCard title="Candidates / Applications / Interviews per Month">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.monthlyPipeline || []}>
              <defs>
                {['candidates','applications','interviews'].map((k, i) => (
                  <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={COLORS[i]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="candidates"   name="Candidates"   stroke={COLORS[0]} fill="url(#gcandidates)"   strokeWidth={2} />
              <Area dataKey="applications" name="Applications" stroke={COLORS[1]} fill="url(#gapplications)" strokeWidth={2} />
              <Area dataKey="interviews"   name="Interviews"   stroke={COLORS[2]} fill="url(#ginterviews)"   strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Candidate Demographics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Candidates by Status">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {(data.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Nationalities">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byNationality || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Candidates" radius={[0,4,4,0]}>
                  {(data.byNationality || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Experience Buckets">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={data.byExperience} cx="50%" cy="50%" outerRadius={90}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar dataKey="value" stroke={RC.INDIGO} fill={RC.INDIGO} fillOpacity={0.25} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Candidate Source">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.bySource || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {(data.bySource || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Application & Interview Outcomes">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Application Status Breakdown">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.appByStatus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                  {(data.appByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Interview Outcomes">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.intByStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {(data.intByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Skills Intelligence">
        <ChartCard title="Top 10 Skills in Candidate Pool">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.topSkills || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={45} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" name="Candidates" radius={[4,4,0,0]}>
                {(data.topSkills || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </>
  );
}

function RevenueTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/revenue', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <Section title="Financial KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Invoiced"  value={`AED ${(data.summary.total||0).toLocaleString()}`}   icon={DollarSign}  color={RC.INDIGO} />
          <KpiCard label="Paid"            value={`AED ${(data.summary.paid||0).toLocaleString()}`}    icon={TrendingUp}  color={RC.GREEN} />
          <KpiCard label="Pending"         value={`AED ${(data.summary.pending||0).toLocaleString()}`} icon={Clock}       color={RC.AMBER} />
          <KpiCard label="Overdue"         value={`AED ${(data.summary.overdue||0).toLocaleString()}`} icon={Activity}    color={RC.RED} />
          <KpiCard label="Total Invoices"  value={data.summary.invoiceCount}                           icon={FileText}    color={RC.BLUE} />
          <KpiCard label="Collection Rate" value={`${data.summary.collectionRate}%`}                   icon={Target}      color={RC.GREEN} />
        </div>
      </Section>

      <Section title="Monthly Revenue">
        <ChartCard title="Paid / Pending / Overdue by Month">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="paid"    name="Paid"    stackId="a" fill={RC.GREEN}  />
              <Bar  dataKey="pending" name="Pending" stackId="a" fill={RC.AMBER}  />
              <Bar  dataKey="overdue" name="Overdue" stackId="a" fill={RC.RED}   radius={[4,4,0,0]} />
              <Line dataKey="total"   name="Total"   stroke={RC.INDIGO} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Client & Industry Breakdown">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Top 10 Clients by Revenue">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byClient || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Revenue (AED)" radius={[0,4,4,0]}>
                  {(data.byClient || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Revenue by Industry">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.byIndustry || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}>
                  {(data.byIndustry || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Invoice Status Distribution">
        <ChartCard title="Invoiced Amount by Status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byStatus || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" name="Amount (AED)" radius={[4,4,0,0]}>
                {(data.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </>
  );
}

function catLabel(cat: string) {
  return String(cat || '')
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function FinanceTab({ year }: { year: string }) {
  // The finance report endpoint takes a from/to date range rather than a bare
  // year, so we derive a full-year range from the page's shared year selector
  // instead of introducing a second, separate date picker on this tab.
  const from = `${year}-01-01`;
  const to   = `${year}-12-31`;
  const { data, error } = useReport('/reports/finance', { from, to });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  const pnl                 = data?.pnl ?? {};
  const cashflow             = data?.cashflow ?? {};
  const expensesByCategory   = data?.expensesByCategory ?? pnl?.expensesByCategory ?? [];
  const cashflowMonthly      = cashflow?.monthly ?? [];
  const budgetVsActual       = data?.budgetVsActual ?? [];
  const accountsSummary      = data?.accountsSummary ?? [];

  const netProfit   = pnl?.netProfit ?? 0;
  const netPositive = netProfit >= 0;
  const netCashFlow = cashflow?.netCashFlow ?? 0;

  return (
    <>
      <Section title="Financial KPIs" sub="Profit &amp; loss summary for the selected year">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Revenue"         value={`AED ${(pnl?.revenue ?? 0).toLocaleString()}`}         icon={DollarSign} color={RC.INDIGO} />
          <KpiCard label="Total Expenses"  value={`AED ${(pnl?.totalExpenses ?? 0).toLocaleString()}`}   icon={Activity}   color={RC.RED} />
          <KpiCard label="Payroll Expense" value={`AED ${(pnl?.payrollExpense ?? 0).toLocaleString()}`}  icon={Users}      color={RC.AMBER} />
          <KpiCard label="Net Profit"      value={`AED ${netProfit.toLocaleString()}`}                    icon={TrendingUp} color={netPositive ? RC.GREEN : RC.RED} />
          <KpiCard label="Net Margin"      value={`${pnl?.netMarginPct ?? 0}%`}                            icon={Target}     color={RC.PURPLE} />
        </div>
      </Section>

      <Section title="Profit &amp; Loss Statement" sub={`${year} — revenue, expenses by category, and net profit`}>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm max-w-2xl">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-2.5 font-semibold text-gray-700">Revenue</td>
                <td className="py-2.5 text-right font-bold text-gray-900">AED {(pnl?.revenue ?? 0).toLocaleString()}</td>
              </tr>
              {expensesByCategory.length === 0 ? (
                <tr><td colSpan={2} className="py-3 text-xs text-gray-300 text-center">No expenses recorded</td></tr>
              ) : expensesByCategory.map((e: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 pl-4 text-gray-500">{catLabel(e.category)}</td>
                  <td className="py-2 text-right text-gray-600">AED {(e.amount ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2.5 font-semibold text-gray-700">Total Expenses</td>
                <td className="py-2.5 text-right font-bold text-gray-900">AED {(pnl?.totalExpenses ?? 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold text-gray-700">Payroll Expense</td>
                <td className="py-2.5 text-right font-bold text-gray-900">AED {(pnl?.payrollExpense ?? 0).toLocaleString()}</td>
              </tr>
              <tr className="border-t-2 border-gray-200">
                <td className="py-3 font-bold text-gray-900">Net Profit</td>
                <td className={`py-3 text-right font-bold text-base ${netPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  AED {netProfit.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-xs font-semibold text-gray-400">Net Margin</td>
                <td className="py-2 text-right text-xs font-bold text-gray-500">{pnl?.netMarginPct ?? 0}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Expenses by Category">
        {expensesByCategory.length === 0 ? <Empty label="No expenses recorded yet" /> : (
          <ChartCard title="Expense Breakdown by Category">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expensesByCategory.map((e: any) => ({ name: catLabel(e.category), value: e.amount ?? 0 }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Amount (AED)" radius={[0,4,4,0]}>
                  {expensesByCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </Section>

      <Section title="Cash Flow" sub={`${year} — opening/closing balance and monthly in/out`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Opening Balance" value={`AED ${(cashflow?.openingBalance ?? 0).toLocaleString()}`} icon={Building2}      color={RC.BLUE} />
          <KpiCard label="Cash In"         value={`AED ${(cashflow?.cashIn ?? 0).toLocaleString()}`}         icon={ArrowUpRight}   color={RC.GREEN} />
          <KpiCard label="Cash Out"        value={`AED ${(cashflow?.cashOut ?? 0).toLocaleString()}`}        icon={ArrowDownRight} color={RC.RED} />
          <KpiCard label="Net Cash Flow"   value={`AED ${netCashFlow.toLocaleString()}`}                      icon={Activity}       color={netCashFlow >= 0 ? RC.GREEN : RC.RED} />
          <KpiCard label="Closing Balance" value={`AED ${(cashflow?.closingBalance ?? 0).toLocaleString()}`} icon={DollarSign}     color={RC.INDIGO} />
        </div>

        {cashflowMonthly.length === 0 ? <Empty label="No cash flow data yet" /> : (
          <ChartCard title="Monthly Cash In / Out / Net">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={cashflowMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CT />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar  dataKey="in"  name="Cash In"  fill={RC.GREEN} radius={[4,4,0,0]} />
                <Bar  dataKey="out" name="Cash Out" fill={RC.RED}   radius={[4,4,0,0]} />
                <Line dataKey="net" name="Net"      stroke={RC.INDIGO} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </Section>

      <Section title="Budget vs Actual" sub="Category budgets vs. actual spend">
        {budgetVsActual.length === 0 ? <Empty label="No budgets set yet" /> : (
          <>
            <ChartCard title="Budgeted vs Actual by Category">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetVsActual.map((b: any) => ({ ...b, name: catLabel(b.category) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CT />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budgeted" name="Budgeted" fill={RC.INDIGO} radius={[4,4,0,0]} fillOpacity={0.4} />
                  <Bar dataKey="actual"   name="Actual"   fill={RC.AMBER}  radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Category', 'Budgeted', 'Actual', 'Variance', 'Used'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {budgetVsActual.map((b: any, i: number) => {
                    const pctUsed = b.pctUsed ?? 0;
                    const over    = pctUsed > 100;
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2.5 font-semibold text-gray-700">{catLabel(b.category)}</td>
                        <td className="px-4 py-2.5 text-gray-600">AED {(b.budgeted ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-gray-600">AED {(b.actual ?? 0).toLocaleString()}</td>
                        <td className={`px-4 py-2.5 font-semibold ${(b.variance ?? 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          AED {(b.variance ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pctUsed)}%`, background: over ? RC.RED : RC.GREEN }} />
                            </div>
                            <span className={`text-xs font-bold ${over ? 'text-red-500' : 'text-gray-500'}`}>{pctUsed}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section title="Accounts Summary" sub="Bank &amp; cash account balances">
        {accountsSummary.length === 0 ? <Empty label="No accounts set up yet" /> : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Account', 'Type', 'Balance'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {accountsSummary.map((a: any) => (
                  <tr key={a.id ?? a.name}>
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{a.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{a.type}</td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">AED {(a.currentBalance ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function HrTab({ year }: { year: string }) {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const { data, error } = useReport('/reports/hr', { year, month });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-semibold text-gray-600">Attendance Month:</label>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
            <option key={m} value={String(i+1)}>{m}</option>
          ))}
        </select>
      </div>

      <Section title="Workforce KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Employees"  value={data.summary.total}              icon={Users}     color={RC.INDIGO} />
          <KpiCard label="Active"           value={data.summary.active}             icon={Activity}  color={RC.GREEN} />
          <KpiCard label="On Leave"         value={data.summary.onLeave}            icon={Calendar}  color={RC.AMBER} />
          <KpiCard label="Departments"      value={data.summary.departments}        icon={Layers}    color={RC.BLUE} />
          <KpiCard label="Attendance Rate"  value={`${data.summary.attendanceRate}%`} icon={Clock}   color={RC.GREEN} />
          <KpiCard label="Present (Month)"  value={data.summary.totalPresent}       icon={UserCheck} color={RC.INDIGO} />
          <KpiCard label="Absent (Month)"   value={data.summary.totalAbsent}        icon={Activity}  color={RC.RED} />
          <KpiCard label="Pending Leaves"   value={data.summary.pendingLeaves}      icon={FileText}  color={RC.AMBER} />
        </div>
      </Section>

      <Section title="Workforce Composition">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Employees by Department">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byDepartment || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Employees" radius={[0,4,4,0]}>
                  {(data.byDepartment || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Employee Status">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.byStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {(data.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Nationality Distribution">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byNationality || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Employees" radius={[4,4,0,0]}>
                  {(data.byNationality || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Leave Analytics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Leave Requests by Type">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.leaveByType || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {(data.leaveByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Leave by Approval Status">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.leaveByStatus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Requests" radius={[4,4,0,0]}>
                  {(data.leaveByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Payroll Trend">
        <ChartCard title="Monthly Payroll — Gross / Net / Deductions">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.payrollTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="gross"      name="Gross"       fill={RC.INDIGO} radius={[4,4,0,0]} fillOpacity={0.4} />
              <Line dataKey="net"        name="Net"         stroke={RC.GREEN}  strokeWidth={2} />
              <Line dataKey="deductions" name="Deductions"  stroke={RC.RED}    strokeWidth={2} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </>
  );
}

function CrmTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/crm', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <Section title="CRM KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Clients"  value={data.summary.totalClients}   icon={Building2}  color={RC.INDIGO} />
          <KpiCard label="Active Clients" value={data.summary.activeClients}  icon={Activity}   color={RC.GREEN} />
          <KpiCard label="Total Jobs"     value={data.summary.totalJobs}      icon={Briefcase}  color={RC.BLUE} />
          <KpiCard label="Open Jobs"      value={data.summary.openJobs}       icon={Target}     color={RC.AMBER} />
          <KpiCard label="Enquiries"      value={data.summary.totalEnquiries} icon={FileText}   color={RC.PURPLE} />
          <KpiCard label="Follow-Ups"     value={data.summary.totalFollowUps} icon={Calendar}   color={RC.RED} />
        </div>
      </Section>

      <Section title="Client Growth & Activity">
        <ChartCard title="Monthly Client, Job & Enquiry Activity">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.monthlyClients || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="new"       name="New Clients" fill={RC.INDIGO}  radius={[4,4,0,0]} />
              <Bar  dataKey="jobs"      name="New Jobs"    fill={RC.GREEN}   radius={[4,4,0,0]} />
              <Line dataKey="enquiries" name="Enquiries"   stroke={RC.AMBER} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Client Distribution">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Clients by Industry">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byIndustry || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Clients" radius={[0,4,4,0]}>
                  {(data.byIndustry || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Clients by Country">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.byCountry || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {(data.byCountry || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Enquiries & Follow-Ups">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Enquiries by Service Type">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.enquiryByService || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                  {(data.enquiryByService || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Follow-Up Types">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.followUpByType || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                  {(data.followUpByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Job Orders">
        <ChartCard title="Job Status Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.jobStatus || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" name="Jobs" radius={[4,4,0,0]}>
                {(data.jobStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Deal Pipeline" sub="Sales pipeline funnel, forecast and lead-source performance">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Weighted Forecast"   value={`AED ${(data.pipeline?.weightedForecast || 0).toLocaleString()}`} icon={TrendingUp} color={RC.INDIGO} />
          <KpiCard label="Win Rate"            value={`${data.pipeline?.winRate || 0}%`}                                icon={Target}     color={RC.GREEN} />
          <KpiCard label="Avg Deal Size"       value={`AED ${(data.pipeline?.avgDealSize || 0).toLocaleString()}`}      icon={DollarSign} color={RC.AMBER} />
          <KpiCard label="Avg Sales Cycle"     value={`${data.pipeline?.avgSalesCycleDays || 0} days`}                  icon={Clock}      color={RC.PURPLE} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <ChartCard title="Deals by Stage (Count &amp; Value)">
            {(data.pipeline?.byStage || []).length === 0 ? <Empty label="No deal data yet" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.pipeline?.byStage || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CT />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="Deals" fill={RC.INDIGO} radius={[4,4,0,0]}>
                    {(data.pipeline?.byStage || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Stage-to-Stage Conversion Rates">
            {(data.pipeline?.conversionRates || []).length === 0 ? <Empty label="No conversion data yet" /> : (
              <div className="space-y-3 pt-1">
                {(data.pipeline?.conversionRates || []).map((c: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">{c.from} → {c.to}</span>
                      <span className="text-xs font-bold text-gray-800">{c.rate}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.rate)}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Lead Source Performance">
          {(data.pipeline?.leadSourcePerformance || []).length === 0 ? <Empty label="No lead-source data yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Source', 'Deals', 'Won', 'Won Value'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data.pipeline?.leadSourcePerformance || []).map((s: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-gray-700">{s.source || 'Unknown'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.count}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.wonCount}</td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">AED {(s.wonValue || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </Section>
    </>
  );
}

/* ── PLACEMENTS TAB ── */
function PlacementsTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/placements-detail', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <Section title="Placement KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Applications"  value={data.summary.totalApplications} icon={FileText}  color={RC.INDIGO} />
          <KpiCard label="Placed"              value={data.summary.placed}            icon={Award}     color={RC.GREEN} />
          <KpiCard label="Offered"             value={data.summary.offered}           icon={Target}    color={RC.AMBER} />
          <KpiCard label="Rejected"            value={data.summary.rejected}          icon={Activity}  color={RC.RED} />
          <KpiCard label="Conversion Rate"     value={`${data.summary.conversionRate}%`} icon={TrendingUp} color={RC.INDIGO} />
          <KpiCard label="Total Jobs"          value={data.summary.totalJobs}         icon={Briefcase} color={RC.BLUE} />
          <KpiCard label="Filled Jobs"         value={data.summary.filledJobs}        icon={Award}     color={RC.GREEN} />
          <KpiCard label="Fill Rate"           value={`${data.summary.fillRate}%`}    icon={Target}    color={RC.PURPLE} />
        </div>
      </Section>

      <Section title="Placement Funnel" sub="Candidate progression through hiring stages">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Application Stage Funnel">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.funnel || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Count" radius={[0,4,4,0]}>
                  {(data.funnel || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Conversion Rate by Stage (% of total)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.conversionStages || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CT />} />
                <Bar dataKey="rate" name="Rate %" radius={[4,4,0,0]}>
                  {(data.conversionStages || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Monthly Placement Trend">
        <ChartCard title="Placed / Offered / Rejected by Month">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.monthlyPlacements || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="placed"   name="Placed"   fill={RC.GREEN}  radius={[4,4,0,0]} />
              <Bar  dataKey="offered"  name="Offered"  fill={RC.AMBER}  radius={[4,4,0,0]} />
              <Line dataKey="rejected" name="Rejected" stroke={RC.RED}  strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Placement Distribution">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Top Clients by Placements">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byClient || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Placements" radius={[0,4,4,0]}>
                  {(data.byClient || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Placements by Industry">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.byIndustry || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}>
                  {(data.byIndustry || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Placements by Nationality">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byNationality || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Placements" radius={[4,4,0,0]}>
                  {(data.byNationality || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Job Fill Rate by Client">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.jobFillByClient || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total"  name="Total Jobs"   fill={RC.INDIGO} radius={[4,4,0,0]} fillOpacity={0.4} />
                <Bar dataKey="filled" name="Filled Jobs"  fill={RC.GREEN}  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
    </>
  );
}

/* ── PIPELINE TAB ── */
function PipelineTab({ year }: { year: string }) {
  const { data, error } = useReport('/reports/pipeline', { year });
  if (error) return <div className="p-6 text-red-500 text-sm font-semibold">Error: {error}</div>;
  if (!data) return <Loader />;

  return (
    <>
      <Section title="Pipeline KPIs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="CV Registrations"  value={data.summary.totalRegistrations}   icon={FileText}  color={RC.INDIGO} />
          <KpiCard label="Approved Regs"     value={data.summary.approvedRegistrations} icon={UserCheck} color={RC.GREEN} />
          <KpiCard label="Pending Regs"      value={data.summary.pendingRegistrations}  icon={Clock}     color={RC.AMBER} />
          <KpiCard label="Profile Requests"  value={data.summary.totalProfileRequests}  icon={Users}     color={RC.BLUE} />
          <KpiCard label="New Requests"      value={data.summary.newProfileRequests}    icon={Activity}  color={RC.RED} />
          <KpiCard label="Total Interviews"  value={data.summary.totalInterviews}       icon={Calendar}  color={RC.PURPLE} />
          <KpiCard label="Passed Interviews" value={data.summary.passedInterviews}      icon={Award}     color={RC.GREEN} />
          <KpiCard label="Public Candidates" value={data.summary.publicCandidates}      icon={Target}    color={RC.INDIGO} />
        </div>
      </Section>

      <Section title="Monthly Pipeline Activity">
        <ChartCard title="Registrations / Profile Requests / Candidates / Interviews by Month">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.monthlyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar  dataKey="registrations"  name="CV Regs"     fill={RC.INDIGO} radius={[4,4,0,0]} />
              <Bar  dataKey="profileRequests" name="Profile Req" fill={RC.BLUE}   radius={[4,4,0,0]} />
              <Line dataKey="candidates"     name="Candidates"  stroke={RC.GREEN}  strokeWidth={2} />
              <Line dataKey="interviews"     name="Interviews"  stroke={RC.AMBER}  strokeWidth={2} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Status Breakdowns">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="CV Registration Status">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.regByStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {(data.regByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Profile Request Status">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.profileByStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {(data.profileByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Interview Outcomes">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.interviewByStatus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                  {(data.interviewByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Interview Type Mix">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.interviewByType || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {(data.interviewByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Candidate Visibility">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="Public vs Private Candidates">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.publicVsPrivate || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {(data.publicVsPrivate || []).map((_: any, i: number) => <Cell key={i} fill={[RC.GREEN, RC.INDIGO][i % 2]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Candidates by Status">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.candidateByStatus || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                  {(data.candidateByStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
    </>
  );
}

/* ── EXPORT HELPERS ── */
// Most report sections take a bare `year`, but the finance section
// (`/reports/finance`) takes a `from`/`to` date range instead — build
// the right query string per section so the export machinery below
// (which otherwise treats every section generically) still requests
// data for the year actually selected on the page.
function sectionQuery(sectionId: string, year: string) {
  if (sectionId === 'finance') return `from=${year}-01-01&to=${year}-12-31`;
  return `year=${year}`;
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function screenshotElement(el: HTMLElement): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    scale: 1.5, useCORS: true, backgroundColor: '#f8fafc',
    height: el.scrollHeight, windowHeight: el.scrollHeight,
    scrollY: 0,
  });
  return canvas.toDataURL('image/png');
}

/* Single-section PDF: full scroll height capture */
async function exportSectionPDF(contentRef: HTMLElement, title: string) {
  const jsPDF  = (await import('jspdf')).default;
  const imgData = await screenshotElement(contentRef);
  const img = new window.Image();
  img.src = imgData;
  await new Promise(r => { img.onload = r; });
  const W = img.naturalWidth / 1.5;
  const H = img.naturalHeight / 1.5;
  const pdf = new jsPDF({ orientation: W > H ? 'landscape' : 'portrait', unit: 'px', format: [W, H] });
  pdf.addImage(imgData, 'PNG', 0, 0, W, H);
  pdf.save(`${title.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}

/* Export All PDF: fetches every section's data + screenshots each tab */
async function exportAllPDF(
  year: string,
  setSection: (s: string) => void,
  contentRef: React.RefObject<HTMLDivElement | null>,
  onProgress: (msg: string) => void,
) {
  const jsPDF    = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let firstPage = true;

  for (const sec of SECTIONS) {
    onProgress(`Capturing ${sec.label}…`);

    // Switch visible section and wait for React to render + data to load
    setSection(sec.id);
    await new Promise(r => setTimeout(r, 2200));

    // ── Data table page ──
    try {
      const { data } = await api.get(`/reports/${sec.id}?${sectionQuery(sec.id, year)}`);

      // Cover heading for this section
      if (!firstPage) pdf.addPage();
      firstPage = false;

      pdf.setFontSize(16);
      pdf.setTextColor(30, 30, 30);
      pdf.text(`Al Khadim — ${sec.label} Report (${year})`, 14, 18);
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated ${new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 25);

      let yPos = 32;

      // Summary/KPIs table
      const summaryObj = data.summary || data.kpis || {};
      if (Object.keys(summaryObj).length) {
        const rows = Object.entries(summaryObj).map(([k, v]) => [
          k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          String(v),
        ]);
        (autoTable as any)(pdf, {
          startY: yPos, head: [['Metric', 'Value']],
          body: rows, theme: 'striped',
          headStyles: { fillColor: [99, 102, 241], fontSize: 8 },
          bodyStyles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 80 } },
          margin: { left: 14, right: 14 },
        });
        yPos = (pdf as any).lastAutoTable.finalY + 8;
      }

      // Array tables (top 3 arrays, capped at 20 rows each)
      const arrays = Object.entries(data)
        .filter(([k, v]) => Array.isArray(v) && (v as any[]).length > 0 && k !== 'monthly' && k !== 'monthlyPipeline' && k !== 'monthlyTrend' && k !== 'monthlyPlacements' && k !== 'monthlyClients' && k !== 'revenueByMonth' && k !== 'payrollTrend')
        .slice(0, 4);

      for (const [key, val] of arrays) {
        const arr = (val as any[]).slice(0, 20);
        if (!arr.length || typeof arr[0] !== 'object') continue;
        const headers = Object.keys(arr[0]);
        const rows    = arr.map(row => headers.map(h => String(row[h] ?? '')));
        const label   = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

        if (yPos > 170) { pdf.addPage(); yPos = 14; }
        pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
        pdf.text(label, 14, yPos); yPos += 3;

        (autoTable as any)(pdf, {
          startY: yPos, head: [headers],
          body: rows, theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
        yPos = (pdf as any).lastAutoTable.finalY + 8;
      }
    } catch (e) { console.warn('table gen failed for', sec.id, e); }

    // ── Charts screenshot page ──
    if (contentRef.current) {
      try {
        const imgData = await screenshotElement(contentRef.current);
        const img = new window.Image(); img.src = imgData;
        await new Promise(r => { img.onload = r; });
        const pw = 297, ph = 210; // A4 landscape mm
        const iw = img.naturalWidth / 1.5, ih = img.naturalHeight / 1.5;
        const ratio = Math.min((pw - 28) / iw, (ph - 28) / ih);
        pdf.addPage();
        pdf.setFontSize(11); pdf.setTextColor(30, 30, 30);
        pdf.text(`${sec.label} — Charts`, 14, 12);
        pdf.addImage(imgData, 'PNG', 14, 18, iw * ratio, ih * ratio);
      } catch (e) { console.warn('chart screenshot failed for', sec.id, e); }
    }
  }

  pdf.save(`AlKhadim_Full_Report_${year}.pdf`);
}

async function exportExcel(section: string, year: string) {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();
  try {
    const { data } = await api.get(`/reports/${section}?${sectionQuery(section, year)}`);
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && (val as any[]).length > 0) {
        const ws = XLSX.utils.json_to_sheet(val as any[]);
        XLSX.utils.book_append_sheet(wb, ws, key.slice(0, 31));
      } else if ((key === 'kpis' || key === 'summary') && typeof val === 'object' && val !== null) {
        const rows = Object.entries(val as Record<string, any>).map(([k, v]) => ({ Metric: k, Value: v }));
        const ws   = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, key === 'kpis' ? 'KPIs' : 'Summary');
      }
    }
  } catch {}
  XLSX.writeFile(wb, `${section}_${year}.xlsx`);
}

async function exportCSV(section: string, year: string) {
  const XLSX = await import('xlsx');
  try {
    const { data } = await api.get(`/reports/${section}?${sectionQuery(section, year)}`);
    const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v) && (v as any[]).length > 0);
    if (!arrays.length) {
      const src  = data.summary || data.kpis || {};
      const rows = Object.entries(src).map(([k, v]) => ({ Metric: k, Value: v }));
      downloadText(XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)), `${section}_${year}.csv`, 'text/csv');
      return;
    }
    let combined = '';
    for (const [key, val] of arrays) {
      combined += `\n--- ${key} ---\n${XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(val as any[]))}\n`;
    }
    downloadText(combined, `${section}_${year}.csv`, 'text/csv');
  } catch {}
}

function ExportMenu({
  section, year, contentRef, setSection,
}: {
  section: string; year: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  setSection: (s: string) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const menuRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function run(type: 'pdf' | 'pdf-all' | 'excel' | 'csv') {
    setLoading(type); setOpen(false);
    try {
      const label = SECTIONS.find(s => s.id === section)?.label || section;
      if (type === 'pdf' && contentRef.current)
        await exportSectionPDF(contentRef.current, label);
      if (type === 'pdf-all')
        await exportAllPDF(year, setSection, contentRef, msg => setProgress(msg));
      if (type === 'excel') await exportExcel(section, year);
      if (type === 'csv')   await exportCSV(section, year);
    } finally {
      setLoading(null); setProgress('');
    }
  }

  return (
    <>
      {/* Full-screen overlay while exporting all */}
      {loading === 'pdf-all' && (
        <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Loader2 size={36} className="text-primary-400 animate-spin" />
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">Generating Full Report PDF</p>
            <p className="text-sm text-gray-400 mt-1">{progress || 'Preparing…'}</p>
          </div>
          <p className="text-xs text-gray-300 mt-2">This captures all {SECTIONS.length} sections — please wait</p>
        </div>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(o => !o)}
          disabled={!!loading}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {loading && loading !== 'pdf-all'
            ? <><div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Exporting…</>
            : <><Download size={13} /> Export</>}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1.5">Current section</p>

            <button onClick={() => run('pdf')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <Image size={13} className="text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">PDF (Charts)</p>
                <p className="text-[10px] text-gray-400">Full-page chart screenshot</p>
              </div>
            </button>

            <button onClick={() => run('excel')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                <Sheet size={13} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">Excel (.xlsx)</p>
                <p className="text-[10px] text-gray-400">All data in sheets</p>
              </div>
            </button>

            <button onClick={() => run('csv')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <Table size={13} className="text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700">CSV</p>
                <p className="text-[10px] text-gray-400">Raw data tables</p>
              </div>
            </button>

            <div className="border-t border-gray-100 mx-4 my-1" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-1 pb-1.5">All sections</p>

            <button onClick={() => run('pdf-all')}
              className="w-full flex items-center gap-3 px-4 py-2.5 mb-1 hover:bg-primary-50 transition-colors group">
              <div className="w-7 h-7 bg-primary-50 group-hover:bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={13} className="text-primary-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-700 group-hover:text-primary-600">Export All as PDF</p>
                <p className="text-[10px] text-gray-400">Tables + charts, all {SECTIONS.length} sections</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ── MAIN ── */
export default function ReportsPage() {
  const [section, setSection] = useState('overview');
  const [year, setYear]       = useState(String(new Date().getFullYear()));
  const contentRef            = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const active = SECTIONS.find(s => s.id === section) || SECTIONS[0];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-gray-100 py-4 px-2 shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Reports</p>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left
                  ${isActive ? 'bg-primary-400 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BarChart3 size={15} className="text-primary-400" />
            <span className="font-medium">Reports</span>
            <ChevronRight size={13} className="text-gray-300" />
            <span className="font-bold text-gray-800">{active.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <select value={section} onChange={e => setSection(e.target.value)}
              className="md:hidden text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
              {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400/30 font-semibold">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ExportMenu section={section} year={year} contentRef={contentRef} setSection={setSection} />
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6" ref={contentRef}>
          {section === 'overview'          && <OverviewTab    year={year} />}
          {section === 'recruitment'       && <RecruitmentTab year={year} />}
          {section === 'placements-detail' && <PlacementsTab  year={year} />}
          {section === 'pipeline'          && <PipelineTab    year={year} />}
          {section === 'revenue'           && <RevenueTab     year={year} />}
          {section === 'finance'           && <FinanceTab     year={year} />}
          {section === 'hr'                && <HrTab          year={year} />}
          {section === 'crm'               && <CrmTab         year={year} />}
        </div>
      </div>
    </div>
  );
}
