'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Trash2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ConversationListResponse, ConversationSummary } from './types';

interface ConversationListProps {
  onSelect: (id: string) => void;
  onNew: () => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ConversationList({ onSelect, onNew }: ConversationListProps) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ConversationListResponse>({
    queryKey: ['ai-assistant-conversations'],
    queryFn: async () => (await api.get('/ai-assistant/conversations?page=1&limit=30')).data,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/ai-assistant/conversations/${id}`),
    onSuccess: () => {
      toast.success('Conversation deleted');
      qc.invalidateQueries({ queryKey: ['ai-assistant-conversations'] });
    },
    onError: () => toast.error('Failed to delete conversation'),
  });

  const conversations = data?.data || [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-400 text-white text-sm font-semibold py-2.5 hover:bg-primary-500 active:scale-95 transition-all"
        >
          <MessageSquarePlus size={15} /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 px-4">
            No conversations yet. Start a new chat to ask about your platform data.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c: ConversationSummary) => (
              <li key={c.id}>
                <div className="group flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => onSelect(c.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  >
                    <MessageSquare size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-gray-800 truncate">
                        {c.title || 'Untitled conversation'}
                      </span>
                      <span className="block text-[10px] text-gray-400">{timeAgo(c.lastMessageAt)}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this conversation?')) remove.mutate(c.id);
                    }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
