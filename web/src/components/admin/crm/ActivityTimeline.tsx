'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  StickyNote, Phone, Users, Mail, CheckSquare, ArrowRightLeft, Sparkles, Send,
} from 'lucide-react';

interface ActivityTimelineProps {
  clientId: string;
  dealId?: string;
}

const LOGGABLE_TYPES = [
  { value: 'NOTE', label: 'Note' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'TASK', label: 'Task' },
];

const TYPE_META: Record<string, { icon: any; color: string }> = {
  NOTE: { icon: StickyNote, color: '#f59e0b' },
  CALL: { icon: Phone, color: '#3b82f6' },
  MEETING: { icon: Users, color: '#a855f7' },
  EMAIL: { icon: Mail, color: '#6366f1' },
  TASK: { icon: CheckSquare, color: '#10b981' },
  STAGE_CHANGE: { icon: ArrowRightLeft, color: '#ec4899' },
  SYSTEM: { icon: Sparkles, color: '#94a3b8' },
};

const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal Sent',
  NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost',
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  return { relative: formatDistanceToNow(d, { addSuffix: true }), full: d.toLocaleString('en-AE') };
}

export default function ActivityTimeline({ clientId, dealId }: ActivityTimelineProps) {
  const qc = useQueryClient();
  const [type, setType] = useState('NOTE');
  const [content, setContent] = useState('');

  const queryKey = ['activities', clientId, dealId || null];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ clientId });
      if (dealId) params.set('dealId', dealId);
      return api.get(`/activities?${params.toString()}`).then(r => r.data);
    },
    enabled: !!clientId,
  });

  const logMutation = useMutation({
    mutationFn: () => api.post('/activities', { clientId, dealId, type, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setContent('');
      toast.success('Activity logged');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to log activity'),
  });

  const activities = data?.data || [];

  return (
    <div className="space-y-5">
      {/* Composer */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="input text-sm w-40 py-2"
          >
            {LOGGABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Log Activity</span>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          placeholder="Write a note, call summary, meeting outcome…"
          className="input text-sm resize-none"
        />
        <div className="flex justify-end mt-2.5">
          <button
            onClick={() => content.trim() && logMutation.mutate()}
            disabled={!content.trim() || logMutation.isPending}
            className="btn-primary text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={13} /> {logMutation.isPending ? 'Logging…' : 'Log'}
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Activity Feed</p>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && activities.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
        )}

        {!isLoading && activities.length > 0 && (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-5">
              {activities.map((a: any) => {
                const meta = TYPE_META[a.type] || TYPE_META.SYSTEM;
                const Icon = meta.icon;
                const { relative, full } = timeLabel(a.createdAt);
                return (
                  <div key={a.id} className="flex items-start gap-4 relative">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 bg-white border-2"
                      style={{ borderColor: meta.color }}
                    >
                      <Icon size={13} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {a.type === 'STAGE_CHANGE' && a.metadata?.from && a.metadata?.to ? (
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {STAGE_LABELS[a.metadata.from] || a.metadata.from}
                              </span>
                              <ArrowRightLeft size={10} className="text-gray-300" />
                              <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">
                                {STAGE_LABELS[a.metadata.to] || a.metadata.to}
                              </span>
                            </div>
                          ) : null}
                          <p className="text-sm text-gray-800 break-words">{a.content}</p>
                          {a.type === 'STAGE_CHANGE' && a.metadata?.lossReason && (
                            <p className="text-xs text-red-500 mt-0.5">Reason: {a.metadata.lossReason}</p>
                          )}
                          {!dealId && a.deal?.title && (
                            <p className="text-[10px] text-gray-400 mt-0.5">on deal “{a.deal.title}”</p>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 shrink-0 mt-1 whitespace-nowrap" title={full}>
                          {relative}
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {a.createdByUser?.name || 'System'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
