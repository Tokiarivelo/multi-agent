import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, AddNodePayload, AddEdgePayload } from '../api/workflows.api';
import { Workflow } from '@/types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useWorkflows(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['workflows', page, pageSize],
    queryFn: () => workflowsApi.getAll(page, pageSize),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.getById(id!),
    enabled: !!id,
  });
}

export function useExecution(executionId: string | null) {
  return useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => workflowsApi.getExecution(executionId!),
    enabled: !!executionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'RUNNING' || status === 'PENDING') return 2000;
      return false;
    },
  });
}

// ─── Workflow mutations ────────────────────────────────────────────────────────

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (workflow: Partial<Workflow>) => workflowsApi.create(workflow),
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created!');
      router.push(`/workflows/${workflow.id}`);
    },
    onError: () => toast.error('Failed to create workflow'),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workflow }: { id: string; workflow: Partial<Workflow> }) =>
      workflowsApi.update(id, workflow),
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', workflow.id] });
      toast.success('Workflow saved!');
    },
    onError: () => toast.error('Failed to save workflow'),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow deleted');
      router.push('/workflows');
    },
    onError: () => toast.error('Failed to delete workflow'),
  });
}

// ─── Node mutations ───────────────────────────────────────────────────────────

export function useAddNode(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (node: AddNodePayload) => workflowsApi.addNode(workflowId, node),
    onSuccess: (workflow) => {
      queryClient.setQueryData(['workflow', workflowId], workflow);
    },
    onError: () => toast.error('Failed to add node'),
  });
}

export function useUpdateNode(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nodeId, node }: { nodeId: string; node: Partial<AddNodePayload> }) =>
      workflowsApi.updateNode(workflowId, nodeId, node),
    onSuccess: (workflow) => {
      queryClient.setQueryData(['workflow', workflowId], workflow);
    },
    onError: () => toast.error('Failed to update node'),
  });
}

export function useDeleteNode(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nodeId: string) => workflowsApi.deleteNode(workflowId, nodeId),
    onSuccess: (_, nodeId) => {
      // Optimistic: remove node from cache
      const prev = queryClient.getQueryData<Workflow>(['workflow', workflowId]);
      if (prev) {
        queryClient.setQueryData(['workflow', workflowId], {
          ...prev,
          definition: {
            ...prev.definition,
            nodes: prev.definition?.nodes?.filter((n: { id: string }) => n.id !== nodeId),
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete node'),
  });
}

// ─── Edge mutations ───────────────────────────────────────────────────────────

export function useAddEdge(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (edge: AddEdgePayload) => workflowsApi.addEdge(workflowId, edge),
    onSuccess: (workflow) => {
      queryClient.setQueryData(['workflow', workflowId], workflow);
    },
    onError: () => toast.error('Failed to add edge'),
  });
}

export function useDeleteEdge(workflowId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (edgeId: string) => workflowsApi.deleteEdge(workflowId, edgeId),
    onSuccess: (_, edgeId) => {
      const prev = queryClient.getQueryData<Workflow>(['workflow', workflowId]);
      if (prev) {
        queryClient.setQueryData(['workflow', workflowId], {
          ...prev,
          definition: {
            ...prev.definition,
            edges: prev.definition?.edges?.filter((e: { id: string }) => e.id !== edgeId),
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete edge'),
  });
}

// ─── Execution mutations ──────────────────────────────────────────────────────

export function useExecuteWorkflow() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: Record<string, unknown> }) =>
      workflowsApi.execute(id, input),
    onError: () => toast.error('Failed to start execution'),
  });
}

export function useCancelExecution() {
  return useMutation({
    mutationFn: (executionId: string) => workflowsApi.cancelExecution(executionId),
    onSuccess: () => toast.success('Execution cancelled'),
    onError: () => toast.error('Failed to cancel execution'),
  });
}
