import { useQuery } from "@tanstack/react-query";
import { modelsApi } from "../api/models.api";

export function useModels(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["models", page, pageSize],
    queryFn: () => modelsApi.getAll(page, pageSize),
  });
}

export function useModel(id: string | null) {
  return useQuery({
    queryKey: ["model", id],
    queryFn: () => modelsApi.getById(id!),
    enabled: !!id,
  });
}
