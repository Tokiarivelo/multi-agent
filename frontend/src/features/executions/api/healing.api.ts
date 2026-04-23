import { apiClient } from '@/lib/api-client';

export type HealingStrategy = 'AUTO_FIX' | 'MANUAL_APPROVAL' | 'LOG_ONLY';
export type HealingStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'FAILED';
export type HealingFailureType = 'TECHNICAL' | 'FUNCTIONAL';

export interface HealingSuggestion {
  errorCategory:
    | 'missing_param'
    | 'wrong_path'
    | 'tool_not_found'
    | 'timeout'
    | 'type_mismatch'
    | 'permission_denied'
    | 'other';
  explanation: string;
  fixSummary: string;
  fixedConfig: Record<string, unknown>;
  strategy: HealingStrategy;
  confidence: number;
}

export interface HealingAnalysisResult {
  healingLogId: string;
  executionId: string;
  failedNodeId: string;
  failedNodeName: string;
  errorMessage: string;
  suggestion: HealingSuggestion;
}

export interface FunctionalFailureResult {
  isFunctionalFailure: boolean;
  confidence: number;
  failureReason: string;
  failedNodeId: string;
  failedNodeName: string;
  suggestedAction: string;
  fixedConfig: Record<string, unknown>;
  strategy: HealingStrategy;
  executionId?: string;
  executionStatus?: string;
  healingLogId?: string;
}

export interface HealingLog {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string | null;
  nodeType: string | null;
  errorMessage: string;
  suggestion: HealingSuggestion | { explanation: string; fixSummary: string; fixedConfig: Record<string, unknown>; strategy: HealingStrategy; confidence: number; suggestedAction?: string };
  failureType: HealingFailureType;
  strategy: HealingStrategy;
  status: HealingStatus;
  appliedAt: string | null;
  createdAt: string;
}

export interface ApplyFixResult {
  success: boolean;
  newExecutionId: string;
  healingLogId: string;
  fixApplied: string;
}

export const healingApi = {
  analyze: async (executionId: string, modelId: string): Promise<HealingAnalysisResult> => {
    const { data } = await apiClient.post<HealingAnalysisResult>(
      `/api/workflows/executions/${executionId}/heal`,
      { modelId },
    );
    return data;
  },

  applyFix: async (executionId: string, healingLogId: string, modelId: string): Promise<ApplyFixResult> => {
    const { data } = await apiClient.post<ApplyFixResult>(
      `/api/workflows/executions/${executionId}/apply-fix`,
      { healingLogId, modelId },
    );
    return data;
  },

  rejectFix: async (executionId: string, healingLogId: string): Promise<void> => {
    await apiClient.post(`/api/workflows/executions/${executionId}/reject-fix`, { healingLogId });
  },

  getLogs: async (executionId: string): Promise<HealingLog[]> => {
    const { data } = await apiClient.get<{ data: HealingLog[] }>(
      `/api/workflows/executions/${executionId}/healing-logs`,
    );
    return data.data;
  },

  analyzeOutcome: async (
    executionId: string,
    modelId: string,
    originalRequest?: string,
    forceLlm = false,
  ): Promise<FunctionalFailureResult> => {
    const { data } = await apiClient.post<FunctionalFailureResult>(
      `/api/workflows/executions/${executionId}/analyze-outcome`,
      { modelId, originalRequest, forceLlm },
    );
    return data;
  },

  analyzeTestOutcome: async (params: {
    workflowId: string;
    nodeId: string;
    modelId: string;
    output: unknown;
    input?: unknown;
    nodeType?: string;
    nodeName?: string;
    forceLlm?: boolean;
    userId?: string;
  }): Promise<FunctionalFailureResult> => {
    const { workflowId, nodeId, ...body } = params;
    const { data } = await apiClient.post<FunctionalFailureResult>(
      `/api/workflows/${workflowId}/nodes/${nodeId}/analyze-test-outcome`,
      body,
    );
    return data;
  },
};
