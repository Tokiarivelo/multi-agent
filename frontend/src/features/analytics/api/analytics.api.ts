import { apiClient } from '@/lib/api-client';

export type ChartPeriod = 'daily' | 'weekly' | 'monthly';

export interface ChartDataPoint {
  date: string;
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  executions: number;
}

export interface ChartResponse {
  period: ChartPeriod;
  data: ChartDataPoint[];
}

export interface ChartFilters {
  userId: string;
  period: ChartPeriod;
  agentId?: string;
  isTest?: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  userId: string;
  agentId: string;
  executionId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputPreview: string | null;
  outputPreview: string | null;
  success: boolean;
  errorMessage: string | null;
  agentName?: string;
}

export interface PaginatedTokenUsage {
  data: TokenUsageRecord[];
  total: number;
  page: number;
  limit: number;
  totalTokensSum: number;
}

export interface TokenUsageFilters {
  userId: string;
  agentId?: string;
  model?: string;
  isTest?: boolean;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const analyticsApi = {
  getTokenUsage: async (filters: TokenUsageFilters): Promise<PaginatedTokenUsage> => {
    const params = new URLSearchParams();
    params.set('userId', filters.userId);
    if (filters.agentId) params.set('agentId', filters.agentId);
    if (filters.model) params.set('model', filters.model);
    if (filters.isTest !== undefined) params.set('isTest', String(filters.isTest));
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);
    params.set('page', String(filters.page ?? 1));
    params.set('limit', String(filters.limit ?? 20));

    const { data } = await apiClient.get<PaginatedTokenUsage>(
      `/api/agents/token-usage?${params.toString()}`,
    );
    return data;
  },

  getTokenUsageChart: async (filters: ChartFilters): Promise<ChartResponse> => {
    const params = new URLSearchParams();
    params.set('userId', filters.userId);
    params.set('period', filters.period);
    if (filters.agentId) params.set('agentId', filters.agentId);
    if (filters.isTest !== undefined) params.set('isTest', String(filters.isTest));
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);

    const { data } = await apiClient.get<ChartResponse>(
      `/api/agents/token-usage/chart?${params.toString()}`,
    );
    return data;
  },
};
