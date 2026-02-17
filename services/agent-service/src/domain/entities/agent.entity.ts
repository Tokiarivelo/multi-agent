export interface Agent {
  id: string;
  name: string;
  description: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  output?: string;
  tokens?: number;
  status: ExecutionStatus;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: any;
}

export interface AgentContext {
  conversationHistory: ConversationMessage[];
  metadata?: Record<string, any>;
}
