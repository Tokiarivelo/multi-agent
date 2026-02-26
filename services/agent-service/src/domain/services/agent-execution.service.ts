import { Injectable } from '@nestjs/common';
import { Agent, AgentContext, ConversationMessage } from '../entities/agent.entity';

export interface ExecutionResult {
  output: string;
  tokens: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onComplete: (result: ExecutionResult) => void;
  onError: (error: Error) => void;
}

@Injectable()
export class AgentExecutionService {
  validateAgent(agent: Agent): void {
    if (!agent.name || agent.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }
    
    if (!agent.modelId || agent.modelId.trim().length === 0) {
      throw new Error('Model ID is required');
    }
    
    if (agent.temperature !== undefined) {
      if (agent.temperature < 0 || agent.temperature > 2) {
        throw new Error('Temperature must be between 0 and 2');
      }
    }
    
    if (agent.maxTokens !== undefined) {
      if (agent.maxTokens < 1 || agent.maxTokens > 100000) {
        throw new Error('Max tokens must be between 1 and 100000');
      }
    }
  }

  buildContext(
    messages: ConversationMessage[],
    systemPrompt?: string,
  ): AgentContext {
    const conversationHistory: ConversationMessage[] = [];
    
    if (systemPrompt) {
      conversationHistory.push({
        role: 'system',
        content: systemPrompt,
      });
    }
    
    conversationHistory.push(...messages);
    
    return {
      conversationHistory,
    };
  }

  formatMessages(context: AgentContext): ConversationMessage[] {
    return context.conversationHistory;
  }

  countTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  validateTokenLimit(messages: ConversationMessage[], maxTokens: number): void {
    const totalTokens = messages.reduce((sum, msg) => {
      return sum + this.countTokens(msg.content);
    }, 0);
    
    if (totalTokens > maxTokens) {
      throw new Error(`Total tokens (${totalTokens}) exceeds limit (${maxTokens})`);
    }
  }
}
