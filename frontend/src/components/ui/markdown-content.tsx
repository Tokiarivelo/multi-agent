import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: Props) {
  return (
    <div className={cn('text-sm', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-3 mb-1 leading-snug">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-3 mb-1 leading-snug">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-0.5 leading-snug">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        code: ({ children, className: cls }) => {
          const isBlock = cls?.startsWith('language-');
          if (isBlock) {
            return (
              <code className="block bg-black/10 dark:bg-white/10 rounded px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            );
          }
          return (
            <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 rounded-lg overflow-hidden">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80 mb-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-current/20 my-3" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline opacity-80 hover:opacity-100"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-current/20 px-2 py-1 font-semibold text-left bg-black/5 dark:bg-white/5">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-current/20 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
