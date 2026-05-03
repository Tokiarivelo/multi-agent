'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChatMessage } from '../api/chat.api';
import { ChatThinkingPanel } from './ChatThinkingPanel';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Bot, User, Copy, Check } from 'lucide-react';

interface Props {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: Props) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          isUser
            ? 'bg-primary/10 border-primary/20 text-primary'
            : 'bg-muted border-border/50 text-muted-foreground',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn('flex max-w-[75%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <span className="text-xs text-muted-foreground px-1">
          {isUser ? t('chat.role.user') : t('chat.role.assistant')}
        </span>

        {!isUser && message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <div className="w-full">
            <ChatThinkingPanel steps={message.thinkingSteps} />
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm break-words',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm leading-relaxed whitespace-pre-wrap selection:bg-white/30 selection:text-white'
              : 'bg-muted/60 border border-border/40 text-foreground rounded-tl-sm selection:bg-primary/25 selection:text-foreground',
          )}
        >
          {isUser ? message.content : <MarkdownContent content={message.content} />}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.attachments.map((a) => (
              <a
                key={a.fileId}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline hover:no-underline"
              >
                {a.name}
              </a>
            ))}
          </div>
        )}

        <div className={cn('flex items-center gap-2 px-1', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleCopy}
            title={copied ? t('chat.message.copied') : t('chat.message.copy')}
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all',
              'opacity-0 group-hover:opacity-100',
              copied
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t('chat.message.copied') : t('chat.message.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
