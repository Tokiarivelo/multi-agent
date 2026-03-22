import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  EmbeddingModelConfig,
  EmbeddingProvider,
} from '../../infrastructure/external/model-client.service';

export const EMBEDDING_DIMENSION = 1536; // default (text-embedding-3-small)

// ── Per-provider generators ───────────────────────────────────────────────────

async function embedOpenAI(
  texts: string[],
  modelId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<number[][]> {
  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  const inputs = texts.map((t) => t.replace(/\n/g, ' ').slice(0, 8191));
  const res = await client.embeddings.create({ model: modelId, input: inputs });
  return res.data.map((d: OpenAI.Embeddings.Embedding) => d.embedding);
}

async function embedAzureOpenAI(
  texts: string[],
  modelId: string,
  apiKey: string,
  baseUrl: string,
): Promise<number[][]> {
  // Azure OpenAI uses the same SDK with a different baseURL and api-version
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: { 'api-key': apiKey },
  });
  const inputs = texts.map((t) => t.replace(/\n/g, ' ').slice(0, 8191));
  const res = await client.embeddings.create({ model: modelId, input: inputs });
  return res.data.map((d: OpenAI.Embeddings.Embedding) => d.embedding);
}

async function embedGoogle(texts: string[], modelId: string, apiKey: string): Promise<number[][]> {
  // Google Generative Language API — embeddings endpoint
  const model = modelId || 'text-embedding-004';
  const results: number[][] = [];
  for (const text of texts) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
      },
    );
    if (!res.ok) throw new Error(`Google embedding error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { embedding: { values: number[] } };
    results.push(data.embedding.values);
  }
  return results;
}

async function embedOllama(texts: string[], modelId: string, baseUrl: string): Promise<number[][]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/embed`;
  const results: number[][] = [];
  for (const text of texts) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, input: text }),
    });
    if (!res.ok) throw new Error(`Ollama embedding error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { embeddings: number[][] };
    results.push(data.embeddings[0]);
  }
  return results;
}

// ── EmbeddingService ──────────────────────────────────────────────────────────

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // Cached default config (env-based, used when a collection has no embeddingModelId)
  private readonly defaultConfig: EmbeddingModelConfig;

  constructor(private readonly configService: ConfigService) {
    this.defaultConfig = {
      provider: 'OPENAI',
      modelId: this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
      apiKey: this.configService.get<string>('OPENAI_API_KEY', ''),
      dimension: EMBEDDING_DIMENSION,
    };
  }

  /** Generate a single embedding using the collection's configured model (or env default). */
  async generateEmbedding(text: string, config?: EmbeddingModelConfig): Promise<number[]> {
    const [embedding] = await this.generateEmbeddings([text], config);
    return embedding;
  }

  /** Generate embeddings for multiple texts using the collection's configured model. */
  async generateEmbeddings(texts: string[], config?: EmbeddingModelConfig): Promise<number[][]> {
    if (texts.length === 0) return [];
    const cfg = config ?? this.defaultConfig;

    this.logger.debug(
      `Generating ${texts.length} embedding(s) via ${cfg.provider} / ${cfg.modelId}`,
    );

    return this.dispatchToProvider(texts, cfg);
  }

  private async dispatchToProvider(
    texts: string[],
    cfg: EmbeddingModelConfig,
  ): Promise<number[][]> {
    const p = cfg.provider.toUpperCase() as EmbeddingProvider;
    switch (p) {
      case 'OPENAI':
        return embedOpenAI(texts, cfg.modelId, cfg.apiKey, cfg.baseUrl);

      case 'AZURE':
        if (!cfg.baseUrl) throw new Error('AZURE provider requires baseUrl');
        return embedAzureOpenAI(texts, cfg.modelId, cfg.apiKey, cfg.baseUrl);

      case 'GOOGLE':
        return embedGoogle(texts, cfg.modelId, cfg.apiKey);

      case 'OLLAMA':
      case 'CUSTOM':
        if (!cfg.baseUrl) {
          throw new Error(`${p} provider requires baseUrl`);
        }
        return embedOllama(texts, cfg.modelId, cfg.baseUrl);

      case 'NONE':
        this.logger.debug(`Bypassing embedding generation (NONE provider), returning dummy valid vectors`);
        return texts.map(() => {
          const vec = new Array(cfg.dimension).fill(0);
          vec[0] = 1.0; // Needs non-zero magnitude for Qdrant COSINE distance calculations
          return vec;
        });

      default:
        this.logger.debug(`Bypassing embedding generation (default provider), returning dummy valid vectors`);
        return texts.map(() => {
          const vec = new Array(cfg.dimension).fill(0);
          vec[0] = 1.0;
          return vec;
        });
    }
  }
}
