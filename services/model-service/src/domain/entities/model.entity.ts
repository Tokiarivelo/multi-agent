// Re-export Prisma's ModelProvider as the single source of truth
// Values are defined in packages/database/prisma/schema.prisma
import { ModelProvider } from '@multi-agent/database';
export { ModelProvider };

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  description?: string;

  // Configuration
  maxTokens: number;
  supportsStreaming: boolean;
  defaultTemperature?: number;

  // Rate limiting
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;

  // Cost tracking
  inputCostPer1kTokens?: number;
  outputCostPer1kTokens?: number;

  // Provider-specific settings
  providerSettings?: Record<string, any>;

  // Metadata
  isActive: boolean;
  isDefault: boolean;
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModelInput {
  name: string;
  provider: ModelProvider;
  modelId: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  defaultTemperature?: number;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  inputCostPer1kTokens?: number;
  outputCostPer1kTokens?: number;
  providerSettings?: Record<string, any>;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateModelInput {
  name?: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  defaultTemperature?: number;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  inputCostPer1kTokens?: number;
  outputCostPer1kTokens?: number;
  providerSettings?: Record<string, any>;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}
