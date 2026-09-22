'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send, Bot, Maximize2, Minimize2 } from 'lucide-react';
import ChatMarkdown from '@/components/ChatMarkdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const STORAGE_KEY = 'ak-public-chat-session';

const GREETING =
  "Hi! I can tell you about Al Khadim's services, help you submit your profile for work, or point you to how a company can request staff. What can I help with?";

interface JobTable {
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
}

interface NavigateCta {
  href: string;
  label: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  table?: JobTable;
  navigate?: NavigateCta;
  isError?: boolean;
  quickActions?: string[];
}

interface ChatSession {
  sessionId: string;
  conversationId?: string;
}

function loadSession(): ChatSession {
  if (typeof window === 'undefined') return { sessionId: '' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatSession;
      if (parsed?.sessionId) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const fresh: ChatSession = { sessionId: crypto.randomUUID() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* private mode / storage blocked */
  }
  return fresh;
}

function saveSession(session: ChatSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

const PANEL_SPRING = { type: 'spring' as const, stiffness: 340, damping: 30 };

export default function PublicAIWidget() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', role: 'assistant', content: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [session, setSession] = useState<ChatSession>(() => loadSession());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming || !session.sessionId) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' };
    setMessages((prev) => [...prev.map((m) => ({ ...m, quickActions: undefined })), userMsg, assistantMsg]);
    if (!override) setInput('');
    setStreaming(true);

    const applyDelta = (fragment: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + fragment } : m))
      );
    };
    const applyToolResult = (data: any) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const next = { ...m };
          if (data.navigate) next.navigate = data.navigate;
          if (data.table) next.table = data.table;
          return next;
        })
      );
    };
    const applyError = (message: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content ? `${m.content}\n\n${message}` : message, isError: true }
            : m
        )
      );
    };

    try {
      const res = await fetch(`${API_URL}/api/ai-public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: session.conversationId,
          sessionId: session.sessionId,
          message: text,
        }),
      });

      if (!res.ok) {
        let friendly = 'Something went wrong — please try again in a moment.';
        if (res.status === 503) {
          friendly =
            'The assistant is taking a break right now — feel free to browse our careers page or reach out via the contact form.';
        } else if (res.status === 429) {
          friendly = "You've sent a lot of messages — please try again in a bit.";
        }
        applyError(friendly);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        applyError('Something went wrong — please try again.');
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!frame.trim()) continue;

          let eventName = 'message';
          let dataStr = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }

          let data: any = {};
          try {
            data = dataStr ? JSON.parse(dataStr) : {};
          } catch {
            data = {};
          }

          if (eventName === 'delta' && data.content) {
            applyDelta(data.content);
          } else if (eventName === 'tool_result') {
            applyToolResult(data);
          } else if (eventName === 'done') {
            const next: ChatSession = {
              sessionId: session.sessionId,
              conversationId: data.conversationId || session.conversationId,
            };
            setSession(next);
            saveSession(next);
            if (Array.isArray(data.quickActions) && data.quickActions.length > 0) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, quickActions: data.quickActions } : m))
              );
            }
          } else if (eventName === 'error') {
            applyError(data.error || 'Something went wrong.');
          }
        }
      }
    } catch {
      applyError("We couldn't reach the assistant — please check your connection and try again.");
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, session]);

  const hidden =
    pathname.startsWith('/admin') || pathname.startsWith('/candidate') || pathname.startsWith('/company');
  if (hidden) return null;

  return (
    <>
      {/* Trigger */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full bg-primary-400 text-white shadow-lg shadow-primary-400/30 flex items-center justify-center overflow-hidden"
      >
        {!open && (
          <motion.span
            className="absolute inset-0 rounded-full bg-primary-300"
            animate={{ scale: [1, 1.5, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <span className="relative">
          {open ? <X size={22} /> : <MessageCircle size={22} />}
        </span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && fullscreen && (
          <motion.div
            key="fullscreen-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[55] bg-gray-900/40 backdrop-blur-[2px]"
            onClick={() => setFullscreen(false)}
          />
        )}
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={PANEL_SPRING}
            className={`fixed z-[60] flex flex-col overflow-hidden bg-white/75 backdrop-blur-2xl border border-white/60 shadow-2xl transition-[inset,border-radius,width,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              fullscreen
                ? 'inset-3 rounded-[28px]'
                : 'bottom-36 right-4 lg:bottom-24 lg:right-6 w-[92vw] max-w-sm h-[70vh] max-h-[600px] rounded-2xl origin-bottom-right'
            }`}
          >
            {/* Decorative glass gradient blobs */}
            <div className="pointer-events-none absolute -top-20 -right-14 w-56 h-56 rounded-full bg-gradient-to-br from-primary-400/30 via-fuchsia-300/15 to-transparent blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-gradient-to-tr from-indigo-300/20 via-primary-300/15 to-transparent blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-400 text-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                  />
                  <Bot size={16} className="relative" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-none truncate">Chat with us</p>
                  <p className="text-[11px] text-white/70 leading-none mt-1">Al Khadim Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setFullscreen((v) => !v)}
                  aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors shrink-0"
                >
                  {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className={`relative flex-1 overflow-y-auto px-3 py-3 space-y-3 ${fullscreen ? 'flex justify-center' : ''}`}>
              <div className={fullscreen ? 'w-full max-w-2xl space-y-3' : 'contents'}>
                {messages.map((m, idx) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm break-words ${
                        m.role === 'user'
                          ? 'bg-primary-400 text-white rounded-br-sm whitespace-pre-wrap shadow-sm'
                          : m.isError
                          ? 'bg-red-50 text-red-700 border border-red-100 rounded-bl-sm'
                          : 'bg-white/90 text-gray-800 border border-white/80 shadow-sm rounded-bl-sm'
                      }`}
                    >
                      {m.content ? (
                        m.role === 'user' ? m.content : <ChatMarkdown content={m.content} />
                      ) : streaming && m.role === 'assistant' && m.id === messages[messages.length - 1]?.id ? (
                        <span className="inline-flex items-center gap-1 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                        </span>
                      ) : null}

                      {m.navigate && (
                        <button
                          onClick={() => router.push(m.navigate!.href)}
                          className="mt-2.5 inline-flex items-center gap-1.5 bg-primary-400 text-white text-xs font-semibold px-3.5 py-2 rounded-full hover:bg-primary-500 transition-colors"
                        >
                          {m.navigate.label}
                        </button>
                      )}

                      {m.table && m.table.rows.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {m.table.rows.slice(0, 5).map((row, i) => (
                            <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 px-2.5 py-2">
                              <p className="text-xs font-semibold text-gray-800 truncate">{row.title}</p>
                              <p className="text-[11px] text-gray-500 truncate">
                                {row.client}
                                {row.country ? ` · ${row.country}` : ''}
                              </p>
                            </div>
                          ))}
                          <Link
                            href="/careers"
                            onClick={() => setOpen(false)}
                            className="inline-block text-xs font-semibold text-primary-500 hover:text-primary-600 mt-1"
                          >
                            View all openings →
                          </Link>
                        </div>
                      )}

                      {!streaming && idx === messages.length - 1 && m.quickActions && m.quickActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5 -mb-0.5">
                          {m.quickActions.map((q, i) => (
                            <motion.button
                              key={i}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 * i }}
                              onClick={() => sendMessage(q)}
                              className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-400 hover:text-primary-500 transition-colors"
                            >
                              {q}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className={`shrink-0 border-t border-white/50 bg-white/50 backdrop-blur-sm p-2.5 flex items-center ${fullscreen ? 'justify-center' : ''}`}>
              <div className={`flex items-center gap-2 ${fullscreen ? 'w-full max-w-2xl' : 'w-full'}`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your message…"
                  disabled={streaming}
                  className="flex-1 text-sm px-3.5 py-2.5 rounded-full border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 disabled:opacity-60"
                />
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => sendMessage()}
                  disabled={streaming || !input.trim()}
                  aria-label="Send message"
                  className="w-9 h-9 shrink-0 rounded-full bg-primary-400 text-white flex items-center justify-center disabled:opacity-40 transition-colors hover:bg-primary-500"
                >
                  <Send size={15} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
