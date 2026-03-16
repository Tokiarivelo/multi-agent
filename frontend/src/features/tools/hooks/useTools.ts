import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toolsApi } from '../api/tools.api';

export function useTools(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['tools', page, pageSize],
    queryFn: () => toolsApi.getAll(page, pageSize),
  });
}

export function useTool(id: string | null) {
  return useQuery({
    queryKey: ['tool', id],
    queryFn: () => toolsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toolsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });
}
