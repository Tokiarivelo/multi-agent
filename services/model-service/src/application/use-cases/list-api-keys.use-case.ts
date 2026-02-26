import { Injectable } from '@nestjs/common';
import { ApiKeyRepositoryInterface, ApiKeyFilters } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyResponse, ModelProvider } from '../../domain/entities/api-key.entity';

@Injectable()
export class ListApiKeysUseCase {
  constructor(private readonly apiKeyRepository: ApiKeyRepositoryInterface) {}

  async execute(userId: string, filters?: ApiKeyFilters): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.apiKeyRepository.findByUserId(userId, filters);
    return apiKeys.map(key => this.sanitizeApiKey(key));
  }

  async getByProvider(userId: string, provider: ModelProvider): Promise<ApiKeyResponse[]> {
    const apiKeys = await this.apiKeyRepository.findByUserAndProvider(userId, provider);
    return apiKeys.map(key => this.sanitizeApiKey(key));
  }

  private sanitizeApiKey(apiKey: any): ApiKeyResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...sanitized } = apiKey;
    return sanitized as ApiKeyResponse;
  }
}
