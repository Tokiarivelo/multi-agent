import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { executionsApi } from "../api/executions.api";
import { useRouter } from "next/navigation";

export function useExecutions(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["executions", page, pageSize],
    queryFn: () => executionsApi.getAll(page, pageSize),
  });
}

export function useExecution(id: string | null) {
  return useQuery({
    queryKey: ["execution", id],
    queryFn: () => executionsApi.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const execution = query.state.data;
      // Refetch every 2 seconds if execution is running
      return execution?.status === "running" || execution?.status === "pending"
        ? 2000
        : false;
    },
  });
}

export function useExecutionLogs(id: string | null) {
  return useQuery({
    queryKey: ["execution-logs", id],
    queryFn: () => executionsApi.getLogs(id!),
    enabled: !!id,
    refetchInterval: 3000, // Refetch every 3 seconds
  });
}

export function useRetryExecution() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => executionsApi.retry(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      router.push(`/executions/${data.executionId}`);
    },
  });
}

export function useCancelExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => executionsApi.cancel(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      queryClient.invalidateQueries({ queryKey: ["execution", id] });
    },
  });
}
