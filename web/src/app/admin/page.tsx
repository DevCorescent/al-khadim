'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSettings } from '@/lib/useSettings';
import Link from 'next/link';
import {
  Users, Briefcase, Building2, UserCheck, AlertCircle, Clock,
  TrendingUp, DollarSign, CheckCircle2, FileText, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line, Area,
} from 'recharts';

const COLORS = ['#6366f1','#1a1a2e','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899'];

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
  });
  const { fmtCurrency, settings } = useSettings();

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
        <p className="text-gray-500 text-sm">Loading dashboard…</p>
      </div>
    </div>
  );

  const kpis   = data?.kpis   || {};
  const charts = data?.charts  || {};
  const recent = data?.recentActivity || {};

  const operationalKpis = [
    { label:'Total Candidates',   value: kpis.totalCandidates,         icon: Users,       color:'bg-blue-500',    change:`+${kpis.newCandidatesThisMonth||0} this month` },
    { label:'Active Clients',     value: kpis.totalClients,            icon: Building2,   color:'bg-primary-400', change:'Total clients' },
    { label:'Open Jobs',          value: kpis.openJobs,                icon: Briefcase,   color:'bg-green-500',   change:`${kpis.totalJobs||0} total jobs` },
    { label:'Active Employees',   value: kpis.activeEmployees,         icon: UserCheck,   color:'bg-purple-500',  change:`${kpis.totalEmployees||0} total` },
    { label:'Pending Follow-Ups', value: kpis.pendingFollowUps,        icon: Clock,       color:'bg-orange-500',  change:'Requires attention' },
    { label:'Pending Leaves',     value: kpis.pendingLeaves,           icon: AlertCircle, color:'bg-red-500',     change:'Awaiting approval' },
    { label:'Expiring Docs',      value: kpis.expiringDocs,            icon: AlertCircle, color:'bg-yellow-500',  change:'Within 30 days' },
    { label:'New This Month',     value: kpis.newCandidatesThisMonth,  icon: TrendingUp,  color:'bg-teal-500',    change:'Candidates' },
  ];

  const revenueKpis = [
    {
      label: `Revenue (${new Date().getFullYear()})`,
      value: fmtCurrency(kpis.totalRevenue || 0),
      icon: BarChart2,
      color: 'bg-indigo-500',
      change: `${settings.currency} YTD invoiced`,
      highlight: true,
    },
    {
      label: 'Paid Revenue',
      value: fmtCurrency(kpis.paidRevenue || 0),
      icon: CheckCircle2,
      color: 'bg-emerald-500',
      change: 'Collected this year',
    },
    {
      label: 'Pending Collection',
      value: fmtCurrency(kpis.pendingRevenue || 0),
      icon: DollarSign,
      color: 'bg-amber-500',
      change: 'Sent / awaiting payment',
    },
    {
      label: 'Overdue Invoices',
      value: kpis.overdueInvoices || 0,
      icon: FileText,
      color: 'bg-red-500',
      change: 'Require immediate follow-up',
    },
  ];

  const candidateStatusData = (charts.candidatesByStatus || []).map((s: any) => ({
    name: s.status,
    value: s._count.status,
  }));

  const monthlyRevenue = (charts.monthlyRevenue || []).filter((m: any) => m.invoiced > 0 || m.paid > 0);

  const collectionRate = kpis.totalRevenue > 0
    ? Math.round((kpis.paidRevenue / kpis.totalRevenue) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Revenue KPIs ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Financial Overview · {new Date().getFullYear()}</h2>
          <Link href="/admin/crm/invoices" className="text-xs font-bold text-primary-500 hover:underline">
            View Invoices →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {revenueKpis.map(card => (
            <div key={card.label}
              className={`bg-white rounded-xl border p-5 flex items-start justify-between ${card.highlight ? 'border-primary-200 ring-1 ring-primary-200' : 'border-gray-100'}`}>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
                <p className={`text-xl font-black ${card.highlight ? 'text-primary-600' : 'text-gray-900'}`}>{card.value ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-1">{card.change}</p>
              </div>
              <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}>
                <card.icon size={18} className="text-white"/>
              </div>
            </div>
          ))}
        </div>

        {/* Collection rate progress */}
        {kpis.totalRevenue > 0 && (
          <div className="mt-3 bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center gap-4">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Collection Rate</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{width:`${collectionRate}%`}}/>
            </div>
            <span className="text-sm font-black text-emerald-600 whitespace-nowrap">{collectionRate}%</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">of {fmtCurrency(kpis.totalRevenue)} collected</span>
          </div>
        )}
      </div>

      {/* ── Operational KPIs ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Operations Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {operationalKpis.map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-1">{card.change}</p>
              </div>
              <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}>
                <card.icon size={18} className="text-white"/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Monthly Revenue</h3>
            <span className="text-xs text-gray-400 font-mono">{settings.currency}</span>
          </div>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={charts.monthlyRevenue || []} margin={{top:4,right:4,bottom:0,left:0}}>
                <XAxis dataKey="month" tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                <Tooltip formatter={(v: number) => fmtCurrency(v)} contentStyle={{fontSize:11,borderRadius:8}}/>
                <Bar dataKey="invoiced" fill="#6366f120" name="Invoiced" radius={[4,4,0,0]}/>
                <Bar dataKey="paid" fill="#6366f1" name="Paid" radius={[4,4,0,0]}/>
                <Line type="linear" dataKey="paid" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5, fill: "#10b981" }} name="Paid trend"/>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <BarChart2 size={32} className="text-gray-200 mx-auto mb-2"/>
                <p className="text-gray-400 text-sm">No invoice data yet</p>
                <Link href="/admin/crm/invoices/new" className="text-xs text-primary-500 font-bold hover:underline mt-1 inline-block">
                  Create your first invoice →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Candidate Status Pie */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Candidates by Status</h3>
          {candidateStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={candidateStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {candidateStatusData.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]}/>
                  ))}
                </Pie>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Candidates</h3>
          <div className="space-y-3">
            {(recent.recentCandidates || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-500 font-bold text-xs">
                    {c.firstName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`badge text-xs ${
                  c.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                  c.status === 'SHORTLISTED' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{c.status}</span>
              </div>
            ))}
            {!recent.recentCandidates?.length && (
              <p className="text-sm text-gray-400 text-center py-4">No candidates yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Clients</h3>
          <div className="space-y-3">
            {(recent.recentClients || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xs">
                    {c.companyName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.companyName}</p>
                    <p className="text-xs text-gray-400">{c.contactPerson} · {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Link href={`/admin/crm/clients/${c.id}`} className="text-xs text-primary-500 hover:underline font-bold">View</Link>
              </div>
            ))}
            {!recent.recentClients?.length && (
              <p className="text-sm text-gray-400 text-center py-4">No clients yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
