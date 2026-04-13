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

export function useExecuteTool() {
  return useMutation({
    mutationFn: ({
      toolId,
      parameters,
      cwd,
      timeout,
    }: {
      toolId: string;
      parameters: Record<string, unknown>;
      cwd?: string;
      timeout?: number;
    }) => toolsApi.execute(toolId, parameters, cwd, timeout),
  });
}
