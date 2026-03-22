import { apiClient } from '@/lib/api-client';

export type IndexStatus = 'idle' | 'indexing' | 'indexed' | 'error';

export interface FileIndexStatus {
  fileId: string;
  status: IndexStatus;
  collectionId: string | null;
  chunkCount: number;
  indexedAt: string | null;
  error: string | null;
}

export interface FileSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: {
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    chunkIndex?: number;
    chunkCount?: number;
  };
}

export const fileIndexingApi = {
  startIndexing: async (
    fileId: string,
    options?: {
       embeddingModelId?: string;
       apiKeyId?: string;
       useSummarization?: boolean;
       summarizationModelId?: string;
       summarizationApiKeyId?: string;
    }
  ): Promise<{ fileId: string; status: IndexStatus }> => {
    const res = await apiClient.post(`/api/files/${fileId}/index`, options || {});
    return res.data;
  },

  getStatus: async (fileId: string): Promise<FileIndexStatus> => {
    const res = await apiClient.get(`/api/files/${fileId}/index-status`);
    return res.data;
  },

  removeIndex: async (fileId: string): Promise<void> => {
    await apiClient.delete(`/api/files/${fileId}/index`);
  },

  searchFiles: async (
    query: string,
    limit = 5,
    fileId?: string,
  ): Promise<FileSearchResult[]> => {
    const res = await apiClient.post(`/api/files/search`, { query, limit, fileId });
    return res.data.results ?? [];
  },
};
