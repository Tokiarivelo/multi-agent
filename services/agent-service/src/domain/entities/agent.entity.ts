export interface Agent {
  id: string;
  userId: string;
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
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  functionCall?: any;
  toolCalls?: any[];
  toolCallId?: string;
}

export interface AgentContext {
  conversationHistory: ConversationMessage[];
  metadata?: Record<string, any>;
}
