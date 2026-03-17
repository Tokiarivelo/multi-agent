// Core Types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

// Workflow Types
export interface WorkflowIOField {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  definition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    version: number;
    inputSchema?: WorkflowIOField[];
    outputSchema?: WorkflowIOField[];
  };
  status: 'draft' | 'active' | 'archived' | 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  /** Backend sends uppercase: AGENT | TOOL | CONDITIONAL | TRANSFORM | START | END */
  type:
    | 'AGENT'
    | 'TOOL'
    | 'CONDITIONAL'
    | 'TRANSFORM'
    | 'START'
    | 'END'
    | 'PROMPT'
    | 'TEXT'
    | 'FILE'
    | 'agent'
    | 'tool'
    | 'condition'
    | 'prompt'
    | 'text'
    | 'file';
  data: {
    agentId?: string;
    toolId?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  description?: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreateInput {
  name: string;
  description?: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

// Tool Types
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'WEB' | 'API' | 'DATABASE' | 'FILE' | 'CUSTOM' | string;
  parameters: ToolParameter[];
  code?: string;
  icon?: string;
  isBuiltIn: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

// End Tool Types

export enum ModelProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE = 'GOOGLE',
  AZURE = 'AZURE',
  OLLAMA = 'OLLAMA',
  CUSTOM = 'CUSTOM',
}

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider | string;
  modelId: string;
  description?: string;
  maxTokens: number;
  supportsStreaming: boolean;
  defaultTemperature?: number;
  isActive: boolean;
  isDefault: boolean;
  status?: 'available' | 'unavailable' | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  name: string;
  provider: ModelProvider | string;
  modelId: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  defaultTemperature?: number;
  isActive?: boolean;
  providerSettings?: Record<string, unknown>;
}

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
}

export interface ApiKey {
  id: string;
  userId: string;
  provider: ModelProvider | string;
  keyName: string;
  apiKeyHash: string;
  keyPrefix?: string;
  isActive: boolean;
  isValid: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyInput {
  userId: string;
  provider: ModelProvider | string;
  keyName: string;
  apiKey: string;
}

// Execution Types
export interface Execution {
  id: string;
  workflowId: string;
  workflow?: Workflow;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// WebSocket Types
export interface TokenStreamEvent {
  type: 'token' | 'complete' | 'error';
  token?: string;
  content?: string;
  error?: string;
  executionId: string;
}

export interface WebSocketMessage {
  event: string;
  data: unknown;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}
