import { useQuery } from "@tanstack/react-query";
import { toolsApi } from "../api/tools.api";

export function useTools(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["tools", page, pageSize],
    queryFn: () => toolsApi.getAll(page, pageSize),
  });
}

export function useTool(id: string | null) {
  return useQuery({
    queryKey: ["tool", id],
    queryFn: () => toolsApi.getById(id!),
    enabled: !!id,
  });
}
