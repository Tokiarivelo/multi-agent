'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { useChatSessions, useCreateChatSession, useDeleteChatSession } from '../hooks/useChatSessions';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatStream } from '../hooks/useChatStream';
import { useChatStore } from '../store/chat.store';
import { ChatSessionList } from './ChatSessionList';
import { ChatMessageList } from './ChatMessageList';
import { ChatConfigBar } from './ChatConfigBar';
import { ChatInput } from './ChatInput';
import { MessageSquare } from 'lucide-react';

export function ChatPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const resetStream = useChatStore((s) => s.resetStream);

  const { data: sessions = [] } = useChatSessions();
  const { data: messages = [] } = useChatMessages(activeSessionId);
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const { sendMessage } = useChatStream(activeSessionId, userId);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // Auto-select first session on load
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0]!.id);
    }
  }, [sessions, activeSessionId, setActiveSession]);

  // Reset streaming state when changing session
  useEffect(() => {
    resetStream();
  }, [activeSessionId, resetStream]);

  const handleCreate = async () => {
    const s = await createSession.mutateAsync({});
    setActiveSession(s.id);
  };

  const handleDelete = (id: string) => {
    deleteSession.mutate(id);
    if (id === activeSessionId) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSession(remaining[0]?.id ?? null);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSessionList
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSession ? (
          <>
            <div className="flex items-center gap-2 border-b border-border/50 bg-card px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground truncate">
                {activeSession.title || t('chat.session.untitled')}
              </h2>
            </div>

            <ChatConfigBar session={activeSession} />

            <ChatMessageList messages={messages} />

            <ChatInput onSend={sendMessage} session={activeSession} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t('chat.empty.title')}</p>
            <button
              onClick={handleCreate}
              className="text-sm text-primary hover:underline"
            >
              {t('chat.new_session')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
