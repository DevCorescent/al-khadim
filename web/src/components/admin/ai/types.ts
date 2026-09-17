// Shared types for the admin AI assistant panel. Mirrors the wire shapes
// produced by api/src/routes/aiAssistant.js (see that file for the source of
// truth on SSE event payloads and REST response shapes).

export interface ToolTableColumn {
  key: string;
  label: string;
}

export interface ToolTable {
  columns: ToolTableColumn[];
  rows: Record<string, any>[];
}

export interface StructuredResult {
  summary: string;
  table?: ToolTable;
}

export interface ToolResultEvent extends StructuredResult {
  name: string;
}

/** One rendered block inside an assistant turn: either streaming/streamed
 * prose, or a tool result rendered as its own block. */
export type AssistantBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_result'; result: ToolResultEvent };

export type ChatRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

/** A message as it renders in the UI. For USER messages, `content` is the
 * prose. For ASSISTANT messages, `blocks` interleaves prose + tool results
 * in the order they arrived (or were stored). */
export interface UiMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content?: string;
  blocks?: AssistantBlock[];
  structured?: StructuredResult | null;
  pending?: boolean;
  error?: string;
  /** Curated follow-up questions suggested after this turn (admin turns only). */
  quickActions?: string[];
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface ConversationListResponse {
  data: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string | null;
  toolCalls?: any;
  toolCallId?: string | null;
  toolName?: string | null;
  structured?: StructuredResult | null;
  model?: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  lastMessageAt: string;
  createdAt: string;
  messages: StoredMessage[];
}
