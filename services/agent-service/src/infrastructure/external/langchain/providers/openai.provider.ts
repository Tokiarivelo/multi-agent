import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';
import {
  LLMConfig,
  LLMResponse,
  StreamingOptions,
} from '../../../../application/interfaces/langchain-provider.interface';
import { ConversationMessage } from '../../../../domain/entities/agent.entity';

@Injectable()
export class OpenAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private model!: ChatOpenAI;

  async initialize(config: LLMConfig): Promise<void> {
    this.model = new ChatOpenAI({
      modelName: config.model,
      openAIApiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens,
      streaming: false,
    });

    this.logger.log(`Initialized OpenAI provider with model: ${config.model}`);
  }

  async execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let response;
      if (tools && tools.length > 0) {
        const openAITools = tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
        response = await this.model.bind({ tools: openAITools as any }).invoke(langchainMessages);
      } else {
        response = await this.model.invoke(langchainMessages);
      }

      const tokens = this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        finishReason: response.response_metadata?.finish_reason,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`OpenAI execution error: ${error.message}`);
      throw error;
    }
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    try {
      const streamingModel = new ChatOpenAI({
        modelName: this.model.modelName,
        openAIApiKey: this.model.openAIApiKey,
        temperature: this.model.temperature,
        maxTokens: this.model.maxTokens,
        streaming: true,
      });

      const langchainMessages = this.convertMessages(messages);

      let fullContent = '';
      let tokenCount = 0;

      let boundModel: any = streamingModel;
      if (tools && tools.length > 0) {
        const openAITools = tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
        boundModel = streamingModel.bind({ tools: openAITools as any });
      }

      const stream = await boundModel.stream(langchainMessages);

      if (!stream) {
        throw new Error('Failed to create stream');
      }

      let aggregated: any;
      for await (const chunk of stream) {
        aggregated = aggregated === undefined ? chunk : concat(aggregated, chunk);
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (text) {
          fullContent += text;
          tokenCount = this.estimateTokens(fullContent);
          callbacks.onToken(text);
        }
      }

      await callbacks.onComplete({
        content: fullContent,
        tokens: tokenCount,
        toolCalls: aggregated?.tool_calls ?? [],
      });
    } catch (error) {
      this.logger.error(`OpenAI streaming error: ${error.message}`);
      callbacks.onError(error);
    }
  }

  private convertMessages(messages: ConversationMessage[]): any[] {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant': {
          const kwargs: any = { content: msg.content };
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            kwargs.tool_calls = msg.toolCalls;
          }
          return new AIMessage(kwargs);
        }
        case 'tool':
        case 'function':
          return new ToolMessage({
            content: msg.content || '',
            name: msg.name || 'tool',
            tool_call_id: msg.toolCallId || '',
          });
        default:
          return new HumanMessage(msg.content);
      }
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  isSupported(provider: string): boolean {
    return provider?.toLowerCase() === 'openai';
  }
}
