import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../api/agents.api';
import { AgentCreateInput } from '@/types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AxiosError } from 'axios';

export function useAgents(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['agents', page, pageSize],
    queryFn: () => agentsApi.getAll(page, pageSize),
  });
}

export function useAgent(id: string | null) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (agent: AgentCreateInput) => agentsApi.create(agent),
    onSuccess: () => {
      toast.success('Agent created successfully');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      router.push(`/agents`);
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to create agent');
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, agent }: { id: string; agent: Partial<AgentCreateInput> }) =>
      agentsApi.update(id, agent),
    onSuccess: (agent) => {
      toast.success('Agent updated successfully');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', agent.id] });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to update agent');
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      toast.success('Agent deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      router.push('/agents');
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete agent');
    },
  });
}
