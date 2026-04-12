'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        // Headings
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h4:text-xs',
        'prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-1',
        // Code blocks
        'prose-code:text-[11px] prose-code:font-mono',
        'prose-code:bg-muted/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
        'prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-lg',
        'prose-pre:text-[11px] prose-pre:leading-relaxed',
        // Tables
        'prose-table:text-[11px] prose-th:font-semibold',
        'prose-th:bg-muted/40 prose-td:border-border/30 prose-th:border-border/30',
        // Links
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Lists
        'prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1',
        // Paragraphs
        'prose-p:leading-relaxed prose-p:my-1.5',
        // HR
        'prose-hr:border-border/40',
        // Blockquote
        'prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
