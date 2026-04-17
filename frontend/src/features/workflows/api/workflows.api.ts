import { apiClient } from '@/lib/api-client';
import { Workflow, PaginatedResponse, NodeTypeId } from '@/types';

// ─── AI types ─────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiSession {
  id: string;
  workflowId?: string;
  modelId: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiWorkflowResult {
  sessionId: string;
  message: string;
  definition?: Workflow['definition'];
  name?: string;
  description?: string;
  history: AiMessage[];
  /** Resources auto-created during AI generation */
  provisionedResources?: {
    agents: Array<{ name: string; id: string }>;
    tools: Array<{ name: string; id: string }>;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  nodeExecutions: NodeExecution[];
  currentNodeId?: string;
  startedAt?: string;
  completedAt?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NodeExecution {
  nodeId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
}

export interface WorkflowExecutionSummary {
  executionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  nodeExecutions: unknown;
  error: string | null;
  createdAt: string;
}

export interface PaginatedExecutionSummaries {
  data: WorkflowExecutionSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface AddNodePayload {
  id: string;
  type: NodeTypeId;
  customName?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface AddEdgePayload {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export const workflowsApi = {
  // ─── Workflow CRUD ────────────────────────────────────────────────

  getAll: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Workflow>> => {
    const { data } = await apiClient.get<PaginatedResponse<Workflow>>(
      `/api/workflows?page=${page}&pageSize=${pageSize}`,
    );
    return data;
  },

  getById: async (id: string): Promise<Workflow> => {
    const { data } = await apiClient.get<Workflow>(`/api/workflows/${id}`);
    return data;
  },

  create: async (workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await apiClient.post<Workflow>('/api/workflows', workflow);
    return data;
  },

  update: async (id: string, workflow: Partial<Workflow>): Promise<Workflow> => {
    const { data } = await apiClient.put<Workflow>(`/api/workflows/${id}`, workflow);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/${id}`);
  },

  // ─── Node operations ──────────────────────────────────────────────

  addNode: async (workflowId: string, node: AddNodePayload): Promise<Workflow> => {
    const { data } = await apiClient.post<Workflow>(`/api/workflows/${workflowId}/nodes`, node);
    return data;
  },

  updateNode: async (
    workflowId: string,
    nodeId: string,
    node: Partial<AddNodePayload>,
  ): Promise<Workflow> => {
    const payload = { ...node };
    delete payload.id;

    const { data } = await apiClient.put<Workflow>(
      `/api/workflows/${workflowId}/nodes/${nodeId}`,
      payload,
    );
    return data;
  },

  deleteNode: async (workflowId: string, nodeId: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/${workflowId}/nodes/${nodeId}`);
  },

  // ─── Edge operations ──────────────────────────────────────────────

  addEdge: async (workflowId: string, edge: AddEdgePayload): Promise<Workflow> => {
    const { data } = await apiClient.post<Workflow>(`/api/workflows/${workflowId}/edges`, edge);
    return data;
  },

  deleteEdge: async (workflowId: string, edgeId: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/${workflowId}/edges/${edgeId}`);
  },

  // ─── Execution ────────────────────────────────────────────────────

  execute: async (id: string, input?: Record<string, unknown>): Promise<WorkflowExecution> => {
    const { data } = await apiClient.post<WorkflowExecution>(`/api/workflows/${id}/execute`, {
      input,
    });
    return data;
  },

  getExecution: async (executionId: string): Promise<WorkflowExecution> => {
    const { data } = await apiClient.get<WorkflowExecution>(
      `/api/workflows/executions/${executionId}`,
    );
    return data;
  },

  cancelExecution: async (executionId: string): Promise<void> => {
    await apiClient.post(`/api/workflows/executions/${executionId}/cancel`);
  },

  resumeNode: async (executionId: string, nodeId: string, input: string): Promise<void> => {
    await apiClient.post(`/api/workflows/executions/${executionId}/nodes/${nodeId}/resume`, {
      input,
    });
  },

  testNode: async (
    workflowId: string,
    nodeId: string,
    input: Record<string, unknown>,
    type?: string,
    config?: Record<string, unknown>,
    executionId?: string,
  ): Promise<{ input: unknown; output: unknown; error?: string; logs: string[] }> => {
    const { data } = await apiClient.post(`/api/workflows/${workflowId}/nodes/${nodeId}/test`, {
      input,
      type,
      config,
      executionId,
    });
    return data;
  },

  getExecutions: async (
    workflowId: string,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<PaginatedExecutionSummaries> => {
    const { data } = await apiClient.get<PaginatedExecutionSummaries>(
      `/api/workflows/${workflowId}/executions`,
      { params: { page, limit, sortBy, sortOrder } },
    );
    return data;
  },

  // ─── AI generation ────────────────────────────────────────────────

  generateWithAi: async (payload: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<AiWorkflowResult> => {
    const { data } = await apiClient.post<AiWorkflowResult>('/api/workflows/ai/generate', payload);
    return data;
  },

  editWithAi: async (
    workflowId: string,
    payload: { prompt: string; modelId: string; sessionId?: string },
  ): Promise<AiWorkflowResult> => {
    const { data } = await apiClient.post<AiWorkflowResult>(
      `/api/workflows/${workflowId}/ai/edit`,
      payload,
    );
    return data;
  },

  deleteAiSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/api/workflows/ai/sessions/${sessionId}`);
  },

  // ─── Files ────────────────────────────────────────────────────────

  uploadFile: async (
    file: File,
  ): Promise<{ id: string; key: string; storedName: string; url?: string }> => {
    // 1. Initiate upload to get a pre-signed url from MinIO
    const { data: initData } = await apiClient.post<{
      uploadUrl: string;
      record: { id: string; key: string; storedName: string; url?: string };
    }>('/api/files/initiate-upload', {
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });

    // 2. Upload file directly to MinIO
    let presignedUrl = initData.uploadUrl;
    // In local development, the presigned url generated by the backend
    // might point to internally routed "minio" but the browser only resolves localhost
    if (presignedUrl.includes('://minio:')) {
      presignedUrl = presignedUrl.replace('://minio:', '://localhost:');
    }

    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      // Note: MinIO requires these headers correctly or pre-flight CORS might fail
    });

    if (!response.ok) {
      throw new Error(`Direct MinIO upload failed: ${response.statusText}`);
    }

    if (initData.record.url && initData.record.url.includes('://minio:')) {
      initData.record.url = initData.record.url.replace('://minio:', '://localhost:');
    }

    return initData.record;
  },

  getFileUrl: async (fileId: string): Promise<{ url: string }> => {
    const { data } = await apiClient.get<{ url: string }>(`/api/files/${fileId}/url`);
    return data;
  },

  // ─── Backend Workspace Fallback (for non-native browsers) ──────────

  getWorkspaceTree: async (path: string) => {
    const { data } = await apiClient.get('/api/workspace/tree', { params: { path } });
    return data;
  },

  readWorkspaceFile: async (path: string) => {
    const { data } = await apiClient.get('/api/workspace/file', { params: { path } });
    return data as { content: string };
  },

  writeWorkspaceFile: async (path: string, content: string) => {
    const { data } = await apiClient.post('/api/workspace/file', { path, content });
    return data;
  },

  createWorkspaceItem: async (path: string, type: 'file' | 'directory') => {
    const { data } = await apiClient.post('/api/workspace/item', { path, type });
    return data;
  },
};

/** Opens the given absolute folder path in the host machine's native file manager. */
export async function revealFolderInExplorer(
  folderPath: string,
): Promise<{ success: boolean; error?: string }> {
  const { data } = await apiClient.post<{ success: boolean; error?: string }>(
    '/api/workflows/reveal-folder',
    { path: folderPath },
  );
  return data;
}
