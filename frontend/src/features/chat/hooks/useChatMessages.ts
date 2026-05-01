import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chat.api';

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => chatApi.getMessages(sessionId!),
    enabled: !!sessionId,
  });
}
