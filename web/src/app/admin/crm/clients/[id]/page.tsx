'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Building2, Phone, Mail, Globe, MapPin, Briefcase,
  DollarSign, Users, Calendar, CheckCircle2, Clock, TrendingUp,
  FileText, Activity, Target, Star, MoreHorizontal, Circle,
  ChevronRight, AlertCircle, Award, Share2, UserPlus, Ban, Send, Power,
  Tag, X, Plus,
} from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/admin/Modal';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';
import ClientFormModal from '@/components/admin/crm/ClientFormModal';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#a855f7','#ec4899','#14b8a6'];

const DEAL_STAGE_COLORS: Record<string, string> = {
  LEAD: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-amber-100 text-amber-700',
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-600',
};

const statusColor: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  FILLED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-400',
  OVERDUE: 'bg-red-100 text-red-600',
  NEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color = '#6366f1' }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const TABS = ['Overview', 'Deals', 'Jobs', 'Invoices', 'Follow-Ups', 'Enquiries', 'Placements', 'Timeline', 'Shared Candidates', 'Portal Users'];

const SHARE_STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DOWNLOADED: 'bg-purple-100 text-purple-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  INTERVIEW_REQUESTED: 'bg-amber-100 text-amber-700',
  INTERVIEW_SCHEDULED: 'bg-indigo-100 text-indigo-700',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'COMPANY_ADMIN' | 'COMPANY_MEMBER'>('COMPANY_ADMIN');
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagFocused, setTagFocused] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-detail', id],
    queryFn: () => api.get(`/clients/${id}/detail`).then(r => r.data),
    staleTime: 0,
  });

  const { data: dealsData } = useQuery({
    queryKey: ['client-deals', id],
    queryFn: () => api.get('/deals', { params: { clientId: id, limit: 100 } }).then(r => r.data),
  });
  const deals = dealsData?.data || [];

  const { data: allTags = [] } = useQuery({
    queryKey: ['client-tags-all'],
    queryFn: () => api.get('/clients/tags/all').then(r => r.data),
  });

  const createDealMutation = useMutation({
    mutationFn: (body: any) => api.post('/deals', { ...body, clientId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-deals', id] });
      toast.success('Deal created');
      setNewDealOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create deal'),
  });

  const updateClientMutation = useMutation({
    mutationFn: (body: any) => api.put(`/clients/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated');
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update client'),
  });

  const updateTagsMutation = useMutation({
    mutationFn: (tags: string[]) => api.put(`/clients/${id}`, { tags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', id] });
      qc.invalidateQueries({ queryKey: ['client-tags-all'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update tags'),
  });

  function handleNewDealSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(fd.entries());
    if (body.value) body.value = Number(body.value);
    if (!body.expectedCloseDate) delete body.expectedCloseDate;
    createDealMutation.mutate(body);
  }

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/client-users', { clientId: id, name: inviteName, email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-detail', id] });
      toast.success('Invite sent');
      setInviteOpen(false); setInviteName(''); setInviteEmail(''); setInviteRole('COMPANY_ADMIN');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to invite'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/client-users/${userId}/toggle-active`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', id] }); toast.success('Updated'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update portal user'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/client-users/${userId}/resend-invite`),
    onSuccess: () => { toast.success('Invite resent'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to resend'),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/clients/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', id] }); toast.success('Company approved'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/clients/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-detail', id] }); toast.success('Company rejected'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to reject'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
  if (error || !data) return <div className="p-8 text-red-500">Failed to load client.</div>;

  const { client, analytics, revenueByMonth, jobs, invoices, followUps, enquiries, placements, timeline, clientUsers = [], profileShares = [] } = data;

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || (client.tags || []).includes(t)) { setTagInput(''); return; }
    updateTagsMutation.mutate([...(client.tags || []), t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    updateTagsMutation.mutate((client.tags || []).filter((x: string) => x !== tag));
  }

  // Outstanding invoices are SENT (awaiting payment) or OVERDUE; there is no PENDING invoice status.
  const invoiceBreakdown = [
    { name: 'Paid',              value: invoices.filter((i: any) => i.status === 'PAID').length,    color: '#10b981' },
    { name: 'Sent (unpaid)',     value: invoices.filter((i: any) => i.status === 'SENT').length,    color: '#f59e0b' },
    { name: 'Overdue',           value: invoices.filter((i: any) => i.status === 'OVERDUE').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const tagSuggestions = (allTags || [])
    .filter((t: string) => !(client.tags || []).includes(t))
    .filter((t: string) => t.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={15} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Link href="/admin/crm" className="hover:text-gray-600">CRM</Link>
            <ChevronRight size={12} />
            <span className="text-gray-700 font-semibold">{client.companyName}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Logo avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-bold text-xl">{client.companyName[0]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{client.companyName}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {client.isActive ? 'Active' : 'Inactive'}
                </span>
                {client.status && client.status !== 'APPROVED' && <Badge status={client.status} />}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {(client.industryRef?.name || client.industry) && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Briefcase size={11} /> {client.industryRef?.name || client.industry}
                  </span>
                )}
                {client.city && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={11} /> {client.city}, {client.country}
                  </span>
                )}
                {client.website && (
                  <a href={client.website} target="_blank" rel="noreferrer"
                    className="text-xs text-primary-500 flex items-center gap-1 hover:underline">
                    <Globe size={11} /> {client.website}
                  </a>
                )}
                {client.source && (
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                    Source: {client.source}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={11} /> {client.contactPerson}</span>
                <a href={`mailto:${client.email}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-primary-500">
                  <Mail size={11} /> {client.email}
                </a>
                <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} /> {client.phone}</span>
              </div>

              {/* Tags editor */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <Tag size={11} className="text-gray-300 shrink-0" />
                {(client.tags || []).map((t: string) => (
                  <span key={t} className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 pl-2 pr-1 py-0.5 rounded-full">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-red-500 transition-colors" title="Remove tag">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onFocus={() => setTagFocused(true)}
                    onBlur={() => setTimeout(() => setTagFocused(false), 150)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                    placeholder="+ Add tag"
                    className="text-[11px] w-24 focus:w-32 transition-all border border-dashed border-gray-200 rounded-full px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400/40 focus:border-primary-300"
                  />
                  {tagFocused && tagInput && tagSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px]">
                      {tagSuggestions.map((t: string) => (
                        <button key={t} onMouseDown={() => addTag(t)}
                          className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)}
              className="text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">
              Edit Client
            </button>
            <Link href={`/admin/crm/invoices/new?clientId=${id}`}
              className="text-sm font-semibold bg-primary-400 text-white px-4 py-2 rounded-xl hover:bg-primary-500 transition-colors">
              + Invoice
            </Link>
          </div>
        </div>

        {client.status === 'PENDING' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                This company self-registered and is awaiting approval before it can access its dashboard.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const reason = prompt('Reason for rejection (optional):');
                  if (reason === null) return; // cancelled
                  rejectMutation.mutate(reason);
                }}
                disabled={rejectMutation.isPending}
                className="text-sm font-semibold border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                Reject
              </button>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="text-sm font-bold bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-60"
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve Company'}
              </button>
            </div>
          </div>
        )}

        {client.status === 'REJECTED' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-red-700 font-medium">
              This company's self-registration was rejected{client.rejectionReason ? `: ${client.rejectionReason}` : '.'}
            </p>
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="text-sm font-bold bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-60 shrink-0"
            >
              Approve Anyway
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0.5 mt-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap transition-all ${
                tab === t ? 'bg-primary-400 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <KpiCard label="Total Revenue"    value={`AED ${analytics.revenue.totalRevenue.toLocaleString()}`} icon={DollarSign}  color="#6366f1" />
              <KpiCard label="Paid"             value={`AED ${analytics.revenue.paidRevenue.toLocaleString()}`}  icon={CheckCircle2} color="#10b981" />
              <KpiCard label="Pending"          value={`AED ${analytics.revenue.pendingRevenue.toLocaleString()}`} icon={Clock}     color="#f59e0b" />
              <KpiCard label="Collection Rate"  value={`${analytics.revenue.collectionRate}%`}                   icon={TrendingUp}  color="#10b981" />
              <KpiCard label="Jobs"             value={analytics.jobs.totalJobs}  sub={`${analytics.jobs.openJobs} open`}  icon={Briefcase}  color="#3b82f6" />
              <KpiCard label="Placements"       value={analytics.placements}      sub={`${analytics.jobs.fillRate}% fill rate`} icon={Award}  color="#a855f7" />
            </div>

            {/* Revenue chart + follow-ups donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">Revenue This Year</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar  dataKey="total" name="Invoiced" fill="#6366f1" radius={[4,4,0,0]} fillOpacity={0.3} />
                    <Line dataKey="paid"  name="Paid"     stroke="#10b981" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">Job Status</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Open',   value: analytics.jobs.openJobs },
                        { name: 'Filled', value: analytics.jobs.filledJobs },
                        { name: 'Closed', value: analytics.jobs.closedJobs },
                      ].filter(d => d.value > 0)}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    >
                      {['#10b981','#6366f1','#94a3b8'].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent activity cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              {/* Latest invoices */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-700">Latest Invoices</p>
                  <button onClick={() => setTab('Invoices')} className="text-xs text-primary-500 font-semibold hover:underline">View all</button>
                </div>
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-700">{inv.invoiceNo}</p>
                        <p className="text-[10px] text-gray-400">{new Date(inv.createdAt).toLocaleDateString('en-AE')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-800">AED {inv.totalAmount.toLocaleString()}</p>
                        <Badge status={inv.status} />
                      </div>
                    </div>
                  ))}
                  {!invoices.length && <p className="text-xs text-gray-400">No invoices yet</p>}
                </div>
              </div>

              {/* Latest jobs */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-700">Job Orders</p>
                  <button onClick={() => setTab('Jobs')} className="text-xs text-primary-500 font-semibold hover:underline">View all</button>
                </div>
                <div className="space-y-3">
                  {jobs.slice(0, 5).map((j: any) => (
                    <div key={j.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-700 truncate max-w-[140px]">{j.title}</p>
                        <p className="text-[10px] text-gray-400">{j.positionsCount} position{j.positionsCount !== 1 ? 's' : ''}</p>
                      </div>
                      <Badge status={j.status} />
                    </div>
                  ))}
                  {!jobs.length && <p className="text-xs text-gray-400">No jobs yet</p>}
                </div>
              </div>

              {/* Follow-ups */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-gray-700">Follow-Ups</p>
                  <button onClick={() => setTab('Follow-Ups')} className="text-xs text-primary-500 font-semibold hover:underline">View all</button>
                </div>
                <div className="space-y-3">
                  {followUps.slice(0, 5).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.isCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{f.subject}</p>
                        <p className="text-[10px] text-gray-400">{f.type} · {new Date(f.dueDate).toLocaleDateString('en-AE')}</p>
                      </div>
                    </div>
                  ))}
                  {!followUps.length && <p className="text-xs text-gray-400">No follow-ups yet</p>}
                </div>
              </div>
            </div>

            {/* Follow-up type breakdown + placements */}
            {analytics.followUps.byType.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-700 mb-4">Follow-Up Types</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.followUps.byType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Count" radius={[4,4,0,0]}>
                        {analytics.followUps.byType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-700 mb-4">Invoice Status Breakdown</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={invoiceBreakdown}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      >
                        {invoiceBreakdown.map(d => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Notes */}
            {client.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-5">
                <p className="text-xs font-bold text-amber-700 mb-1">Notes</p>
                <p className="text-sm text-amber-800">{client.notes}</p>
              </div>
            )}
          </>
        )}

        {/* ── DEALS ── */}
        {tab === 'Deals' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setNewDealOpen(true)}
                className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-500 transition-colors">
                <Plus size={13} /> New Deal
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Deals ({deals.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {deals.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No deals yet</p>}
                {deals.map((d: any) => (
                  <Link key={d.id} href={`/admin/crm/deals/${d.id}`}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{d.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${DEAL_STAGE_COLORS[d.stage] || 'bg-gray-100 text-gray-500'}`}>
                          {d.stage}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {d.expectedCloseDate ? `Expected close ${new Date(d.expectedCloseDate).toLocaleDateString('en-AE')}` : 'No expected close date'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{d.currency || 'AED'} {Number(d.value || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">{d.probability}% probability</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── JOBS ── */}
        {tab === 'Jobs' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-800">Job Orders ({jobs.length})</p>
              <div className="flex gap-2 text-xs">
                <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{analytics.jobs.openJobs} Open</span>
                <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{analytics.jobs.filledJobs} Filled</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {jobs.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No jobs yet</p>}
              {jobs.map((j: any) => (
                <div key={j.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-800 text-sm">{j.title}</p>
                        <Badge status={j.status} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
                        {j.location && <span className="flex items-center gap-1"><MapPin size={10}/>{j.location}</span>}
                        <span className="flex items-center gap-1"><Users size={10}/>{j.positionsCount} position{j.positionsCount !== 1 ? 's' : ''} · {j.filledCount} filled</span>
                        {j.salaryMin && <span className="flex items-center gap-1"><DollarSign size={10}/>AED {j.salaryMin.toLocaleString()}–{j.salaryMax?.toLocaleString()}</span>}
                        <span>{new Date(j.createdAt).toLocaleDateString('en-AE')}</span>
                      </div>
                      {j.candidateJobs?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {j.candidateJobs.map((cj: any) => (
                            <span key={cj.id} className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                              {cj.candidate.firstName} {cj.candidate.lastName} · <Badge status={cj.status} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link href={`/admin/jobs/${j.id}`}
                      className="text-xs text-primary-500 font-semibold shrink-0 hover:underline">View</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab === 'Invoices' && (
          <>
            {/* Revenue summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <KpiCard label="Total Invoiced" value={`AED ${analytics.revenue.totalRevenue.toLocaleString()}`} icon={DollarSign}  color="#6366f1" />
              <KpiCard label="Paid"           value={`AED ${analytics.revenue.paidRevenue.toLocaleString()}`}  icon={CheckCircle2} color="#10b981" />
              <KpiCard label="Pending"        value={`AED ${analytics.revenue.pendingRevenue.toLocaleString()}`} icon={Clock}     color="#f59e0b" />
              <KpiCard label="Overdue"        value={`AED ${analytics.revenue.overdueRevenue.toLocaleString()}`} icon={AlertCircle} color="#ef4444" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Invoices ({invoices.length})</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Invoice No','Date','Due Date','Amount','Tax','Total','Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoices.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-400">No invoices yet</td></tr>
                    )}
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-700">{inv.invoiceNo}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.createdAt).toLocaleDateString('en-AE')}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-AE') : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">AED {inv.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">AED {inv.tax.toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">AED {inv.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3"><Badge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── FOLLOW-UPS ── */}
        {tab === 'Follow-Ups' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-2">
              <KpiCard label="Total"     value={analytics.followUps.totalFollowUps}     icon={Activity}      color="#6366f1" />
              <KpiCard label="Completed" value={analytics.followUps.completedFollowUps} icon={CheckCircle2}  color="#10b981" />
              <KpiCard label="Pending"   value={analytics.followUps.pendingFollowUps}   icon={Clock}         color="#f59e0b" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">All Follow-Ups ({followUps.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {followUps.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No follow-ups yet</p>}
                {followUps.map((f: any) => (
                  <div key={f.id} className="px-5 py-4 flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${f.isCompleted ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-800">{f.subject}</p>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{f.type}</span>
                        {f.isCompleted && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Done</span>}
                      </div>
                      {f.notes && <p className="text-xs text-gray-400 mt-0.5">{f.notes}</p>}
                      <div className="flex gap-3 text-[10px] text-gray-400 mt-1">
                        <span>Due: {new Date(f.dueDate).toLocaleDateString('en-AE')}</span>
                        {f.completedAt && <span>Completed: {new Date(f.completedAt).toLocaleDateString('en-AE')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ENQUIRIES ── */}
        {tab === 'Enquiries' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800">Enquiries ({enquiries.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {enquiries.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No enquiries yet</p>}
              {enquiries.map((e: any) => (
                <div key={e.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-800">{e.service || 'General Enquiry'}</p>
                        <Badge status={e.status} />
                      </div>
                      <p className="text-xs text-gray-500">{e.contactName} · {e.email}</p>
                      {e.message && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{e.message}</p>}
                    </div>
                    <p className="text-[10px] text-gray-400 shrink-0">{new Date(e.createdAt).toLocaleDateString('en-AE')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PLACEMENTS ── */}
        {tab === 'Placements' && (
          <div className="space-y-5">
            <KpiCard label="Total Placements" value={placements.length} icon={Award} color="#a855f7" />
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Placed Candidates ({placements.length})</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Candidate','Nationality','Job Title','Placement Date'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {placements.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-sm text-gray-400">No placements yet</td></tr>
                    )}
                    {placements.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-700">{p.candidateName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{p.nationality || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.jobTitle}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.date).toLocaleDateString('en-AE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE ── */}
        {tab === 'Timeline' && (
          <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="font-bold text-gray-800 mb-1">Notes &amp; Activity</p>
            <p className="text-xs text-gray-400 mb-4">Logged notes, calls, meetings and stage changes for this client</p>
            <ActivityTimeline clientId={id} />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="font-bold text-gray-800 mb-1">Recent Activity</p>
            <p className="text-xs text-gray-400 mb-6">Cross-entity history from invoices, jobs, follow-ups and enquiries</p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-5">
                {timeline.length === 0 && <p className="text-sm text-gray-400 ml-10">No activity yet</p>}
                {timeline.map((item: any, i: number) => {
                  const icons: Record<string, any> = {
                    invoice: DollarSign, job: Briefcase, followup: Phone, enquiry: Mail,
                  };
                  const Icon = icons[item.type] || Circle;
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 bg-white border-2"
                        style={{ borderColor: item.color }}>
                        <Icon size={13} style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-800">{item.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.subtitle}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 shrink-0 mt-1">
                            {new Date(item.date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── SHARED CANDIDATES ── */}
        {tab === 'Shared Candidates' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800">Profile Shares ({profileShares.length})</p>
              <p className="text-xs text-gray-400 mt-0.5">Candidate profiles shared with this company</p>
            </div>
            <div className="divide-y divide-gray-50">
              {profileShares.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No profiles shared yet — use "Share Profile" from a candidate's page</p>}
              {profileShares.map((s: any) => (
                <Link key={s.id} href={`/admin/profile-shares/${s.id}`} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {s.candidate?.firstName?.[0]}{s.candidate?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{s.candidate?.firstName} {s.candidate?.lastName}</p>
                      <p className="text-[11px] text-gray-400">{s.job?.title || 'General profile'} · sent by {s.sentByUser?.name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${SHARE_STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>{s.status?.replace(/_/g, ' ')}</span>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(s.sentAt).toLocaleDateString('en-AE')}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── PORTAL USERS ── */}
        {tab === 'Portal Users' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setInviteOpen(v => !v)} className="flex items-center gap-1.5 bg-primary-400 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-500 transition-colors">
                <UserPlus size={13} /> Invite Portal User
              </button>
            </div>

            {inviteOpen && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name</label>
                  <input className="input text-sm" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Contact name" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
                  <input className="input text-sm" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="contact@company.com" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role</label>
                  <select className="input text-sm" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                    <option value="COMPANY_MEMBER">Company Member</option>
                  </select>
                </div>
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteName || !inviteEmail || inviteMutation.isPending}
                  className="btn-primary text-sm py-2.5 justify-center disabled:opacity-50"
                >
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Portal Users ({clientUsers.length})</p>
                <p className="text-xs text-gray-400 mt-0.5">People at {client.companyName} who can log into the company portal</p>
              </div>
              <div className="divide-y divide-gray-50">
                {clientUsers.length === 0 && <p className="px-5 py-8 text-sm text-gray-400 text-center">No portal users yet</p>}
                {clientUsers.map((u: any) => (
                  <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800">{u.name}</p>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{u.role === 'COMPANY_ADMIN' ? 'Admin' : 'Member'}</span>
                        {!u.acceptedAt && <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Invite Pending</span>}
                        {!u.isActive && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Deactivated</span>}
                      </div>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {u.lastLogin ? `Last login ${new Date(u.lastLogin).toLocaleDateString('en-AE')}` : 'Never logged in'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!u.acceptedAt && (
                        <button onClick={() => resendInviteMutation.mutate(u.id)} title="Resend invite"
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                          <Send size={13} />
                        </button>
                      )}
                      <button onClick={() => toggleActiveMutation.mutate(u.id)} title={u.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-red-400 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                        <Power size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Deal Modal */}
      <Modal isOpen={newDealOpen} onClose={() => setNewDealOpen(false)} title="New Deal" size="sm">
        <form onSubmit={handleNewDealSubmit} className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input name="title" required placeholder="e.g. Recruitment Retainer" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value</label>
              <input name="value" type="number" step="0.01" min="0" placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select name="currency" defaultValue="AED" className="input">
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Expected Close Date</label>
            <input name="expectedCloseDate" type="date" className="input" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setNewDealOpen(false)} className="btn-outline flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={createDealMutation.isPending} className="btn-primary flex-1 justify-center disabled:opacity-60">
              {createDealMutation.isPending ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </form>
      </Modal>

      <ClientFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        editing={client}
        saving={updateClientMutation.isPending}
        onSubmit={body => updateClientMutation.mutate(body)}
      />
    </div>
  );
}
