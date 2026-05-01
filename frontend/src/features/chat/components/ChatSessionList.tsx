'use client';

import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSession } from '../api/chat.api';
import { Button } from '@/components/ui/button';

interface Props {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function ChatSessionList({ sessions, activeId, onSelect, onCreate, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border/50 bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t('chat.sessions_title')}</span>
        <Button size="icon" variant="ghost" onClick={onCreate} title={t('chat.new_session')} className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('chat.empty.desc')}
          </p>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
              session.id === activeId
                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            onClick={() => onSelect(session.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-sm">
              {session.title || t('chat.session.untitled')}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              className="invisible group-hover:visible text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title={t('chat.session.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
