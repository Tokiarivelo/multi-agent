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
export type NodeTypeId =
  | 'START'
  | 'END'
  | 'AGENT'
  | 'TOOL'
  | 'MCP'
  | 'CONDITIONAL'
  | 'TRANSFORM'
  | 'PROMPT'
  | 'TEXT'
  | 'FILE'
  | 'LOOP'
  | 'GITHUB'
  | 'SLACK'
  | 'WHATSAPP'
  | 'SHELL'
  | 'WORKSPACE_READ'
  | 'WORKSPACE_WRITE'
  | 'SUBWORKFLOW'
  | 'ORCHESTRATOR'
  | 'EMAIL'
  | 'DOWNLOAD_FILE'
  | 'JSON'
  | 'WHILE'
  | 'SWITCH'
  | 'FOR_EACH'
  | 'DOCUMENT';

export interface WorkflowIOField {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export type WorkflowVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';
export type CollaboratorRole = 'VIEWER' | 'EXECUTOR' | 'EDITOR';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface WorkflowOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface WorkflowCollaboratorSummary {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface WorkflowForkedFrom {
  id: string;
  name: string;
  owner?: { firstName: string; lastName: string; email: string };
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
  visibility?: WorkflowVisibility;
  userId?: string;
  forkedFromId?: string;
  forkedFrom?: WorkflowForkedFrom;
  createdAt: string;
  updatedAt: string;
  owner?: WorkflowOwner;
  collaborators?: WorkflowCollaboratorSummary[];
  isTemplate?: boolean;
  category?: string | null;
  tags?: string[];
  authorName?: string | null;
}

export interface WorkflowCollaborator {
  id: string;
  workflowId: string;
  userId: string;
  role: CollaboratorRole;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
  status: InvitationStatus;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface WorkflowInvitation {
  id: string;
  workflowId: string;
  email: string;
  invitedBy: string;
  role: CollaboratorRole;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  workflow?: { id: string; name: string; description?: string };
  inviter?: { firstName: string; lastName: string; email: string };
}

export interface WorkflowAccessRequest {
  id: string;
  workflowId: string;
  requesterId: string;
  status: AccessRequestStatus;
  message?: string;
  requestedAt: string;
  respondedAt?: string;
}

export interface WorkflowChangeLog {
  id: string;
  workflowId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export type ForkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ForkRequestType = 'fork' | 'view';

export interface WorkflowForkRequest {
  id: string;
  workflowId: string;
  requesterId: string;
  status: ForkRequestStatus;
  type?: ForkRequestType;
  message?: string;
  createdAt: string;
  respondedAt?: string;
  requester?: { id: string; firstName: string; lastName: string; email: string };
  workflow?: { id: string; name: string };
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'collaborator_added' | 'fork_request_approved' | 'fork_request_rejected' | 'invitation_received' | 'workflow_request_received';
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface WorkflowNode {
  id: string;
  /** Backend sends uppercase NodeTypeId, legacy frontend uses lowercase */
  type: NodeTypeId | Lowercase<NodeTypeId>;
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
  sourceHandle?: string;
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
export interface McpConfig {
  serverUrl: string;
  toolName: string;
  transport: 'http' | 'sse';
  headers?: Record<string, string>;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'WEB' | 'API' | 'DATABASE' | 'FILE' | 'CUSTOM' | 'MCP' | string;
  parameters: ToolParameter[];
  code?: string;
  icon?: string;
  isBuiltIn: boolean;
  mcpConfig?: McpConfig;
  repoFullName?: string;
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

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
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
  pageSize?: number;
  limit?: number;
  totalPages?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// GitHub OAuth Integration Types
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
  defaultBranch: string;
  fork: boolean;
}

export interface GitHubConnection {
  connected: boolean;
  login?: string;
  avatarUrl?: string;
  accessToken?: string;
}
