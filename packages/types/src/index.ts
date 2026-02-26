// User and Authentication
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Workflow
export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export enum NodeType {
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  MODEL = 'MODEL',
  TRIGGER = 'TRIGGER',
  CONDITION = 'CONDITION',
  TRANSFORM = 'TRANSFORM',
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// Agent
export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  modelId: string;
  tools: string[];
  temperature?: number;
  maxTokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Tool
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  code?: string;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
}

export enum ToolCategory {
  WEB = 'WEB',
  API = 'API',
  DATABASE = 'DATABASE',
  FILE = 'FILE',
  CUSTOM = 'CUSTOM',
}

// Model
export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  modelName: string;
  maxTokens: number;
  supportsStreaming: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ModelProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE = 'GOOGLE',
  AZURE = 'AZURE',
  OLLAMA = 'OLLAMA',
}

// API Keys
export interface ApiKey {
  id: string;
  userId: string;
  provider: ModelProvider;
  encryptedKey: string;
  createdAt: Date;
  updatedAt: Date;
}

// Execution
export interface Execution {
  id: string;
  workflowId: string;
  userId: string;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Execution Log
export interface ExecutionLog {
  id: string;
  executionId: string;
  nodeId: string;
  status: ExecutionStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Vector
export interface VectorCollection {
  id: string;
  userId: string;
  name: string;
  dimension: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VectorDocument {
  id: string;
  collectionId: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

// Health Check
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  service: string;
  version: string;
  dependencies?: {
    database?: boolean;
    redis?: boolean;
    vector?: boolean;
  };
}
