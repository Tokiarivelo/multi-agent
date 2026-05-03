'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from '../api/chat.api';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatThinkingPanel } from './ChatThinkingPanel';
import { ChatWorkflowChoice } from './ChatWorkflowChoice';
import { ChatToolRequest } from './ChatToolRequest';
import { useChatStore } from '../store/chat.store';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Bot } from 'lucide-react';

interface Props {
  messages: ChatMessage[];
  onWorkflowAnswer: (nodeId: string, answer: string) => void;
  onToolAnswer: (requestId: string, selectedToolIds: string[]) => void;
}

const BOTTOM_THRESHOLD = 120; // px — consider "at bottom" within this distance

export function ChatMessageList({ messages, onWorkflowAnswer, onToolAnswer }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingSteps = useChatStore((s) => s.thinkingSteps);
  const workflowChoice = useChatStore((s) => s.workflowChoice);
  const toolRequest = useChatStore((s) => s.toolRequest);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
  };

  // New complete messages → smooth scroll only if already near bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Streaming tokens → instant scroll to avoid animation conflicts
  useEffect(() => {
    if (isAtBottomRef.current && (streamingContent || thinkingSteps.length > 0)) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [streamingContent, thinkingSteps]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm min-h-0">
        {t('chat.messages.empty')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 min-h-0"
    >
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
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm bg-muted/60 border border-border/40 break-words">
                <MarkdownContent content={streamingContent} />
                <span className="inline-block w-2 h-4 ml-0.5 bg-foreground/60 animate-pulse align-middle" />
              </div>
            )}
          </div>
        </div>
      )}

      {workflowChoice && (
        <ChatWorkflowChoice
          choice={workflowChoice}
          onAnswer={(answer) => onWorkflowAnswer(workflowChoice.nodeId, answer)}
        />
      )}

      {toolRequest && (
        <ChatToolRequest
          request={toolRequest}
          onAnswer={(selectedToolIds) => onToolAnswer(toolRequest.requestId, selectedToolIds)}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
