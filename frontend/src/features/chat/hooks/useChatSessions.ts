import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, CreateSessionInput } from '../api/chat.api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: chatApi.listSessions,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (input: CreateSessionInput) => chatApi.createSession(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: () => {
      toast.error(t('chat.error.session_failed'));
    },
  });
}

export function useUpdateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateSessionInput> }) =>
      chatApi.updateSession(id, input),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-session', session.id] });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: () => {
      toast.error(t('chat.error.session_failed'));
    },
  });
}
