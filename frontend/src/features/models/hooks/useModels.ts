import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelsApi } from '../api/models.api';

export function useModels(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['models', page, pageSize],
    queryFn: () => modelsApi.getAll(page, pageSize),
  });
}

export function useModel(id: string | null) {
  return useQuery({
    queryKey: ['model', id],
    queryFn: () => modelsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof modelsApi.create>[0]) => modelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

export function useProviderModels(provider: string | null) {
  return useQuery({
    queryKey: ['providerModels', provider],
    queryFn: () => modelsApi.fetchProviderModels(provider!),
    enabled: !!provider,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useApiKeys(userId: string | undefined) {
  return useQuery({
    queryKey: ['apiKeys', userId],
    queryFn: () => modelsApi.getApiKeys(userId!),
    enabled: !!userId,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof modelsApi.createApiKey>[0]) =>
      modelsApi.createApiKey(data),
    onSuccess: (_: unknown, variables: Parameters<typeof modelsApi.createApiKey>[0]) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys', variables.userId] });
    },
  });
}

export function useDeleteApiKey(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelsApi.deleteApiKey(id),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['apiKeys', userId] });
      }
    },
  });
}
