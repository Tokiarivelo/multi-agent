export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  modelId?: string;
  agentId?: string;
  workflowId?: string;
  tools: string[];
  systemPrompt?: string;
  memoryContext?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: ChatAttachment[];
  metadata?: Record<string, unknown>;
  toolCalls?: ChatToolCall[];
  thinkingSteps?: ChatThinkingStep[];
  tokens?: number;
  createdAt: Date;
}

export interface ChatAttachment {
  fileId: string;
  name: string;
  mimeType: string;
  url?: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  error?: boolean;
}

export interface ChatThinkingStep {
  step: string;
  thought?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
}
