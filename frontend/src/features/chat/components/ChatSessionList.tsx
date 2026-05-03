'use client';

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MessageSquare, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatSession } from '../api/chat.api';

interface Props {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function ChatSessionList({ sessions, activeId, onSelect, onCreate, onDelete, onRename }: Props) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setDraft(session.title || '');
    setTimeout(() => { inputRef.current?.select(); }, 0);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) {
      onRename(editingId, draft.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border/40 bg-card/50">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm font-semibold text-foreground">{t('chat.sessions_title')}</span>
        <button
          onClick={onCreate}
          title={t('chat.new_session')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t('chat.empty.desc')}</p>
          </div>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors text-sm',
              editingId === session.id ? 'bg-muted/60' : 'cursor-pointer',
              session.id === activeId && editingId !== session.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            onClick={() => editingId !== session.id && onSelect(session.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />

            {editingId === session.id ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                  if (e.key === 'Escape') cancelEdit();
                }}
                placeholder={t('chat.session.rename_placeholder')}
                className="flex-1 min-w-0 bg-transparent text-foreground text-sm outline-none border-b border-primary"
                autoFocus
              />
            ) : (
              <span className="flex-1 truncate">
                {session.title || t('chat.session.untitled')}
              </span>
            )}

            {editingId !== session.id && (
              <div className="invisible group-hover:visible flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => startEdit(session, e)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={t('chat.session.rename')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title={t('chat.session.delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
