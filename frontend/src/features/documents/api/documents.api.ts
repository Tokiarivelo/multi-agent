import { apiClient } from '@/lib/api-client';

export interface DocumentSection {
  heading?: string;
  body?: string;
  level?: number;
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export interface DocumentMetadata {
  subject?: string;
  keywords?: string;
  company?: string;
}

export interface GenerateDocumentRequest {
  format: string;
  title: string;
  author?: string;
  sections?: DocumentSection[];
  table?: TableData;
  metadata?: DocumentMetadata;
}

export interface DocumentFormat {
  id: string;
  label: string;
  mime: string;
  ext: string;
}

export const documentsApi = {
  getFormats: async (): Promise<{ formats: DocumentFormat[] }> => {
    const { data } = await apiClient.get<{ formats: DocumentFormat[] }>(
      '/api/documents/formats',
    );
    return data;
  },

  generate: async (req: GenerateDocumentRequest): Promise<Blob> => {
    const response = await apiClient.post('/api/documents/generate', req, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
