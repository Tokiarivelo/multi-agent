'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/chat.store';
import { ChatMessage, ChatThinkingStep } from '../api/chat.api';

const WS_URL =
  process.env.NEXT_PUBLIC_AGENT_WS_URL || 'http://localhost:3002';

export function useChatStream(sessionId: string | null, userId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const appendToken = useChatStore((s) => s.appendToken);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addThinkingStep = useChatStore((s) => s.addThinkingStep);
  const finalizeMessage = useChatStore((s) => s.finalizeMessage);
  const setError = useChatStore((s) => s.setError);

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

    socket.on('complete', (message: ChatMessage) => {
      finalizeMessage(message);
      setStreaming(false);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
      setStreaming(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, appendToken, setStreaming, addThinkingStep, finalizeMessage, setError]);

  const sendMessage = useCallback(
    (content: string, attachments?: ChatMessage['attachments']) => {
      if (!socketRef.current || !sessionId || !userId) return;
      setStreaming(true);
      setError(null);
      socketRef.current.emit('send_message', {
        sessionId,
        userId,
        dto: { content, attachments },
      });
    },
    [sessionId, userId, setStreaming, setError],
  );

  return { sendMessage };
}
