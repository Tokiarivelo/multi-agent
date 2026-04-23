import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { healingApi } from '../api/healing.api';

export function useHealingLogs(executionId: string | null) {
  return useQuery({
    queryKey: ['healing-logs', executionId],
    queryFn: () => healingApi.getLogs(executionId!),
    enabled: !!executionId,
  });
}

export function useAnalyzeExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ executionId, modelId }: { executionId: string; modelId: string }) =>
      healingApi.analyze(executionId, modelId),
    onSuccess: (_, { executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['healing-logs', executionId] });
    },
  });
}

export function useApplyFix() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({
      executionId,
      healingLogId,
      modelId,
    }: {
      executionId: string;
      healingLogId: string;
      modelId: string;
    }) => healingApi.applyFix(executionId, healingLogId, modelId),
    onSuccess: (data, { executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['healing-logs', executionId] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      router.push(`/executions/${data.newExecutionId}`);
    },
  });
}

export function useAnalyzeOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      executionId,
      modelId,
      originalRequest,
      forceLlm,
    }: {
      executionId: string;
      modelId: string;
      originalRequest?: string;
      forceLlm?: boolean;
    }) => healingApi.analyzeOutcome(executionId, modelId, originalRequest, forceLlm),
    onSuccess: (_, { executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['healing-logs', executionId] });
    },
  });
}

export function useAnalyzeTestOutcome() {
  return useMutation({
    mutationFn: (params: {
      workflowId: string;
      nodeId: string;
      modelId: string;
      output: unknown;
      input?: unknown;
      nodeType?: string;
      nodeName?: string;
      forceLlm?: boolean;
      /** Optional free-form analysis instructions sent to the AI */
      prompt?: string;
      /** Current tool IDs on the node */
      currentTools?: string[];
      /** All available tools in the workflow */
      availableTools?: { id: string; name: string }[];
    }) => healingApi.analyzeTestOutcome(params),
  });
}

export function useRejectFix() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      executionId,
      healingLogId,
    }: {
      executionId: string;
      healingLogId: string;
    }) => healingApi.rejectFix(executionId, healingLogId),
    onSuccess: (_, { executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['healing-logs', executionId] });
    },
  });
}
