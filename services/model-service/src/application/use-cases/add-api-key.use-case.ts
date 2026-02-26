import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { ApiKeyResponse, CreateApiKeyInput } from '../../domain/entities/api-key.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
import { ProviderValidatorService } from '../../infrastructure/services/provider-validator.service';

@Injectable()
export class AddApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly encryptionService: EncryptionService,
    private readonly providerValidator: ProviderValidatorService,
  ) {}

  async execute(input: CreateApiKeyInput): Promise<ApiKeyResponse> {
    const keyExists = await this.apiKeyRepository.validateKeyExists(
      input.userId,
      input.provider,
      input.keyName,
    );

    if (keyExists) {
      throw new ConflictException(
        `API key with name '${input.keyName}' already exists for provider '${input.provider}'`,
      );
    }

    const isValid = await this.providerValidator.validateApiKey(
      input.provider,
      input.apiKey,
    );

    if (!isValid) {
      throw new BadRequestException(
        `Invalid API key for provider '${input.provider}'`,
      );
    }

    const encryptedKey = this.encryptionService.encrypt(input.apiKey);

    const keyPrefix = this.extractKeyPrefix(input.apiKey);

    const apiKey = await this.apiKeyRepository.create(
      input,
      encryptedKey,
      keyPrefix,
    );

    return this.sanitizeApiKey(apiKey);
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
