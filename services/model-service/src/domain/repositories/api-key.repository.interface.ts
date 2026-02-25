import {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
  ModelProvider,
} from '../entities/api-key.entity';

export interface ApiKeyRepositoryInterface {
  create(input: CreateApiKeyInput, encryptedKey: string, keyPrefix?: string): Promise<ApiKey>;
  findById(id: string): Promise<ApiKey | null>;
  findByUserId(userId: string, filters?: ApiKeyFilters): Promise<ApiKey[]>;
  findByUserAndProvider(userId: string, provider: ModelProvider): Promise<ApiKey[]>;
  update(id: string, input: UpdateApiKeyInput): Promise<ApiKey>;
  delete(id: string): Promise<void>;
  getDecryptedKey(id: string): Promise<string>;
  updateUsage(id: string): Promise<void>;
  validateKeyExists(userId: string, provider: ModelProvider, keyName: string): Promise<boolean>;
}

export interface ApiKeyFilters {
  provider?: ModelProvider;
  isActive?: boolean;
  isValid?: boolean;
}
