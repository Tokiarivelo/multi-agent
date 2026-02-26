import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyResponse } from '../../domain/entities/api-key.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

@Injectable()
export class GetApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly encryptionService: EncryptionService,
  ) {}

  async execute(id: string): Promise<ApiKeyResponse> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }

    return this.sanitizeApiKey(apiKey);
  }

  async getDecryptedKey(id: string): Promise<string> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }

    await this.apiKeyRepository.updateUsage(id);

    return this.encryptionService.decrypt(apiKey.encryptedKey);
  }

  private sanitizeApiKey(apiKey: any): ApiKeyResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...sanitized } = apiKey;
    return sanitized as ApiKeyResponse;
  }
}
