'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore, WorkflowChoice, ToolRequest } from '../store/chat.store';
import { ChatMessage, ChatThinkingStep } from '../api/chat.api';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';

const WS_URL =
  process.env.NEXT_PUBLIC_AGENT_WS_URL || 'http://localhost:3002';

export function useChatStream(sessionId: string | null, userId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const appendToken = useChatStore((s) => s.appendToken);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addThinkingStep = useChatStore((s) => s.addThinkingStep);
  const setWorkflowChoice = useChatStore((s) => s.setWorkflowChoice);
  const setToolRequest = useChatStore((s) => s.setToolRequest);
  const addPendingMessage = useChatStore((s) => s.addPendingMessage);
  const finalizeMessage = useChatStore((s) => s.finalizeMessage);
  const setError = useChatStore((s) => s.setError);
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace?.());

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(`${WS_URL}/chat`, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('token', ({ token }: { token: string }) => {
      appendToken(token);
    });

    socket.on('thinking', (step: ChatThinkingStep) => {
      addThinkingStep(step);
    });

    socket.on('workflow_choice', (payload: WorkflowChoice) => {
      setWorkflowChoice(payload);
    });

    socket.on('tool_request', (payload: ToolRequest) => {
      setToolRequest(payload);
    });

    socket.on('complete', (message: ChatMessage) => {
      finalizeMessage(message);
      setStreaming(false);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] });
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
      setStreaming(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, appendToken, setStreaming, addThinkingStep, setWorkflowChoice, setToolRequest, finalizeMessage, setError]);

  const sendMessage = useCallback(
    (content: string, attachments?: ChatMessage['attachments']) => {
      if (!socketRef.current || !sessionId || !userId) return;
      setStreaming(true);
      setError(null);
      addPendingMessage({
        id: `pending-${Date.now()}`,
        sessionId,
        role: 'user',
        content,
        attachments,
        createdAt: new Date().toISOString(),
      });
      socketRef.current.emit('send_message', {
        sessionId,
        userId,
        dto: { content, attachments, workspacePath: activeWorkspace?.nativePath },
      });
    },
    [sessionId, userId, setStreaming, setError, addPendingMessage, activeWorkspace?.nativePath],
  );

  const sendWorkflowChoice = useCallback((nodeId: string, answer: string) => {
    if (!socketRef.current) return;
    setWorkflowChoice(null);
    socketRef.current.emit('workflow_choice_response', { nodeId, answer });
  }, [setWorkflowChoice]);

  const sendToolRequestResponse = useCallback((requestId: string, selectedToolIds: string[]) => {
    if (!socketRef.current) return;
    setToolRequest(null);
    socketRef.current.emit('tool_request_response', { requestId, selectedToolIds });
  }, [setToolRequest]);

  return { sendMessage, sendWorkflowChoice, sendToolRequestResponse };
}
