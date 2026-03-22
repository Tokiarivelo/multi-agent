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

  getStatusByPath: async (path: string): Promise<FileIndexStatus & { id?: string }> => {
    try {
      const res = await apiClient.get(`/api/files/by-path`, { params: { path } });
      return {
        fileId: res.data.indexingStatus?.fileId || '',
        status: res.data.indexingStatus?.status || 'idle',
        collectionId: res.data.indexingStatus?.collectionId || null,
        chunkCount: res.data.indexingStatus?.chunkCount || 0,
        indexedAt: res.data.indexingStatus?.indexedAt || null,
        error: res.data.indexingStatus?.error || null,
        id: res.data.id,
      };
    } catch (err) {
      console.error(`Failed to get status for ${path}:`, err);
      return {
        fileId: '',
        status: 'error',
        collectionId: null,
        chunkCount: 0,
        indexedAt: null,
        error: 'API request failed',
      };
    }
  },

  getBulkStatusByPaths: async (
    paths: string[],
  ): Promise<Record<string, FileIndexStatus & { id?: string }>> => {
    try {
      const res = await apiClient.post(`/api/files/bulk-status`, { paths });
      const result: Record<string, FileIndexStatus & { id?: string }> = {};
      
      for (const [path, data] of Object.entries(res.data as Record<string, { indexingStatus?: FileIndexStatus, id?: string }>)) {
        result[path] = {
          fileId: data.indexingStatus?.fileId || '',
          status: data.indexingStatus?.status || 'idle',
          collectionId: data.indexingStatus?.collectionId || null,
          chunkCount: data.indexingStatus?.chunkCount || 0,
          indexedAt: data.indexingStatus?.indexedAt || null,
          error: data.indexingStatus?.error || null,
          id: data.id,
        };
      }
      return result;
    } catch (err) {
      console.error('Failed to get bulk status:', err);
      const fallback: Record<string, FileIndexStatus & { id?: string }> = {};
      paths.forEach((p) => {
        fallback[p] = {
          fileId: '',
          status: 'error',
          collectionId: null,
          chunkCount: 0,
          indexedAt: null,
          error: 'API request failed',
        };
      });
      return fallback;
    }
  },

  searchFiles: async (
    query: string,
    limit = 5,
    fileId?: string,
  ): Promise<FileSearchResult[]> => {
    const res = await apiClient.post(`/api/files/search`, { query, limit, fileId });
    return res.data.results ?? [];
  },

  indexByPath: async (path: string): Promise<{ message: string; count: number }> => {
    const res = await apiClient.post(`/api/files/index-path`, { path });
    return res.data;
  },
};
