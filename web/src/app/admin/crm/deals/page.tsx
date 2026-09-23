'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from '@/components/admin/Modal';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  Plus, Search, DollarSign, TrendingUp, Percent, Target, Calendar,
} from 'lucide-react';

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  LEAD: 'Lead', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal Sent',
  NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost',
};

const STAGE_COLORS: Record<Stage, string> = {
  LEAD: '#94a3b8', QUALIFIED: '#3b82f6', PROPOSAL: '#a855f7',
  NEGOTIATION: '#f59e0b', WON: '#10b981', LOST: '#ef4444',
};

const fmt = (n: number, cur = 'AED') =>
  `${cur} ${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function KpiCard({ label, value, icon: Icon, color = '#6366f1' }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '18' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-lg font-bold text-gray-900 tracking-tight leading-tight">{value}</p>
      <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function OwnerBadge({ name }: { name?: string }) {
  if (!name) return null;
  return (
    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-[9px] font-bold flex items-center justify-center shrink-0" title={name}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

function DealCard({ deal, onOpen, disabled }: { deal: any; onOpen: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer touch-none ${
        isDragging ? 'opacity-60 ring-2 ring-primary-300' : ''
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <p className="text-sm font-bold text-gray-800 leading-snug line-clamp-2">{deal.title}</p>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{deal.client?.companyName}</p>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-sm font-bold text-gray-900">{fmt(deal.value, deal.currency)}</span>
        <OwnerBadge name={deal.owner?.name} />
      </div>
      {deal.expectedCloseDate && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
          <Calendar size={10} />
          {new Date(deal.expectedCloseDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ stage, deals, onOpen, movingId }: { stage: Stage; deals: any[]; onOpen: (id: string) => void; movingId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-2xl border transition-colors ${
        isOver ? 'bg-primary-50/60 border-primary-300' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="px-3.5 py-3 border-b border-gray-200/70 sticky top-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLORS[stage] }} />
            <p className="text-sm font-bold text-gray-800">{STAGE_LABELS[stage]}</p>
          </div>
          <span className="text-[11px] font-bold text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">{deals.length}</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-1 font-semibold">{fmt(total)}</p>
      </div>
      <div className="p-2.5 space-y-2.5 min-h-[120px] max-h-[calc(100vh-330px)] overflow-y-auto">
        {deals.length === 0 && <p className="text-[11px] text-gray-300 text-center py-6">No deals</p>}
        {deals.map(d => (
          <DealCard key={d.id} deal={d} onOpen={() => onOpen(d.id)} disabled={movingId === d.id} />
        ))}
      </div>
    </div>
  );
}

export default function DealsBoardPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [tag, setTag] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [lossPrompt, setLossPrompt] = useState<{ dealId: string; stage: Stage } | null>(null);
  const [lossReason, setLossReason] = useState('');

  const buildParams = () => {
    const p = new URLSearchParams({ limit: '500' });
    if (search) p.set('search', search);
    if (ownerId) p.set('ownerId', ownerId);
    if (tag) p.set('tags', tag);
    return p.toString();
  };

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals-board', search, ownerId, tag],
    queryFn: () => api.get(`/deals?${buildParams()}`).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['deals-stats'],
    queryFn: () => api.get('/deals/stats').then(r => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    // Optional owner list: roles without users:view just get no owners, not a "no permission" toast.
    queryFn: () => api.get('/users', { forbiddenToast: false }).then(r => r.data),
    retry: false,
  });

  const deals = dealsData?.data || [];
  const byStage = useMemo(() => {
    const grouped: Record<Stage, any[]> = { LEAD: [], QUALIFIED: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: [] };
    for (const d of deals) if (grouped[d.stage as Stage]) grouped[d.stage as Stage].push(d);
    return grouped;
  }, [deals]);

  const stageMutation = useMutation({
    mutationFn: ({ id, stage, lossReason: reason }: { id: string; stage: Stage; lossReason?: string }) =>
      api.patch(`/deals/${id}/stage`, { stage, ...(reason ? { lossReason: reason } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      qc.invalidateQueries({ queryKey: ['deals-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to move deal'),
    onSettled: () => setMovingId(null),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const deal = active.data.current?.deal;
    const targetStage = over.id as Stage;
    if (!deal || deal.stage === targetStage) return;

    if (targetStage === 'LOST') {
      setLossPrompt({ dealId: deal.id, stage: targetStage });
      setLossReason('');
      return;
    }
    setMovingId(deal.id);
    stageMutation.mutate({ id: deal.id, stage: targetStage });
  }

  function confirmLoss() {
    if (!lossPrompt || !lossReason.trim()) { toast.error('A loss reason is required'); return; }
    setMovingId(lossPrompt.dealId);
    stageMutation.mutate({ id: lossPrompt.dealId, stage: lossPrompt.stage, lossReason: lossReason.trim() });
    setLossPrompt(null);
  }

  return (
    <div className="p-5 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track opportunities from lead to close</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 bg-primary-400 hover:bg-primary-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={15} /> New Deal
        </button>
      </div>

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Total Open Value" value={fmt(stats.totalOpenValue)} icon={DollarSign} color="#6366f1" />
          <KpiCard label="Weighted Forecast" value={fmt(stats.weightedForecast)} icon={TrendingUp} color="#10b981" />
          <KpiCard label="Win Rate" value={`${stats.winRate}%`} icon={Percent} color="#f59e0b" />
          <KpiCard label="Open Deals" value={stats.openCount} icon={Target} color="#a855f7" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, client…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white"
          />
        </div>
        <select
          value={ownerId}
          onChange={e => setOwnerId(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
        >
          <option value="">All Owners</option>
          {(users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="Filter by tag…"
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none w-40"
        />
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={byStage[stage]}
                onOpen={id => router.push(`/admin/crm/deals/${id}`)}
                movingId={movingId}
              />
            ))}
          </div>
        </DndContext>
      )}

      {/* Loss reason modal */}
      <Modal isOpen={!!lossPrompt} onClose={() => setLossPrompt(null)} title="Mark Deal as Lost" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Please provide a reason for marking this deal as lost.</p>
          <div>
            <label className="label">Loss Reason</label>
            <input
              autoFocus
              value={lossReason}
              onChange={e => setLossReason(e.target.value)}
              placeholder="e.g. Budget constraints, chose a competitor…"
              className="input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setLossPrompt(null)} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button
              onClick={confirmLoss}
              disabled={!lossReason.trim() || stageMutation.isPending}
              className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
            >
              {stageMutation.isPending ? 'Saving…' : 'Confirm Lost'}
            </button>
          </div>
        </div>
      </Modal>

      {/* New deal modal */}
      <NewDealModal isOpen={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function NewDealModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [clientId, setClientId] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [stage, setStage] = useState<Stage>('LEAD');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients?limit=100').then(r => r.data.data),
    enabled: isOpen,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    // Optional owner list: roles without users:view just get no owners, not a "no permission" toast.
    queryFn: () => api.get('/users', { forbiddenToast: false }).then(r => r.data),
    enabled: isOpen,
    retry: false,
  });

  function reset() {
    setTitle(''); setTitleTouched(false); setClientId(''); setValue('');
    setCurrency('AED'); setStage('LEAD'); setExpectedCloseDate(''); setOwnerId('');
  }

  function handleClientChange(id: string) {
    setClientId(id);
    if (!titleTouched) {
      const c = (clients || []).find((c: any) => c.id === id);
      if (c) setTitle(`${c.companyName} — Opportunity`);
    }
  }

  const createMutation = useMutation({
    mutationFn: () => api.post('/deals', {
      title, clientId,
      value: value ? Number(value) : 0,
      currency, stage,
      expectedCloseDate: expectedCloseDate || undefined,
      ownerId: ownerId || undefined,
    }).then(r => r.data),
    onSuccess: (deal: any) => {
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      qc.invalidateQueries({ queryKey: ['deals-stats'] });
      toast.success('Deal created');
      onClose();
      reset();
      router.push(`/admin/crm/deals/${deal.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create deal'),
  });

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} title="New Deal" size="md">
      <div className="space-y-3.5">
        <div>
          <label className="label">Client</label>
          <select value={clientId} onChange={e => handleClientChange(e.target.value)} className="input">
            <option value="">Select client…</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Deal Title</label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleTouched(true); }}
            placeholder="e.g. Acme Corp — Staffing Contract"
            className="input"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Value</label>
            <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="0" className="input" />
          </div>
          <div>
            <label className="label">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input">
              {['AED', 'USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value as Stage)} className="input">
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Expected Close</label>
            <input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
            <option value="">Assign to me</option>
            {(users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => { onClose(); reset(); }} className="btn-outline text-sm py-2 px-4">Cancel</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !clientId || createMutation.isPending}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
