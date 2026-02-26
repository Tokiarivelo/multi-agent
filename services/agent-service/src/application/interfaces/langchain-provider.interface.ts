import { ConversationMessage } from '../../domain/entities/agent.entity';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  tokens: number;
  finishReason?: string;
  toolCalls?: any[];
}

export interface StreamingOptions {
  onToken: (token: string) => void;
  onComplete: (response: LLMResponse) => void;
  onError: (error: Error) => void;
}

export interface ILangChainProvider {
  initialize(config: LLMConfig): Promise<void>;
  execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse>;
  executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void>;
  isSupported(provider: string): boolean;
}

export const LANGCHAIN_PROVIDER = Symbol('LANGCHAIN_PROVIDER');
