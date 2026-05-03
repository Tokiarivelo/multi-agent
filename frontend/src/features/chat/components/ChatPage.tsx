'use client';

import { useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { useChatSessions, useCreateChatSession, useUpdateChatSession, useDeleteChatSession } from '../hooks/useChatSessions';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatStream } from '../hooks/useChatStream';
import { useChatStore } from '../store/chat.store';
import { ChatSessionList } from './ChatSessionList';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { MessageSquare, Plus } from 'lucide-react';

export function ChatPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const resetStream = useChatStore((s) => s.resetStream);
  const pendingMessages = useChatStore((s) => s.pendingMessages);

  const { data: sessions = [] } = useChatSessions();
  const { data: messages = [] } = useChatMessages(activeSessionId);
  const createSession = useCreateChatSession();
  const updateSession = useUpdateChatSession();
  const deleteSession = useDeleteChatSession();
  const { sendMessage, sendWorkflowChoice, sendToolRequestResponse } = useChatStream(activeSessionId, userId);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const allMessages = useMemo(() => {
    if (pendingMessages.length === 0) return messages;
    const serverIds = new Set(messages.map((m) => m.id));
    const extras = pendingMessages.filter((m) => {
      if (serverIds.has(m.id)) return false;
      // Optimistic user messages: drop once the server echoes them back
      if (m.id.startsWith('pending-')) {
        return !messages.some((s) => s.role === m.role && s.content === m.content);
      }
      return true;
    });
    return [...messages, ...extras];
  }, [messages, pendingMessages]);

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

  const handleRename = (id: string, title: string) => {
    updateSession.mutate({ id, input: { title } });
  };

  const handleDelete = (id: string) => {
    deleteSession.mutate(id);
    if (id === activeSessionId) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSession(remaining[0]?.id ?? null);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <ChatSessionList
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={setActiveSession}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onRename={handleRename}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSession ? (
          <>
            <ChatMessageList messages={allMessages} onWorkflowAnswer={sendWorkflowChoice} onToolAnswer={sendToolRequestResponse} />
            <ChatInput onSend={sendMessage} session={activeSession} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-foreground">{t('chat.welcome.title')}</p>
              <p className="text-sm text-muted-foreground">{t('chat.welcome.subtitle')}</p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {t('chat.new_session')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
