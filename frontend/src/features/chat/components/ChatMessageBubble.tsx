'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChatMessage } from '../api/chat.api';
import { ChatThinkingPanel } from './ChatThinkingPanel';
import { Bot, User } from 'lucide-react';

interface Props {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: Props) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
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
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted/60 border border-border/40 text-foreground rounded-tl-sm',
          )}
        >
          {message.content}
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

        <span className="text-[10px] text-muted-foreground px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
