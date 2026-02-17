import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { LLMConfig } from '../../../../application/interfaces/langchain-provider.interface';

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
  ) {}

  getProvider(config: LLMConfig): OpenAIProvider | AnthropicProvider {
    switch (config.provider) {
      case 'openai':
        return this.openaiProvider;
      case 'anthropic':
        return this.anthropicProvider;
      case 'google':
      case 'azure':
      case 'ollama':
        throw new BadRequestException(`Provider ${config.provider} is not yet supported`);
      default:
        throw new BadRequestException(`Unknown provider: ${config.provider}`);
    }
  }

  isSupported(provider: string): boolean {
    return ['openai', 'anthropic'].includes(provider);
  }
}
