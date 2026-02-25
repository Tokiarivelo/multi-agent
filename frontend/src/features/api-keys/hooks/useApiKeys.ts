import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi } from '../api/api-keys.api';
import { CreateApiKeyInput } from '@/types';

export const apiKeyQueryKeys = {
  all: ['apiKeys'] as const,
  byUser: (userId: string) => [...apiKeyQueryKeys.all, userId] as const,
  byProvider: (userId: string, provider: string) =>
    [...apiKeyQueryKeys.byUser(userId), provider] as const,
  detail: (id: string) => [...apiKeyQueryKeys.all, 'detail', id] as const,
};

export function useApiKeys(userId: string | undefined) {
  return useQuery({
    queryKey: apiKeyQueryKeys.byUser(userId ?? ''),
    queryFn: () => apiKeysApi.getAll(userId!),
    enabled: !!userId,
  });
}

export function useApiKeysByProvider(userId: string | undefined, provider: string | null) {
  return useQuery({
    queryKey: apiKeyQueryKeys.byProvider(userId ?? '', provider ?? ''),
    queryFn: () => apiKeysApi.getByProvider(userId!, provider!),
    enabled: !!userId && !!provider,
  });
}

export function useCreateApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => apiKeysApi.create(input),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.byUser(userId) });
      }
    },
  });
}

export function useUpdateApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { keyName?: string; isActive?: boolean } }) =>
      apiKeysApi.update(id, input),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.byUser(userId) });
      }
    },
  });
}

export function useDeleteApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.byUser(userId) });
      }
    },
  });
}
