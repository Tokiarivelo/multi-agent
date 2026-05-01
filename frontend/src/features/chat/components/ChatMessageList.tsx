'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from '../api/chat.api';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatThinkingPanel } from './ChatThinkingPanel';
import { useChatStore } from '../store/chat.store';
import { Bot } from 'lucide-react';

interface Props {
  messages: ChatMessage[];
}

export function ChatMessageList({ messages }: Props) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingSteps = useChatStore((s) => s.thinkingSteps);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, thinkingSteps]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {t('chat.messages.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}

      {isStreaming && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted border-border/50 text-muted-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex max-w-[75%] flex-col gap-1 items-start">
            <span className="text-xs text-muted-foreground px-1">{t('chat.role.assistant')}</span>
            {thinkingSteps.length > 0 && (
              <div className="w-full">
                <ChatThinkingPanel steps={thinkingSteps} />
              </div>
            )}
            {streamingContent && (
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm bg-muted/60 border border-border/40 leading-relaxed whitespace-pre-wrap break-words">
                {streamingContent}
                <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/60 animate-pulse align-middle" />
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
