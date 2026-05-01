'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSession, ChatAttachment } from '../api/chat.api';
import { ChatConfigPills } from './ChatConfigPills';

interface Props {
  onSend: (content: string, attachments?: ChatAttachment[]) => void;
  session: ChatSession | null;
  disabled?: boolean;
}

export function ChatInput({ onSend, session, disabled }: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [content, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const canSend = content.trim().length > 0 && !disabled && !!session;

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className={cn(
          'rounded-2xl border bg-card shadow-sm transition-all duration-200',
          'focus-within:shadow-md focus-within:border-primary/30 border-border/60',
        )}
      >
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={t('chat.input.placeholder')}
            disabled={disabled || !session}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent text-sm outline-none',
              'placeholder:text-muted-foreground min-h-[28px] max-h-[200px] leading-7',
            )}
          />
        </div>

        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            type="button"
            title={t('chat.input.attach')}
            disabled={disabled || !session}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {session && <ChatConfigPills session={session} />}

          <button
            type="button"
            onClick={handleSend}
            title={t('chat.input.send')}
            disabled={!canSend}
            className={cn(
              'ml-auto shrink-0 rounded-full p-1.5 transition-all',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
