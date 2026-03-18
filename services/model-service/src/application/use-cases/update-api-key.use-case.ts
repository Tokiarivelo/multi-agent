import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyResponse, UpdateApiKeyInput } from '../../domain/entities/api-key.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
import { ProviderValidatorService } from '../../infrastructure/services/provider-validator.service';

@Injectable()
export class UpdateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly encryptionService: EncryptionService,
    private readonly providerValidator: ProviderValidatorService,
  ) {}

  async execute(id: string, input: UpdateApiKeyInput): Promise<ApiKeyResponse> {
    const existingKey = await this.apiKeyRepository.findById(id);
    if (!existingKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }

    const payload = { ...input };

    if (input.apiKey) {
      const isValid = await this.providerValidator.validateApiKey(
        existingKey.provider,
        input.apiKey,
      );

      if (!isValid) {
        throw new BadRequestException(
          `Invalid API key for provider '${existingKey.provider}'`,
        );
      }

      payload.encryptedKey = this.encryptionService.encrypt(input.apiKey);
      payload.keyPrefix = this.extractKeyPrefix(input.apiKey);
      delete payload.apiKey;
    }

    const updatedKey = await this.apiKeyRepository.update(id, payload);
    return this.sanitizeApiKey(updatedKey);
  }

  private extractKeyPrefix(apiKey: string): string {
    if (apiKey.length < 10) return '***';
    return `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  private sanitizeApiKey(apiKey: any): ApiKeyResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...sanitized } = apiKey;
    return sanitized as ApiKeyResponse;
  }
}
