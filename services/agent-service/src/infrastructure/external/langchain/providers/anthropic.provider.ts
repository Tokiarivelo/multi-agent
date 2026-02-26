import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  LLMConfig,
  LLMResponse,
  StreamingOptions,
} from '../../../../application/interfaces/langchain-provider.interface';
import { ConversationMessage } from '../../../../domain/entities/agent.entity';

@Injectable()
export class AnthropicProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private model: ChatAnthropic;

  async initialize(config: LLMConfig): Promise<void> {
    this.model = new ChatAnthropic({
      modelName: config.model,
      anthropicApiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      streaming: false,
    });

    this.logger.log(`Initialized Anthropic provider with model: ${config.model}`);
  }

  async execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let response;
      if (tools && tools.length > 0) {
        const modelWithTools = this.model.bind({ tools });
        response = await modelWithTools.invoke(langchainMessages);
      } else {
        response = await this.model.invoke(langchainMessages);
      }

      const tokens = this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        finishReason: response.response_metadata?.stop_reason,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`Anthropic execution error: ${error.message}`);
      throw error;
    }
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    try {
      const streamingModel = new ChatAnthropic({
        modelName: this.model.modelName,
        anthropicApiKey: this.model.anthropicApiKey,
        temperature: this.model.temperature,
        maxTokens: this.model.maxTokens,
        streaming: true,
      });

      const langchainMessages = this.convertMessages(messages);

      let fullContent = '';
      let tokenCount = 0;

      const stream =
        tools && tools.length > 0
          ? await streamingModel.bind({ tools }).stream(langchainMessages)
          : await streamingModel.stream(langchainMessages);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        if (content) {
          fullContent += content;
          tokenCount = this.estimateTokens(fullContent);
          callbacks.onToken(content);
        }
      }

      callbacks.onComplete({
        content: fullContent,
        tokens: tokenCount,
      });
    } catch (error) {
      this.logger.error(`Anthropic streaming error: ${error.message}`);
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
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          return new HumanMessage(msg.content);
      }
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  isSupported(provider: string): boolean {
    return provider === 'anthropic';
  }
}
