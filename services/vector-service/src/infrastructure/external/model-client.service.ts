import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmbeddingProvider = 'OPENAI' | 'GOOGLE' | 'OLLAMA' | 'AZURE' | 'CUSTOM' | 'NONE';

export interface EmbeddingModelConfig {
  provider: EmbeddingProvider;
  /** The provider-specific model identifier (e.g. "text-embedding-3-small") */
  modelId: string;
  /** Decrypted API key — may be empty for Ollama/CUSTOM without auth */
  apiKey: string;
  /** Override base URL (Ollama, Azure, CUSTOM providers) */
  baseUrl?: string;
  /** Expected output dimension for this model */
  dimension: number;
}

/**
 * Known embedding models with their output dimensions.
 * Used as fallback when dimension is not stored on the collection.
 */
const KNOWN_DIMENSIONS: Record<string, number> = {
  // OpenAI
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  // Google
  'text-embedding-004': 768,
  'embedding-001': 768,
  // Cohere
  'embed-english-v3.0': 1024,
  'embed-multilingual-v3.0': 1024,
};

@Injectable()
export class ModelClientService {
  private readonly logger = new Logger(ModelClientService.name);
  private readonly modelServiceUrl: string;
  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.modelServiceUrl = this.config.get<string>('MODEL_SERVICE_URL', 'http://localhost:3001');
    this.internalSecret = this.config.get<string>(
      'INTERNAL_SECRET',
      'fallback_internal_secret_for_dev_mode',
    );
  }

  /**
   * Resolve the full embedding config for a collection.
   * - If `embeddingModelId` is set on the collection, fetch from model-service.
   * - Falls back to the OPENAI env defaults.
   */
  async resolveEmbeddingConfig(
    embeddingModelId: string | null,
    apiKeyId: string | null,
    fallbackDimension: number,
  ): Promise<EmbeddingModelConfig> {
    let modelIdToFetch = embeddingModelId;

    if (!modelIdToFetch) {
      try {
        const resList = await fetch(`${this.modelServiceUrl}/api/models?pageSize=50`);
        if (resList.ok) {
          const pb = await resList.json();
          const items = pb.data || [];
          const defaultModel = items.find((m: any) => m.modelId?.includes('embed') || m.isDefault) || items[0];
          if (defaultModel) {
            modelIdToFetch = defaultModel.id;
            this.logger.log(`No embeddingModelId provided, auto-selected model: ${modelIdToFetch}`);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-select model from model-service: ${err}`);
      }
    }

    if (!modelIdToFetch) {
      // Very last resort: fallback to NONE to permit text-only storage without vector generation
      this.logger.log(`No models found in system at all. Falling back to NONE provider to permit purely text-based indexing without embeddings.`);
      return {
        provider: 'NONE',
        modelId: 'dummy-none-model',
        apiKey: '',
        dimension: fallbackDimension,
      };
    }

    // ── Fetch model record ────────────────────────────────────────────────
    let model: { provider: string; modelId?: string; modelName?: string; baseUrl?: string } | null = null;
    try {
      const res = await fetch(`${this.modelServiceUrl}/api/models/${modelIdToFetch}`);
      if (!res.ok) throw new Error(`model-service returned ${res.status}`);
      model = await res.json();
    } catch (err) {
      this.logger.error(`Failed to fetch model ${modelIdToFetch}: ${err}. Falling back to NONE provider.`);
      return {
        provider: 'NONE',
        modelId: 'dummy-none-model',
        apiKey: '',
        dimension: fallbackDimension,
      };
    }

    if (!model) {
      return {
        provider: 'NONE',
        modelId: 'dummy-none-model',
        apiKey: '',
        dimension: fallbackDimension,
      };
    }

    const providerModelId: string = model.modelId ?? model.modelName ?? '';
    const dimension = KNOWN_DIMENSIONS[providerModelId] ?? fallbackDimension;

    // ── Decrypt API key ───────────────────────────────────────────────────
    let apiKey = '';
    if (apiKeyId) {
      try {
        const keyRes = await fetch(`${this.modelServiceUrl}/api-keys/${apiKeyId}/decrypt`, {
          headers: { 'x-internal-secret': this.internalSecret },
        });
        if (keyRes.ok) {
          const keyData = (await keyRes.json()) as { key: string };
          apiKey = keyData.key;
        } else {
          this.logger.warn(`Could not decrypt apiKey ${apiKeyId} (${keyRes.status})`);
        }
      } catch (err) {
        this.logger.warn(`API key decrypt failed: ${err}`);
      }
    }

    return {
      provider: model.provider as EmbeddingProvider,
      modelId: providerModelId,
      apiKey,
      baseUrl: model.baseUrl,
      dimension,
    };
  }

  /** List all API keys for a user (metadata only, no decrypted key) */
  async listApiKeys(userId: string, provider?: string): Promise<unknown[]> {
    const url = new URL(`${this.modelServiceUrl}/api-keys`);
    url.searchParams.set('userId', userId);
    if (provider) url.searchParams.set('provider', provider);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = (await res.json()) as unknown[];
    return data;
  }
}
