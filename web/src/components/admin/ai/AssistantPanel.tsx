'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bot, Maximize2, Minimize2, Send, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import ConversationList from './ConversationList';
import MessageBubble from './MessageBubble';
import { AssistantBlock, ConversationDetail, StoredMessage, UiMessage } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function parseSseFrame(frame: string): { event: string; data: any } | null {
  let event = 'message';
  let dataLine = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

/** Reconstructs the same {blocks: [...]} shape the live SSE stream builds,
 * from a conversation's persisted rows (see api/src/routes/aiAssistant.js —
 * each turn is one or more ASSISTANT/TOOL rows between two USER rows). */
function messagesToUi(stored: StoredMessage[]): UiMessage[] {
  const result: UiMessage[] = [];
  let acc: AssistantBlock[] = [];
  let accId = '';

  function flush() {
    if (acc.length > 0) {
      result.push({ id: accId, role: 'ASSISTANT', blocks: acc });
    }
    acc = [];
    accId = '';
  }

  for (const m of stored) {
    if (m.role === 'SYSTEM') continue;
    if (m.role === 'USER') {
      flush();
      result.push({ id: m.id, role: 'USER', content: m.content || '' });
    } else if (m.role === 'ASSISTANT') {
      if (!accId) accId = m.id;
      if (m.content) acc.push({ type: 'text', content: m.content });
    } else if (m.role === 'TOOL') {
      if (!accId) accId = m.id;
      acc.push({
        type: 'tool_result',
        result: {
          name: m.toolName || '',
          summary: m.structured?.summary || m.content || '',
          table: m.structured?.table,
        },
      });
    }
  }
  flush();
  return result;
}

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 34 };

export default function AssistantPanel({ isOpen, onClose }: AssistantPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [view, setView] = useState<'list' | 'chat'>('list');
  const [fullscreen, setFullscreen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isOpen) setFullscreen(false);
  }, [isOpen]);

  function handleNewChat() {
    setConversationId(null);
    setConversationTitle(null);
    setMessages([]);
    setView('chat');
  }

  async function handleSelectConversation(id: string) {
    setView('chat');
    setConversationId(id);
    setLoadingConversation(true);
    try {
      const { data } = await api.get<ConversationDetail>(`/ai-assistant/conversations/${id}`);
      setConversationTitle(data.title);
      setMessages(messagesToUi(data.messages));
    } catch {
      toast.error('Failed to load conversation');
      setView('list');
    } finally {
      setLoadingConversation(false);
    }
  }

  async function handleSend(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    if (!override) setInput('');
    setSending(true);

    const isNewConversation = !conversationId;
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'USER', content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: UiMessage = { id: assistantId, role: 'ASSISTANT', blocks: [], pending: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    function updateAssistant(updater: (m: UiMessage) => UiMessage) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? updater(m) : m)));
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch(`${API_URL}/api/ai-assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: conversationId || undefined, message: text }),
      });

      if (!res.ok) {
        let errMsg = 'AI assistant error';
        try {
          const body = await res.json();
          if (body?.error) errMsg = body.error;
        } catch {
          /* non-JSON error body, keep default */
        }
        toast.error(errMsg);
        updateAssistant((m) => ({ ...m, pending: false, error: errMsg }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const parsed = parseSseFrame(frame);
          if (!parsed) continue;
          const { event, data } = parsed;

          if (event === 'delta' && data.content) {
            updateAssistant((m) => {
              const blocks = [...(m.blocks || [])];
              const last = blocks[blocks.length - 1];
              if (last && last.type === 'text') {
                blocks[blocks.length - 1] = { type: 'text', content: last.content + data.content };
              } else {
                blocks.push({ type: 'text', content: data.content });
              }
              return { ...m, blocks, pending: false };
            });
          } else if (event === 'tool_result') {
            updateAssistant((m) => ({
              ...m,
              blocks: [...(m.blocks || []), { type: 'tool_result', result: data }],
              pending: false,
            }));
          } else if (event === 'done') {
            if (isNewConversation && data.conversationId) {
              setConversationId(data.conversationId);
              setConversationTitle(text.slice(0, 80));
            }
            updateAssistant((m) => ({
              ...m,
              pending: false,
              quickActions: Array.isArray(data.quickActions) ? data.quickActions : undefined,
            }));
            qc.invalidateQueries({ queryKey: ['ai-assistant-conversations'] });
          } else if (event === 'error') {
            updateAssistant((m) => ({ ...m, pending: false, error: data.error || 'AI assistant error' }));
          }
        }
      }
    } catch {
      updateAssistant((m) => ({ ...m, pending: false, error: 'Connection lost. Please try again.' }));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isViewer = user?.role === 'VIEWER';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-gray-900/30 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          <motion.div
            key="panel"
            initial={{ opacity: 0, x: 60, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.98 }}
            transition={SPRING}
            className={`fixed z-50 flex flex-col overflow-hidden bg-white/75 backdrop-blur-2xl border border-white/60 shadow-[0_8px_40px_rgba(0,0,0,0.16)] transition-[inset,border-radius] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              fullscreen
                ? 'inset-3 sm:inset-6 rounded-[28px]'
                : 'inset-y-0 right-0 left-auto w-full sm:w-[440px] rounded-l-[28px] sm:rounded-l-[28px]'
            }`}
          >
            {/* Decorative glass gradient blobs — purely visual, clipped by overflow-hidden */}
            <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-primary-400/25 via-fuchsia-300/15 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-300/20 via-primary-300/15 to-transparent blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between gap-2 px-4 py-3.5 border-b border-white/50 shrink-0 bg-white/40 backdrop-blur-sm">
              <div className="flex items-center gap-2 min-w-0">
                {view === 'chat' && (
                  <button
                    onClick={() => setView('list')}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/70 transition-colors shrink-0"
                    title="Back to conversations"
                  >
                    <ArrowLeft size={15} className="text-gray-500" />
                  </button>
                )}
                <motion.div
                  className="relative w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden"
                  whileHover={{ scale: 1.06 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-primary-400 via-fuchsia-400 to-indigo-400 opacity-70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  />
                  <Bot size={14} className="relative text-white" />
                </motion.div>
                <h3 className="text-sm font-bold text-gray-900 truncate">
                  {view === 'chat' ? conversationTitle || 'New chat' : 'AI Assistant'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setFullscreen((v) => !v)}
                  className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center hover:bg-white/90 transition-colors"
                  title={fullscreen ? 'Exit full screen' : 'Full screen'}
                >
                  {fullscreen ? <Minimize2 size={14} className="text-gray-600" /> : <Maximize2 size={14} className="text-gray-600" />}
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center hover:bg-white/90 transition-colors"
                >
                  <X size={16} className="text-gray-600" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 flex flex-col min-h-0">
              <div className={`flex-1 flex flex-col min-h-0 w-full mx-auto ${fullscreen ? 'max-w-3xl' : ''}`}>
                {view === 'list' ? (
                  <ConversationList onSelect={handleSelectConversation} onNew={handleNewChat} />
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                      {loadingConversation ? (
                        <p className="text-xs text-gray-400 text-center py-6">Loading conversation…</p>
                      ) : messages.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="h-full flex flex-col items-center justify-center text-center px-6 gap-2"
                        >
                          <div className="relative w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center mb-1 overflow-hidden">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-tr from-primary-400 via-fuchsia-400 to-indigo-400 opacity-70"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                            />
                            <Sparkles size={20} className="relative text-white" />
                          </div>
                          <p className="text-sm font-semibold text-gray-800">Ask about your platform data</p>
                          <p className="text-xs text-gray-400 max-w-[260px]">
                            {isViewer
                              ? 'I can share read-only summaries across modules.'
                              : 'Ask about candidates, jobs, employees, finance, or CRM — I can pull reports and answer questions using live data.'}
                          </p>
                        </motion.div>
                      ) : (
                        messages.map((m, i) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: 'easeOut' }}
                          >
                            <MessageBubble
                              message={m}
                              conversationTitle={conversationTitle}
                              onQuickAction={i === messages.length - 1 && !sending ? (q) => handleSend(q) : undefined}
                            />
                          </motion.div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-white/50 px-3 py-3 shrink-0 bg-white/40 backdrop-blur-sm">
                      <div className="flex items-end gap-2">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Ask a question…"
                          rows={1}
                          disabled={sending}
                          className="flex-1 resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 bg-white/70 transition-all disabled:opacity-60 max-h-32"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleSend()}
                          disabled={sending || !input.trim()}
                          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-primary-400 text-white hover:bg-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send size={15} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
