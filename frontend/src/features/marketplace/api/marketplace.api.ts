import { apiClient } from '@/lib/api-client';
import {
  InstalledTemplate,
  InstallerRecord,
  MyPublishedWorkflow,
  PaginatedTemplates,
  PublishWorkflowPayload,
  PublishedWorkflowResult,
  TemplateDetail,
  UpdatePublishedPayload,
} from '../types/marketplace.types';

export interface ListTemplatesParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const marketplaceApi = {
  // ─── Read ──────────────────────────────────────────────────────────────────

  list: async (params: ListTemplatesParams = {}): Promise<PaginatedTemplates> => {
    const { category, search, page = 1, limit = 12 } = params;
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (category) query.set('category', category);
    if (search) query.set('search', search);
    const { data } = await apiClient.get<PaginatedTemplates>(
      `/api/workflows/marketplace?${query}`,
    );
    return data;
  },

  categories: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/api/workflows/marketplace/categories');
    return data;
  },

  getById: async (id: string): Promise<TemplateDetail> => {
    const { data } = await apiClient.get<TemplateDetail>(`/api/workflows/marketplace/${id}`);
    return data;
  },

  // ─── Install ───────────────────────────────────────────────────────────────

  install: async (templateId: string, userId: string): Promise<InstalledTemplate> => {
    const { data } = await apiClient.post<InstalledTemplate>(
      `/api/workflows/marketplace/${templateId}/install?userId=${userId}`,
    );
    return data;
  },

  // ─── Publish ───────────────────────────────────────────────────────────────

  publish: async (payload: PublishWorkflowPayload, userId: string): Promise<PublishedWorkflowResult> => {
    const { data } = await apiClient.post<PublishedWorkflowResult>(
      `/api/workflows/marketplace/publish?userId=${userId}`,
      payload,
    );
    return data;
  },

  unpublish: async (workflowId: string, userId: string): Promise<void> => {
    await apiClient.post(`/api/workflows/marketplace/${workflowId}/unpublish?userId=${userId}`);
  },

  updatePublished: async (
    workflowId: string,
    userId: string,
    payload: UpdatePublishedPayload,
  ): Promise<PublishedWorkflowResult> => {
    const { data } = await apiClient.patch<PublishedWorkflowResult>(
      `/api/workflows/marketplace/${workflowId}/publish?userId=${userId}`,
      payload,
    );
    return data;
  },

  getMyPublished: async (userId: string): Promise<MyPublishedWorkflow[]> => {
    const { data } = await apiClient.get<MyPublishedWorkflow[]>(
      `/api/workflows/marketplace/my-published?userId=${userId}`,
    );
    return data;
  },

  getInstallers: async (templateId: string, userId: string): Promise<InstallerRecord[]> => {
    const { data } = await apiClient.get<InstallerRecord[]>(
      `/api/workflows/marketplace/${templateId}/installers?userId=${userId}`,
    );
    return data;
  },
};
