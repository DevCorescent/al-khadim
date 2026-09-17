'use client';
import { Bot } from 'lucide-react';
import ChatMarkdown from '@/components/ChatMarkdown';
import ToolResultTable from './ToolResultTable';
import { UiMessage } from './types';

interface MessageBubbleProps {
  message: UiMessage;
  /** Used to build a reasonable export filename for any tool-result tables. */
  conversationTitle?: string | null;
  /** When set, quick-action chips are shown for this message and clicking one sends it as the next message. */
  onQuickAction?: (question: string) => void;
}

export default function MessageBubble({ message, conversationTitle, onQuickAction }: MessageBubbleProps) {
  const isUser = message.role === 'USER';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary-400 text-white px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {message.blocks && message.blocks.length > 0 ? (
          message.blocks.map((block, i) =>
            block.type === 'text' ? (
              block.content ? (
                <div
                  key={i}
                  className="max-w-[95%] rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-800 break-words"
                >
                  <ChatMarkdown content={block.content} />
                </div>
              ) : null
            ) : (
              <ToolResultTable
                key={i}
                result={block.result}
                conversationTitle={conversationTitle}
              />
            )
          )
        ) : message.pending ? (
          <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-sm text-gray-400 italic">
            Thinking…
          </div>
        ) : null}

        {message.error && (
          <div className="max-w-[95%] rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
            {message.error}
          </div>
        )}

        {onQuickAction && message.quickActions && message.quickActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.quickActions.map((q, i) => (
              <button
                key={i}
                onClick={() => onQuickAction(q)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
