// Core Types
export interface User {
  id: string;
  email: string;
  name: string;
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
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'condition';
  data: {
    agentId?: string;
    toolId?: string;
    config?: Record<string, unknown>;
  };
  position: { x: number; y: number };
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
  type: 'function' | 'api' | 'database';
  schema: ToolSchema;
  config?: Record<string, unknown>;
  status: 'available' | 'unavailable';
  createdAt: string;
  updatedAt: string;
}

export interface ToolSchema {
  parameters: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

// Model Types
export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  modelId: string;
  capabilities: string[];
  maxTokens: number;
  costPer1kTokens?: number;
  status: 'available' | 'unavailable';
  createdAt: string;
  updatedAt: string;
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
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
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
