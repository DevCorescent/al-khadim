'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import ClientFormModal, { CLIENT_FORM_FIELDS } from '@/components/admin/crm/ClientFormModal';
import toast from 'react-hot-toast';
import {
  Building2, Search, Plus, Pencil, Trash2, Eye, Phone, Mail,
  MapPin, Briefcase, DollarSign, CheckCircle2,
  LayoutGrid, List, Upload, FileText, AlertTriangle, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useIndustries } from '@/lib/taxonomy';
import ExportMenu from '@/components/admin/ExportMenu';
import ImportCSVModal from '@/components/admin/ImportCSVModal';

const EXPORT_COLUMNS = [
  { key: 'companyName',   label: 'Company Name' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'email',         label: 'Email' },
  { key: 'phone',         label: 'Phone' },
  { key: 'city',          label: 'City' },
  { key: 'country',       label: 'Country' },
  { key: 'industry',      label: 'Industry', exportValue: (r: any) => r.industryRef?.name || r.industry || '' },
  { key: '_count',        label: 'Jobs', exportValue: (r: any) => r._count?.jobs || 0 },
  { key: 'totalRevenue',  label: 'Total Revenue' },
  { key: 'isActive',      label: 'Status', exportValue: (r: any) => r.isActive ? 'Active' : 'Inactive' },
  { key: 'status',        label: 'Approval' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function ClientStatusBadge({ status }: { status?: string }) {
  if (!status || status === 'APPROVED') return null;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-400'}`}>
      {status === 'PENDING' ? 'Pending Approval' : status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18' }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-xs font-semibold text-gray-400">{label}</p>
      </div>
    </div>
  );
}

const fmtDue = (d: string) => new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' });

/** Every requested document has been approved. */
const isVerified = (docs: any) => !!docs && docs.total > 0 && docs.approved === docs.total;

function VerifiedBadge({ docs }: { docs: any }) {
  if (!isVerified(docs)) return null;
  return (
    <span title="All requested business documents are approved"
      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
      <BadgeCheck size={11} /> Verified
    </span>
  );
}

/** Chips summarising a client's requested documents (Super Admin only; `docs` is null for others). */
function DocChips({ docs }: { docs: any }) {
  const open = docs.requested + docs.rejected;
  return (
    <div className="flex flex-wrap gap-1">
      {docs.overdue > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
          <AlertTriangle size={9} /> {docs.overdue} overdue
        </span>
      )}
      {open - docs.overdue > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{open - docs.overdue} not uploaded</span>
      )}
      {docs.uploaded > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{docs.uploaded} to review</span>
      )}
    </div>
  );
}

function DocumentStatus({ docs, onOpen }: { docs: any; onOpen: () => void }) {
  // Not a Super Admin (undefined) or nothing requested yet (null): show nothing.
  if (!docs) return null;
  if (isVerified(docs)) {
    return (
      <button type="button" onClick={onOpen} title="Open this client's documents"
        className="w-full mb-4 flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/50 px-2.5 py-2 text-[11px] font-semibold text-emerald-700 hover:border-emerald-200">
        <BadgeCheck size={13} /> Verified · all {docs.total} documents approved
      </button>
    );
  }
  const received = docs.uploaded + docs.approved;
  const pct = docs.total ? Math.round((docs.approved / docs.total) * 100) : 0;
  const tone = docs.overdue > 0 ? 'border-red-100 bg-red-50/40' : docs.requested + docs.rejected > 0 ? 'border-amber-100 bg-amber-50/40' : 'border-gray-100';
  return (
    <button type="button" onClick={onOpen} title="Open this client's documents"
      className={`w-full text-left mb-4 rounded-xl border p-2.5 space-y-1.5 hover:border-primary-200 transition-colors ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-600"><FileText size={11} /> Documents</span>
        <span className="text-[10px] font-semibold text-gray-500">{received}/{docs.total} uploaded · {docs.approved} approved</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <DocChips docs={docs} />
      {docs.missing?.length > 0 && (
        <p className="text-[10px] text-gray-500 leading-snug">
          <span className="font-semibold text-gray-600">Missing: </span>
          {docs.missing.slice(0, 3).map((m: any, i: number) => (
            <span key={i} className={m.overdue ? 'text-red-600 font-semibold' : ''}>
              {i > 0 && ', '}{m.title}{m.rejected ? ' (re-upload)' : ''}{m.dueDate ? ` · due ${fmtDue(m.dueDate)}` : ''}
            </span>
          ))}
          {docs.missing.length > 3 && <span> +{docs.missing.length - 3} more</span>}
        </p>
      )}
    </button>
  );
}

function ClientCard({ client, onEdit, onDelete, onView }: any) {
  const totalRevenue = client.totalRevenue || 0;
  const paidRevenue  = client.paidRevenue  || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-primary-400 to-primary-300" />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-600 font-bold text-lg">{client.companyName[0]}</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-snug flex flex-wrap items-center gap-1.5">
                {client.companyName} <VerifiedBadge docs={client.documents} />
              </p>
              {(client.industryRef?.name || client.industry) && <p className="text-[10px] text-gray-400 font-medium mt-0.5">{client.industryRef?.name || client.industry}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ClientStatusBadge status={client.status} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {client.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1 mb-3">
          <p className="flex items-center gap-1.5 text-xs text-gray-500"><CheckCircle2 size={11} className="text-gray-300" /> {client.contactPerson}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-400"><Mail size={11} className="text-gray-300" /> {client.email}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-400"><Phone size={11} className="text-gray-300" /> {client.phone}</p>
          {client.city && <p className="flex items-center gap-1.5 text-xs text-gray-400"><MapPin size={11} className="text-gray-300" /> {client.city}{client.country ? `, ${client.country}` : ''}</p>}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4 pt-3 border-t border-gray-50">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800">{client._count?.jobs || 0}</p>
            <p className="text-[10px] text-gray-400 font-medium">Jobs</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800">{client._count?.invoices || 0}</p>
            <p className="text-[10px] text-gray-400 font-medium">Invoices</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-indigo-600">{totalRevenue > 0 ? `${(totalRevenue/1000).toFixed(0)}k` : '—'}</p>
            <p className="text-[10px] text-gray-400 font-medium">Revenue</p>
          </div>
        </div>

        {/* Revenue bar */}
        {totalRevenue > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">Collection rate</span>
              <span className="text-[10px] font-bold text-emerald-600">{((paidRevenue / totalRevenue) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (paidRevenue / totalRevenue) * 100)}%` }} />
            </div>
          </div>
        )}

        <DocumentStatus docs={client.documents} onOpen={() => onView(client.id, 'Documents')} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => onView(client.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold bg-primary-400 text-white py-2 rounded-xl hover:bg-primary-500 transition-colors">
            <Eye size={12} /> View Details
          </button>
          <button onClick={() => onEdit(client)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(client.id)}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientRow({ client, onEdit, onDelete, onView, showDocs }: any) {
  const totalRevenue = client.totalRevenue || 0;
  const paidRevenue  = client.paidRevenue  || 0;
  return (
    <tr className="hover:bg-gray-50 transition-colors border-b border-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-600 font-bold text-sm">{client.companyName[0]}</span>
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{client.companyName}</p>
            {(client.industryRef?.name || client.industry) && <p className="text-[10px] text-gray-400">{client.industryRef?.name || client.industry}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{client.contactPerson}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{client.email}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{client.phone}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{client.city || '—'}</td>
      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-700">{client._count?.jobs || 0}</td>
      <td className="px-4 py-3 text-sm font-semibold text-indigo-600">
        {totalRevenue > 0 ? `AED ${(totalRevenue/1000).toFixed(0)}k` : '—'}
      </td>
      {showDocs && (
        <td className="px-4 py-3">
          {isVerified(client.documents) ? (
            <span className="text-[11px] font-semibold text-emerald-700">All {client.documents.total} approved</span>
          ) : client.documents ? (
            <button onClick={() => onView(client.id, 'Documents')} className="text-left space-y-1" title="Open this client's documents">
              <p className="text-[11px] font-semibold text-gray-600">
                {client.documents.uploaded + client.documents.approved}/{client.documents.total} uploaded
              </p>
              <DocChips docs={client.documents} />
            </button>
          ) : <span className="text-[11px] text-gray-300">—</span>}
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {client.isActive ? 'Active' : 'Inactive'}
          </span>
          <ClientStatusBadge status={client.status} />
          <VerifiedBadge docs={client.documents} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onView(client.id)}
            className="flex items-center gap-1 text-[11px] font-bold text-primary-500 hover:underline">
            <Eye size={11} /> View
          </button>
          <button onClick={() => onEdit(client)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors"><Pencil size={12} /></button>
          <button onClick={() => onDelete(client.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}


export default function ClientsPage() {
  const qc     = useQueryClient();
  const router = useRouter();
  const [search,       setSearch]       = useState('');
  const [industryId,   setIndustryId]   = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [docsFilter,   setDocsFilter]   = useState('');
  const isSuperAdmin = useAuth(s => s.user?.role) === 'SUPER_ADMIN';
  const [page,         setPage]         = useState(1);
  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState<any>(null);
  const [viewMode,     setViewMode]     = useState<'grid' | 'list'>('grid');
  const [importOpen,   setImportOpen]   = useState(false);
  const { data: industries } = useIndustries();

  function openAdd() {
    setEditing(null);
    setModal(true);
  }

  function openEdit(cl: any) {
    setEditing(cl);
    setModal(true);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, industryId, activeFilter, statusFilter, docsFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search)       params.set('search', search);
      if (industryId)   params.set('industryId', industryId);
      if (activeFilter) params.set('isActive', activeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (docsFilter)   params.set('docs', docsFilter);
      return api.get(`/clients?${params}`).then(r => r.data);
    },
    staleTime: 0,
  });

  const clients   = data?.data || [];
  const total     = data?.total || 0;
  const active    = clients.filter((c: any) => c.isActive).length;
  const totalRev  = clients.reduce((s: number, c: any) => s + (c.totalRevenue || 0), 0);
  const openJobs  = clients.reduce((s: number, c: any) => s + (c.openJobs || 0), 0);
  const docTotals = data?.documentTotals;

  // Alert the Super Admin once per visit about documents companies still owe or that need review.
  const alerted = useRef(false);
  useEffect(() => {
    if (!docTotals || alerted.current) return;
    alerted.current = true;
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (docTotals.overdue > 0) {
      toast.error(`${plural(docTotals.overdue, 'document')} overdue from ${plural(docTotals.clientsWithOverdue, 'client')}`,
        { id: 'docs-overdue', duration: 6000 });
    }
    const notOverdue = docTotals.pending - docTotals.overdue;
    if (notOverdue > 0) {
      toast(`${plural(notOverdue, 'requested document')} not uploaded yet (${plural(docTotals.clientsWithPending, 'client')})`,
        { id: 'docs-pending', icon: '📄', duration: 6000 });
    }
    if (docTotals.awaitingReview > 0) {
      toast(`${plural(docTotals.awaitingReview, 'uploaded document')} waiting for your review`,
        { id: 'docs-review', icon: '🔎', duration: 6000 });
    }
  }, [docTotals]);

  const save = useMutation({
    mutationFn: (d: any) => editing ? api.put(`/clients/${editing.id}`, d) : api.post('/clients', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(editing ? 'Client updated' : 'Client added');
      setModal(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });


  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total client{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu columns={EXPORT_COLUMNS} data={clients} filename="clients" title="Clients" disabled={isLoading} />
          <button onClick={() => setImportOpen(true)} title="Import"
            className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Upload size={15} className="text-gray-600" />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-primary-400/30"
          >
            <Plus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients"  value={total}                                                          icon={Building2}    color="#6366f1" />
        <StatCard label="Active"         value={active}                                                         icon={CheckCircle2} color="#10b981" />
        <StatCard label="Total Revenue"  value={totalRev > 0 ? `AED ${(totalRev/1000).toFixed(0)}k` : 'AED 0'} icon={DollarSign}   color="#f59e0b" />
        <StatCard label="Open Jobs"      value={openJobs}                                                       icon={Briefcase}    color="#3b82f6" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search clients…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400/30"
          />
        </div>
        <select value={industryId} onChange={e => { setIndustryId(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
          <option value="">All Industries</option>
          {(industries || []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
          <option value="">All Approvals</option>
          <option value="PENDING">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {isSuperAdmin && (
          <select value={docsFilter} onChange={e => { setDocsFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/30">
            <option value="">All Documents</option>
            <option value="pending">Documents not uploaded</option>
            <option value="overdue">Documents overdue</option>
            <option value="review">Uploaded, needs review</option>
            <option value="complete">All documents approved</option>
          </select>
        )}
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden ml-auto">
          <button onClick={() => setViewMode('grid')}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-primary-400 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary-400 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No clients found</p>
          <p className="text-sm mt-1">Try adjusting filters or add a new client.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((c: any) => (
            <ClientCard key={c.id} client={c}
              onView={(id: string, tab?: string) => router.push(`/admin/crm/clients/${id}${tab ? `?tab=${tab}` : ''}`)}
              onEdit={openEdit}
              onDelete={(id: string) => { if (confirm('Delete this client?')) del.mutate(id); }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Company','Contact','Email','Phone','City','Jobs','Revenue', ...(docTotals ? ['Documents'] : []),'Status','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <ClientRow key={c.id} client={c}
                    onView={(id: string, tab?: string) => router.push(`/admin/crm/clients/${id}${tab ? `?tab=${tab}` : ''}`)}
                    showDocs={!!docTotals}
                    onEdit={openEdit}
                    onDelete={(id: string) => { if (confirm('Delete this client?')) del.mutate(id); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      <ClientFormModal
        isOpen={modal}
        onClose={() => { setModal(false); setEditing(null); }}
        editing={editing}
        saving={save.isPending}
        onSubmit={body => save.mutate(body)}
      />

      <ImportCSVModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Clients"
        endpoint="/clients"
        fields={[...CLIENT_FORM_FIELDS.map(f => ({ key: f.name, label: f.label.replace(/\s*\*$/, ''), required: !!f.required })), { key: 'source', label: 'Source', required: false }]}
        onDone={() => qc.invalidateQueries({ queryKey: ['clients'] })}
      />
    </div>
  );
}
