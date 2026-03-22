import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VectorCollection {
  id: string;
  name: string;
  userId: string;
  dimension: number;
}

export interface VectorChunk {
  content: string;
  metadata: Record<string, unknown>;
  documentId?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class VectorClientService {
  private readonly logger = new Logger(VectorClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('VECTOR_SERVICE_URL', 'http://localhost:3007');
  }

  /**
   * Ensure a collection exists for the user's workspace files. Returns its id.
   * Pass `embeddingModelId` and `apiKeyId` to bind a specific model on first creation.
   * If the collection already exists its model config is NOT changed here.
   */
  async ensureWorkspaceCollection(
    userId: string,
    embeddingModelId?: string,
    apiKeyId?: string,
  ): Promise<string> {
    const collectionName = 'workspace_files';
    const listRes = await fetch(
      `${this.baseUrl}/api/vectors/collections?userId=${userId}&pageSize=100`,
    );
    if (!listRes.ok) {
      const body = await listRes.text();
      throw new Error(`Vector list collection failed (${listRes.status}): ${body}`);
    }
    const list = (await listRes.json()) as { data: VectorCollection[] };
    const existing = list.data.find((c) => c.name === collectionName);
    if (existing) return existing.id;

    this.logger.log(`Creating workspace_files collection for user ${userId}`);
    const createRes = await fetch(`${this.baseUrl}/api/vectors/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: collectionName,
        userId,
        dimension: 1536,
        distance: 'cosine',
        embeddingModelId: embeddingModelId ?? undefined,
        apiKeyId: apiKeyId ?? undefined,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Vector create collection failed (${createRes.status}): ${body}`);
    }
    const collection = (await createRes.json()) as VectorCollection;
    return collection.id;
  }

  /** Batch upsert chunks for a file. documentId is derived from fileId + chunkIndex. */
  async upsertFileChunks(
    collectionId: string,
    fileId: string,
    chunks: VectorChunk[],
  ): Promise<void> {
    if (chunks.length === 0) return;
    const documents = chunks.map((c) => ({
      documentId: c.documentId,
      content: c.content,
      metadata: c.metadata,
    }));
    const res = await fetch(`${this.baseUrl}/api/vectors/documents/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, documents }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vector upsert failed (${res.status}): ${body}`);
    }
    this.logger.log(`Upserted ${chunks.length} chunks for file ${fileId}`);
  }

  /** Search workspace files by query text. Optionally filter by fileId. */
  async searchFiles(
    collectionId: string,
    query: string,
    limit = 5,
    fileId?: string,
  ): Promise<VectorSearchResult[]> {
    const filter = fileId ? { fileId } : undefined;
    const res = await fetch(`${this.baseUrl}/api/vectors/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, query, limit, filter }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vector search failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { results: VectorSearchResult[] };
    return data.results;
  }
}
