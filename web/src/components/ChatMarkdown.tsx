'use client';
import ReactMarkdown from 'react-markdown';

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders assistant chat replies as actual formatted text (bold labels,
 * bullet/numbered lists, short section breaks) instead of showing raw
 * markdown characters. Headings render as compact bold lines rather than
 * true h1/h2 sizes — a chat bubble is narrow, so oversized headings break
 * the layout. Shared by the admin assistant panel and the public widget so
 * both surfaces format identically.
 */
export default function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <p className="font-bold mb-1.5 mt-1 first:mt-0">{children}</p>,
          h2: ({ children }) => <p className="font-bold mb-1.5 mt-1 first:mt-0">{children}</p>,
          h3: ({ children }) => <p className="font-semibold mb-1 mt-1 first:mt-0">{children}</p>,
          h4: ({ children }) => <p className="font-semibold mb-1 mt-1 first:mt-0">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded bg-black/5 text-[0.85em] font-mono">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 pl-2.5 italic opacity-80">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
