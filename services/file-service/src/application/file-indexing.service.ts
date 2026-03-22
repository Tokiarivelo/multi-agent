import { Injectable, Logger, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { MinioService } from '../infrastructure/minio/minio.service';
import { VectorClientService } from '../infrastructure/http/vector-client.service';
import { ModelClientService } from '../infrastructure/http/model-client.service';
import { FILE_REPOSITORY, FileRecord, IFileRepository } from '../domain/file.entity';

export type IndexStatus = 'idle' | 'indexing' | 'indexed' | 'error';

export interface IndexEntry {
  fileId: string;
  status: IndexStatus;
  collectionId: string | null;
  chunkCount: number;
  indexedAt: Date | null;
  error: string | null;
}

const INDEXABLE_MIME_PREFIXES = [
  'text/',
  'application/json',
  'application/xml',
  'application/yaml',
];
const CHUNK_SIZE = 1800; // characters (~450 tokens) per chunk
const CHUNK_OVERLAP = 200; // characters overlap between consecutive chunks

@Injectable()
export class FileIndexingService {
  private readonly logger = new Logger(FileIndexingService.name);

  constructor(
    private readonly minio: MinioService,
    private readonly vectorClient: VectorClientService,
    private readonly modelClient: ModelClientService,
    @Inject(FILE_REPOSITORY) private readonly fileRepo: IFileRepository,
  ) {}

  async getStatus(fileId: string): Promise<IndexEntry | null> {
    const file = await this.fileRepo.findById(fileId);
    if (!file || !file.indexingStatus) return null;
    return {
      fileId,
      status: file.indexingStatus.status,
      collectionId: file.indexingStatus.collectionId || null,
      chunkCount: file.indexingStatus.chunkCount || 0,
      indexedAt: file.indexingStatus.indexedAt,
      error: file.indexingStatus.error || null,
    };
  }

  /**
   * Kick off async indexing without blocking the HTTP response.
   */
  async indexFile(
    fileId: string,
    userId: string,
    embeddingModelId?: string,
    apiKeyId?: string,
    useSummarization?: boolean,
    summarizationModelId?: string,
    summarizationApiKeyId?: string,
  ): Promise<void> {
    await this.fileRepo.updateIndexingStatus(fileId, {
      status: 'indexing',
      fileId,
      indexedAt: null,
      error: undefined,
    });

    this.runIndexing(
      fileId,
      userId,
      embeddingModelId,
      apiKeyId,
      useSummarization,
      summarizationModelId,
      summarizationApiKeyId,
    ).catch(async (err) => {
      this.logger.error(`Indexing failed for ${fileId}: ${err.message}`, err.stack);
      await this.fileRepo.updateIndexingStatus(fileId, {
        status: 'error',
        error: err.message,
      });
    });
  }

  private async runIndexing(
    fileId: string,
    userId: string,
    embeddingModelId?: string,
    apiKeyId?: string,
    useSummarization?: boolean,
    summarizationModelId?: string,
    summarizationApiKeyId?: string,
  ): Promise<void> {
    const file = await this.fileRepo.findById(fileId);
    if (!file) throw new NotFoundException(`File ${fileId} not found`);
    if (file.userId !== userId) throw new ForbiddenException('Access denied');

    if (!this.isIndexable(file)) {
      this.logger.warn(`File ${fileId} (${file.mimeType}) is not indexable as text — skipping`);
      await this.fileRepo.updateIndexingStatus(fileId, {
        status: 'idle',
        error: 'File type not supported for indexing',
      });
      return;
    }

    try {
      // Read content from MinIO
      const buffer = await this.minio.getObject(file.key);
      const text = buffer.toString('utf-8');

      const configHash = `embed:${embeddingModelId || 'none'}::sum:${useSummarization ? summarizationModelId : 'off'}`;
      const contentHash = crypto.createHash('sha256').update(text).update(configHash).digest('hex');

      if (file.indexingStatus?.contentHash === contentHash) {
        this.logger.log(
          `Skipping indexing for ${file.originalName}, identical content already indexed.`,
        );
        await this.fileRepo.updateIndexingStatus(fileId, {
          status: 'indexed',
          indexedAt: new Date(),
        });
        return;
      }

      // Chunk text with overlap
      let chunks = this.chunkText(text);
      this.logger.log(`File ${fileId}: ${chunks.length} chunks from ${text.length} chars`);

      if (useSummarization && summarizationModelId) {
        this.logger.log(
          `Using summarization for indexing file ${fileId} with model ${summarizationModelId}`,
        );
        const llmConfig = await this.modelClient.resolveLlmConfig(
          summarizationModelId,
          summarizationApiKeyId ?? null,
        );
        if (llmConfig) {
          // Process summaries sequentially or in tiny batches to avoid rate limits
          const summarizedChunks: string[] = [];
          for (const chunk of chunks) {
            const summary = await this.modelClient.summarizeChunk(chunk, llmConfig);
            summarizedChunks.push(summary);
          }
          chunks = summarizedChunks;
        } else {
          this.logger.warn(
            `Could not resolve LLM config for ${summarizationModelId}, indexing raw text instead.`,
          );
        }
      }

      // Ensure collection exists (pass model/key so they're bound on first creation)
      const collectionId = await this.vectorClient.ensureWorkspaceCollection(
        userId,
        embeddingModelId,
        apiKeyId,
      );

      // Upsert chunks — use deterministic UUIDs so re-indexing overwrites old points and Qdrant accepts it
      const vectorChunks = chunks.map((chunk, i) => {
        // Create a deterministic UUID by replacing the last section of the file's UUID
        const chunkSuffix = i.toString(16).padStart(12, '0');
        const pointId = fileId.length === 36 ? fileId.slice(0, 24) + chunkSuffix : undefined;

        return {
          documentId: pointId,
          content: chunk,
          metadata: {
            fileId,
            fileName: file.originalName,
            mimeType: file.mimeType,
            chunkIndex: i,
            chunkCount: chunks.length,
            userId,
            isSummarized: !!useSummarization,
          },
        };
      });

      await this.vectorClient.upsertFileChunks(collectionId, fileId, vectorChunks);

      await this.fileRepo.updateIndexingStatus(fileId, {
        status: 'indexed',
        collectionId,
        chunkCount: chunks.length,
        indexedAt: new Date(),
        contentHash,
      });

      this.logger.log(`File ${fileId} indexed successfully (${chunks.length} chunks)`);
    } catch (err) {
      this.logger.error(`Error in runIndexing for ${fileId}: ${err.message}`);
      throw err;
    }
  }

  async removeIndex(fileId: string): Promise<void> {
    await this.fileRepo.updateIndexingStatus(fileId, {
      status: 'idle',
      indexedAt: null,
      error: undefined,
    });
  }

  /** Chunk text into overlapping windows. */
  private chunkText(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= CHUNK_SIZE) return [normalized];

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + CHUNK_SIZE, normalized.length);
      // Prefer breaking at a newline or sentence boundary within the last 200 chars
      let breakAt = end;
      if (end < normalized.length) {
        const window = normalized.slice(Math.max(start, end - 200), end);
        const nlIdx = window.lastIndexOf('\n');
        const periodIdx = window.lastIndexOf('. ');
        const best = Math.max(nlIdx, periodIdx);
        if (best > 0) breakAt = Math.max(start, end - 200) + best + 1;
      }
      chunks.push(normalized.slice(start, breakAt).trim());
      if (breakAt >= normalized.length) break;
      start = breakAt - CHUNK_OVERLAP;
    }
    return chunks.filter((c) => c.length > 0);
  }

  private isIndexable(file: FileRecord): boolean {
    return INDEXABLE_MIME_PREFIXES.some((prefix) => file.mimeType.startsWith(prefix));
  }

  /** Return collectionId for a user so callers can run searches. */
  async getOrEnsureCollectionId(userId: string): Promise<string> {
    return this.vectorClient.ensureWorkspaceCollection(userId);
  }

  async searchFiles(userId: string, query: string, limit = 5, fileId?: string): Promise<unknown[]> {
    const collectionId = await this.vectorClient.ensureWorkspaceCollection(userId);
    return this.vectorClient.searchFiles(collectionId, query, limit, fileId);
  }
}
