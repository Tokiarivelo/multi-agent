import { useQuery } from '@tanstack/react-query';
import { ListTemplatesParams, marketplaceApi } from '../api/marketplace.api';

// ─── Queries ───────────────────────────────────────────────────────────────────

export function useMarketplaceTemplates(params: ListTemplatesParams = {}) {
  return useQuery({
    queryKey: ['marketplace-templates', params],
    queryFn: () => marketplaceApi.list(params),
  });
}

export function useMarketplaceCategories() {
  return useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: marketplaceApi.categories,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarketplaceTemplate(id: string | null) {
  return useQuery({
    queryKey: ['marketplace-template', id],
    queryFn: () => marketplaceApi.getById(id!),
    enabled: !!id,
  });
}

export function useMyPublished(userId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-my-published', userId],
    queryFn: () => marketplaceApi.getMyPublished(userId!),
    enabled: !!userId,
  });
}

export function useInstallers(templateId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-installers', templateId, userId],
    queryFn: () => marketplaceApi.getInstallers(templateId!, userId!),
    enabled: !!templateId && !!userId,
  });
}
