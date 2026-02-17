import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ModelProvider } from '../../domain/entities/model.entity';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProviderValidatorService {
  private readonly logger = new Logger(ProviderValidatorService.name);

  constructor(private readonly httpService: HttpService) {}

  async validateApiKey(provider: ModelProvider, apiKey: string): Promise<boolean> {
    try {
      switch (provider) {
        case ModelProvider.OPENAI:
          return await this.validateOpenAI(apiKey);
        case ModelProvider.ANTHROPIC:
          return await this.validateAnthropic(apiKey);
        case ModelProvider.GOOGLE:
          return await this.validateGoogle(apiKey);
        case ModelProvider.AZURE:
          return await this.validateAzure(apiKey);
        case ModelProvider.OLLAMA:
          return this.validateOllama();
        default:
          this.logger.warn(`Unsupported provider: ${provider}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Validation error for ${provider}: ${error.message}`);
      return false;
    }
  }

  private async validateOpenAI(apiKey: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 5000,
        }),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.debug(`OpenAI validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateAnthropic(apiKey: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      if (error.response?.status === 400) {
        return true;
      }
      this.logger.debug(`Anthropic validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateGoogle(apiKey: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
          {
            timeout: 5000,
          },
        ),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.debug(`Google validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateAzure(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.length < 10) {
      return false;
    }
    return true;
  }

  private validateOllama(): boolean {
    return true;
  }
}
