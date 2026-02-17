import { ModelProvider } from './model.entity';

export { ModelProvider };

export interface ApiKey {
  id: string;
  userId: string;
  provider: ModelProvider;
  keyName: string;
  
  // Encrypted key (never exposed in API responses)
  encryptedKey: string;
  
  // Key metadata
  keyPrefix?: string;
  lastUsedAt?: Date;
  usageCount: number;
  
  // Status
  isActive: boolean;
  isValid: boolean;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyInput {
  userId: string;
  provider: ModelProvider;
  keyName: string;
  apiKey: string; // Plain text key to be encrypted
  metadata?: Record<string, any>;
}

export interface UpdateApiKeyInput {
  keyName?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface ApiKeyResponse {
  id: string;
  userId: string;
  provider: ModelProvider;
  keyName: string;
  keyPrefix?: string;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  isValid: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
