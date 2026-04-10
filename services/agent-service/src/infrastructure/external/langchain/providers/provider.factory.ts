import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';
import { OllamaProvider } from './ollama.provider';
import { LLMConfig } from '../../../../application/interfaces/langchain-provider.interface';

@Injectable()
export class ProviderFactory {
  constructor(
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly googleProvider: GoogleProvider,
    private readonly ollamaProvider: OllamaProvider,
  ) {}

  getProvider(config: LLMConfig): OpenAIProvider | AnthropicProvider | GoogleProvider | OllamaProvider {
    switch (config.provider?.toLowerCase()) {
      case 'openai':
        return this.openaiProvider;
      case 'anthropic':
        return this.anthropicProvider;
      case 'google':
        return this.googleProvider;
      case 'ollama':
        return this.ollamaProvider;
      case 'azure':
        throw new BadRequestException(`Provider ${config.provider} is not yet supported`);
      default:
        throw new BadRequestException(`Unknown provider: ${config.provider}`);
    }
  }

  isSupported(provider: string): boolean {
    return ['openai', 'anthropic', 'google', 'ollama'].includes(provider?.toLowerCase());
  }
}
