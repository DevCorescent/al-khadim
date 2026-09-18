'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, FileText, DollarSign, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Eye, Copy, Trash2, ChevronDown,
  BarChart2, ArrowUpRight,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, PieChart, Pie, Cell,
  BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import ExportMenu from '@/components/admin/ExportMenu';
import MarkPaidModal from './_components/MarkPaidModal';

const EXPORT_COLUMNS = [
  { key: 'invoiceNo',   label: 'Number' },
  { key: 'docType',     label: 'Type' },
  { key: 'client',      label: 'Client', exportValue: (r: any) => r.client?.companyName || '' },
  { key: 'subject',     label: 'Subject' },
  { key: 'issueDate',   label: 'Issue Date', exportValue: (r: any) => r.issueDate ? new Date(r.issueDate).toLocaleDateString('en-GB') : '' },
  { key: 'dueDate',     label: 'Due / Valid', exportValue: (r: any) => (r.dueDate || r.validUntil) ? new Date(r.dueDate || r.validUntil).toLocaleDateString('en-GB') : '' },
  { key: 'totalAmount', label: 'Amount' },
  { key: 'currency',    label: 'Currency' },
  { key: 'status',      label: 'Status' },
];

const DOC_TYPES  = ['ALL', 'INVOICE', 'PROFORMA_INVOICE', 'QUOTATION'];
const DOC_LABELS: Record<string, string> = { ALL: 'All', INVOICE: 'Invoices', PROFORMA_INVOICE: 'Proforma', QUOTATION: 'Quotations' };
const DOC_SHORT:  Record<string, string> = { INVOICE: 'INV', PROFORMA_INVOICE: 'PI', QUOTATION: 'QT' };

const STATUS_COLORS: Record<string, string> = {
  DRAFT:'bg-gray-100 text-gray-500', SENT:'bg-blue-100 text-blue-700',
  PAID:'bg-emerald-100 text-emerald-700', OVERDUE:'bg-red-100 text-red-600',
  CANCELLED:'bg-gray-100 text-gray-400', ACCEPTED:'bg-teal-100 text-teal-700',
  REJECTED:'bg-red-100 text-red-700', PENDING:'bg-amber-100 text-amber-700',
};
const CHART_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#a855f7'];

const fmt = (n: number, cur = 'AED') =>
  `${cur} ${(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function KpiCard({ label, value, icon: Icon, color = '#6366f1' }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color+'18' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-lg font-bold text-gray-900 tracking-tight leading-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function StatusDropdown({ doc, onUpdate }: { doc: any; onUpdate: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const statuses = doc.docType === 'QUOTATION'
    ? ['DRAFT','SENT','ACCEPTED','REJECTED','CANCELLED']
    : ['DRAFT','SENT','PAID','OVERDUE','CANCELLED'];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o=>!o)}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_COLORS[doc.status]||'bg-gray-100 text-gray-500'}`}>
        {doc.status} <ChevronDown size={9}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-xl z-20 min-w-[130px] overflow-hidden">
            {statuses.map(s => (
              <button key={s} onClick={() => { onUpdate(s); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 ${s===doc.status?'text-primary-600':'text-gray-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [docType,    setDocType]    = useState('ALL');
  const [status,     setStatus]     = useState('');
  const [search,     setSearch]     = useState('');
  const [year,       setYear]       = useState(String(new Date().getFullYear()));
  const [page,       setPage]       = useState(1);
  const [showStats,  setShowStats]  = useState(true);

  const buildParams = () => {
    const p = new URLSearchParams({ page: String(page), limit: '30', year });
    if (docType !== 'ALL') p.set('docType', docType);
    if (status)  p.set('status', status);
    if (search)  p.set('search', search);
    return p.toString();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', docType, status, search, page, year],
    queryFn: () => api.get(`/invoices?${buildParams()}`).then(r => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ['invoice-stats', year],
    queryFn: () => api.get(`/invoices/stats?year=${year}`).then(r => r.data),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice-stats'] }); toast.success('Deleted'); },
    onError: () => toast.error('Delete failed'),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/duplicate`).then(r => r.data),
    onSuccess: (doc: any) => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Duplicated'); router.push(`/admin/crm/invoices/${doc.id}/edit`); },
    onError: () => toast.error('Duplicate failed'),
  });
  const [payingDoc, setPayingDoc] = useState<any>(null);
  const updateStatus = useMutation({
    mutationFn: ({ id, status: s, accountId }: { id: string; status: string; accountId?: string }) =>
      api.put(`/invoices/${id}`, accountId ? { status: s, accountId } : { status: s }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      if (vars.accountId) qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success(vars.status === 'PAID' && vars.accountId ? 'Marked paid and recorded in Accounts' : 'Updated');
      setPayingDoc(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update status'),
  });

  /** Moving an unpaid document to PAID asks which bank account received the money. */
  function changeStatus(doc: any, s: string) {
    if (s === doc.status) return;
    if (s === 'PAID' && !doc.paidDate) { setPayingDoc(doc); return; }
    updateStatus.mutate({ id: doc.id, status: s });
  }

  const docs  = data?.data  || [];
  const total = data?.total || 0;
  const kpis  = stats?.kpis || {};

  return (
    <div className="p-5 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-xs text-gray-400 mt-0.5">Invoices · Proforma Invoices · Quotations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStats(s=>!s)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border transition-colors ${showStats?'bg-primary-50 text-primary-600 border-primary-200':'bg-white text-gray-500 border-gray-200'}`}>
            <BarChart2 size={14}/> Reports
          </button>
          <ExportMenu columns={EXPORT_COLUMNS} data={docs} filename="invoices" title="Invoices" disabled={isLoading} />
          {/* New doc dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors">
              <Plus size={15}/> New <ChevronDown size={13}/>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-xl z-20 min-w-[190px] hidden group-hover:block overflow-hidden">
              {[['INVOICE','Invoice'],['PROFORMA_INVOICE','Proforma Invoice'],['QUOTATION','Quotation']].map(([t,l]) => (
                <button key={t} onClick={() => router.push(`/admin/crm/invoices/new?type=${t}`)}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <FileText size={13} className="text-primary-400"/> {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial reports */}
      {showStats && stats && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total Invoiced"  value={fmt(kpis.totalInvoiced)}    icon={DollarSign}   color="#6366f1"/>
            <KpiCard label="Collected"        value={fmt(kpis.totalPaid)}        icon={CheckCircle2} color="#10b981"/>
            <KpiCard label="Outstanding"      value={fmt(kpis.totalOutstanding)} icon={Clock}        color="#f59e0b"/>
            <KpiCard label="Overdue"          value={fmt(kpis.totalOverdue)}     icon={AlertCircle}  color="#ef4444"/>
            <KpiCard label="Collection Rate"  value={`${kpis.collectionRate}%`}  icon={TrendingUp}   color="#3b82f6"/>
            <KpiCard label="Draft"            value={fmt(kpis.totalDraft)}       icon={FileText}     color="#a855f7"/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-700">Monthly Revenue</p>
                <select value={year} onChange={e => setYear(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                  {[2023,2024,2025,2026].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={stats.monthly||[]} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                  <XAxis dataKey="month" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:11}} tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip formatter={(v:any) => `AED ${Number(v).toLocaleString()}`}/>
                  <Legend iconSize={10}/>
                  <Bar dataKey="invoiced" fill="#6366f120" stroke="#6366f1" strokeWidth={1} name="Invoiced" radius={[4,4,0,0]}/>
                  <Line dataKey="paid" stroke="#10b981" strokeWidth={2} dot={false} name="Paid"/>
                  <Line dataKey="overdue" stroke="#ef4444" strokeWidth={2} dot={false} name="Overdue" strokeDasharray="4 2"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">By Status</p>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={stats.byStatus||[]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {(stats.byStatus||[]).map((_:any,i:number) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v:any) => `AED ${Number(v).toLocaleString()}`}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {(stats.byStatus||[]).map((s:any,i:number) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                      <span className="text-gray-500">{s.name}</span>
                    </span>
                    <span className="font-bold text-gray-700">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(stats.topClients||[]).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Top Clients by Revenue</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.topClients||[]} layout="vertical" margin={{top:0,right:0,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false}/>
                  <XAxis type="number" tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110}/>
                  <Tooltip formatter={(v:any)=>`AED ${Number(v).toLocaleString()}`}/>
                  <Bar dataKey="value" fill="#6366f1" radius={[0,4,4,0]} name="Revenue"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Doc type tabs */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 mb-4">
        {DOC_TYPES.map(dt => (
          <button key={dt} onClick={() => { setDocType(dt); setPage(1); }}
            className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl transition-colors ${docType===dt?'bg-primary-400 text-white':'text-gray-400 hover:text-gray-600'}`}>
            {DOC_LABELS[dt]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search by number, client…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white"/>
        </div>
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          <option value="">All Status</option>
          {['DRAFT','SENT','PAID','OVERDUE','ACCEPTED','REJECTED','CANCELLED'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={year} onChange={e=>setYear(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
          {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"/>
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <FileText size={36} className="mx-auto mb-3 opacity-30"/>
          <p className="font-semibold">No documents found</p>
          <button onClick={() => router.push('/admin/crm/invoices/new?type=INVOICE')}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary-500 border border-primary-200 bg-primary-50 px-5 py-2.5 rounded-xl hover:bg-primary-100 transition-colors">
            <Plus size={14}/> Create first document
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#','Type','Client','Subject','Issue Date','Due / Valid','Amount','Status','Actions'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc:any) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{doc.invoiceNo}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        doc.docType==='INVOICE'?'bg-indigo-100 text-indigo-700':
                        doc.docType==='PROFORMA_INVOICE'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
                        {DOC_SHORT[doc.docType]||doc.docType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{doc.client?.companyName}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">{doc.subject||'—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(doc.issueDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {doc.dueDate||doc.validUntil ? (
                        <span className={doc.dueDate&&new Date(doc.dueDate)<new Date()&&doc.status!=='PAID'?'text-red-500 font-semibold':'text-gray-400'}>
                          {new Date(doc.dueDate||doc.validUntil).toLocaleDateString('en-GB')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">{fmt(doc.totalAmount,doc.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusDropdown doc={doc} onUpdate={s => changeStatus(doc, s)}/>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => router.push(`/admin/crm/invoices/${doc.id}`)}
                          title="View" className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400"><Eye size={13}/></button>
                        <button onClick={() => router.push(`/admin/crm/invoices/${doc.id}/edit`)}
                          title="Edit" className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400"><FileText size={13}/></button>
                        <button onClick={() => duplicate.mutate(doc.id)}
                          title="Duplicate" className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-400"><Copy size={13}/></button>
                        <button onClick={() => { if(confirm(`Delete ${doc.invoiceNo}?`)) del.mutate(doc.id); }}
                          title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 30 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
              <p className="text-xs text-gray-400">Showing {(page-1)*30+1}–{Math.min(page*30,total)} of {total}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <span className="text-xs text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p=>p+1)} disabled={page*30>=total}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
      <MarkPaidModal
        invoice={payingDoc}
        onClose={() => setPayingDoc(null)}
        saving={updateStatus.isPending}
        onConfirm={accountId => payingDoc && updateStatus.mutate({ id: payingDoc.id, status: 'PAID', accountId })}
      />
    </div>
  );
}
