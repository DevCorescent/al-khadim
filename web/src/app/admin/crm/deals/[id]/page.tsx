'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Modal from '@/components/admin/Modal';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';
import {
  ArrowLeft, ChevronRight, Pencil, Trash2, DollarSign, Percent,
  Calendar, Building2, Check, X, ArrowRight, ThumbsUp, ThumbsDown,
} from 'lucide-react';

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  LEAD: 'Lead', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal Sent',
  NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost',
};

const STAGE_COLORS: Record<Stage, string> = {
  LEAD: 'bg-gray-100 text-gray-600', QUALIFIED: 'bg-blue-100 text-blue-700',
  PROPOSAL: 'bg-purple-100 text-purple-700', NEGOTIATION: 'bg-amber-100 text-amber-700',
  WON: 'bg-emerald-100 text-emerald-700', LOST: 'bg-red-100 text-red-600',
};

const FORWARD_STAGES: Stage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];

const fmt = (n: number, cur = 'AED') =>
  `${cur} ${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['deal-detail', id],
    queryFn: () => api.get(`/deals/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const stageMutation = useMutation({
    mutationFn: ({ stage, reason }: { stage: Stage; reason?: string }) =>
      api.patch(`/deals/${id}/stage`, { stage, ...(reason ? { lossReason: reason } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-detail', id] });
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      qc.invalidateQueries({ queryKey: ['deals-stats'] });
      toast.success('Stage updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update stage'),
  });

  const titleMutation = useMutation({
    mutationFn: (title: string) => api.put(`/deals/${id}`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-detail', id] });
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      setEditingTitle(false);
      toast.success('Title updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update title'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/deals/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals-board'] });
      qc.invalidateQueries({ queryKey: ['deals-stats'] });
      toast.success('Deal deleted');
      router.push('/admin/crm/deals');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete deal'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
  if (error || !deal) return <div className="p-8 text-red-500">Failed to load deal.</div>;

  const stage: Stage = deal.stage;
  const closed = stage === 'WON' || stage === 'LOST';
  const nextIdx = FORWARD_STAGES.indexOf(stage);
  const nextStage = !closed && nextIdx >= 0 && nextIdx < FORWARD_STAGES.length - 1 ? FORWARD_STAGES[nextIdx + 1] : null;

  function handleMarkLost() {
    setLossReason('');
    setLossOpen(true);
  }
  function confirmLost() {
    if (!lossReason.trim()) { toast.error('A loss reason is required'); return; }
    stageMutation.mutate({ stage: 'LOST', reason: lossReason.trim() });
    setLossOpen(false);
  }

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
            <Link href="/admin/crm/deals" className="hover:text-gray-600">Deal Pipeline</Link>
            <ChevronRight size={12} />
            <span className="text-gray-700 font-semibold truncate max-w-[300px]">{deal.title}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    className="input text-lg font-bold py-1.5 px-2.5 w-80"
                  />
                  <button onClick={() => titleDraft.trim() && titleMutation.mutate(titleDraft.trim())}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingTitle(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-gray-900">{deal.title}</h1>
                  <button onClick={() => { setTitleDraft(deal.title); setEditingTitle(true); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Pencil size={12} />
                  </button>
                </>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage]}`}>
                {STAGE_LABELS[stage]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Link href={`/admin/crm/clients/${deal.client?.id}`}
                className="text-xs text-primary-500 flex items-center gap-1 hover:underline font-semibold">
                <Building2 size={11} /> {deal.client?.companyName}
              </Link>
              <span className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={11} /> {fmt(deal.value, deal.currency)}</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><Percent size={11} /> {deal.probability}% probability</span>
              {deal.expectedCloseDate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar size={11} /> Expected {new Date(deal.expectedCloseDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
              {deal.owner?.name && <span className="text-xs text-gray-500">Owner: {deal.owner.name}</span>}
            </div>
            {stage === 'LOST' && deal.lossReason && (
              <p className="text-xs text-red-500 mt-2">Loss reason: {deal.lossReason}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!closed && nextStage && (
              <button
                onClick={() => stageMutation.mutate({ stage: nextStage })}
                disabled={stageMutation.isPending}
                className="text-sm font-semibold border border-gray-200 px-3.5 py-2 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 flex items-center gap-1.5 disabled:opacity-50"
              >
                Advance to {STAGE_LABELS[nextStage]} <ArrowRight size={13} />
              </button>
            )}
            {!closed && (
              <button
                onClick={() => stageMutation.mutate({ stage: 'WON' })}
                disabled={stageMutation.isPending}
                className="text-sm font-bold bg-emerald-500 text-white px-3.5 py-2 rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <ThumbsUp size={13} /> Mark Won
              </button>
            )}
            {!closed && (
              <button
                onClick={handleMarkLost}
                disabled={stageMutation.isPending}
                className="text-sm font-bold border border-red-200 text-red-600 px-3.5 py-2 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <ThumbsDown size={13} /> Mark Lost
              </button>
            )}
            <button
              onClick={() => setDeleteOpen(true)}
              title="Delete Deal"
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-4xl mx-auto">
        <ActivityTimeline clientId={deal.client.id} dealId={deal.id} />
      </div>

      {/* Loss reason modal */}
      <Modal isOpen={lossOpen} onClose={() => setLossOpen(false)} title="Mark Deal as Lost" size="sm">
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
            <button onClick={() => setLossOpen(false)} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button
              onClick={confirmLost}
              disabled={!lossReason.trim() || stageMutation.isPending}
              className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
            >
              {stageMutation.isPending ? 'Saving…' : 'Confirm Lost'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Deal" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete <span className="font-bold text-gray-700">{deal.title}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDeleteOpen(false)} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-sm font-bold bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
