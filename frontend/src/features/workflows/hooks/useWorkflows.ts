import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowsApi } from "../api/workflows.api";
import { Workflow } from "@/types";
import { useRouter } from "next/navigation";

export function useWorkflows(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["workflows", page, pageSize],
    queryFn: () => workflowsApi.getAll(page, pageSize),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowsApi.getById(id!),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (workflow: Partial<Workflow>) =>
      workflowsApi.create(workflow),
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      router.push(`/workflows/${workflow.id}`);
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workflow }: { id: string; workflow: Partial<Workflow> }) =>
      workflowsApi.update(id, workflow),
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflow.id] });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      router.push("/workflows");
    },
  });
}

export function useExecuteWorkflow() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: Record<string, unknown> }) =>
      workflowsApi.execute(id, input),
  });
}
