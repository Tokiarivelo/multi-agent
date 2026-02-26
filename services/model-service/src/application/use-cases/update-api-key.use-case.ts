import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyResponse, UpdateApiKeyInput } from '../../domain/entities/api-key.entity';

@Injectable()
export class UpdateApiKeyUseCase {
  constructor(private readonly apiKeyRepository: ApiKeyRepositoryInterface) {}

  async execute(id: string, input: UpdateApiKeyInput): Promise<ApiKeyResponse> {
    const existingKey = await this.apiKeyRepository.findById(id);
    if (!existingKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }

    const updatedKey = await this.apiKeyRepository.update(id, input);
    return this.sanitizeApiKey(updatedKey);
  }

  private sanitizeApiKey(apiKey: any): ApiKeyResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...sanitized } = apiKey;
    return sanitized as ApiKeyResponse;
  }
}
