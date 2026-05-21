import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';
import { EmbeddingService } from '../../domain/services/embedding.service';
import { ModelClientService } from '../../infrastructure/external/model-client.service';
import { UpsertDocumentDto, UpsertDocumentsDto } from '../dto/upsert-document.dto';
import { Document } from '../../domain/entities/document.entity';
import { v4 as uuidv4, v5 as uuidv5, validate as uuidValidate } from 'uuid';

const POINT_ID_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

/**
 * Qdrant only accepts UUIDs or unsigned integers as point IDs.
 * If the caller passes an unresolved template string or any other non-UUID,
 * derive a deterministic UUID v5 so the ID is still stable across calls.
 */
function toQdrantPointId(raw: string): string {
  if (uuidValidate(raw)) return raw;
  if (/^\d+$/.test(raw)) return raw;
  return uuidv5(raw, POINT_ID_NAMESPACE);
}

@Injectable()
export class UpsertDocumentUseCase {
  private readonly logger = new Logger(UpsertDocumentUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
    private readonly embeddingService: EmbeddingService,
    private readonly modelClient: ModelClientService,
  ) {}

  async execute(dto: UpsertDocumentDto): Promise<{ documentId: string }> {
    this.logger.log(`Upserting document to collection: ${dto.collectionId}`);

    let collection = await this.vectorRepository.findCollectionById(dto.collectionId);
    if (!collection && dto.userId) {
      collection = await this.vectorRepository.findCollectionByNameAndUserId(dto.collectionId, dto.userId);
    }
    if (!collection) {
      throw new NotFoundException(`Collection '${dto.collectionId}' not found`);
    }

    let embedding = dto.embedding;
    if (!embedding) {
      const embeddingConfig = await this.modelClient
        .resolveEmbeddingConfig(collection.embeddingModelId, collection.apiKeyId, collection.dimension)
        .catch((err) => {
          this.logger.warn(`Failed to resolve embedding config: ${err.message}. Using fallback.`);
          return {
            provider: 'NONE' as const,
            modelId: 'fallback',
            apiKey: '',
            dimension: collection.dimension,
          };
        });
      embedding = await this.embeddingService.generateEmbedding(dto.content, embeddingConfig);
    }

    if (embedding.length !== collection.dimension) {
      throw new BadRequestException(
        `Embedding dimension ${embedding.length} does not match collection dimension ${collection.dimension}`,
      );
    }

    const document = Document.create(
      dto.collectionId,
      dto.content,
      embedding,
      dto.metadata || {},
    );

    const rawId = dto.documentId || dto.id;
    const documentId = rawId ? toQdrantPointId(rawId) : uuidv4();
    const point = document.toQdrantPoint(documentId);

    const qdrantCollectionName = collection.getQdrantCollectionName();
    
    // Auto-repair if collection is missing in Qdrant but persists in database
    const qdrantExists = await this.qdrantClient.collectionExists(qdrantCollectionName);
    if (!qdrantExists) {
      this.logger.warn(`Collection ${qdrantCollectionName} missing in Qdrant. Re-creating...`);
      const distanceMap = { 
        cosine: 'Cosine' as const, 
        euclidean: 'Euclid' as const, 
        dot: 'Dot' as const 
      };
      await this.qdrantClient.createCollection(
        qdrantCollectionName,
        collection.dimension,
        distanceMap[collection.distance] || 'Cosine'
      );
    }

    await this.qdrantClient.upsertPoints(qdrantCollectionName, [point]);

    this.logger.log(`Document upserted successfully: ${documentId}`);
    return { documentId };
  }

  async executeBatch(dto: UpsertDocumentsDto): Promise<{ documentIds: string[] }> {
    this.logger.log(
      `Batch upserting ${dto.documents.length} documents to collection: ${dto.collectionId}`,
    );

    let collection = await this.vectorRepository.findCollectionById(dto.collectionId);
    if (!collection && dto.userId) {
      collection = await this.vectorRepository.findCollectionByNameAndUserId(dto.collectionId, dto.userId);
    }
    if (!collection) {
      throw new NotFoundException(`Collection '${dto.collectionId}' not found`);
    }

    // Separate documents that already have embeddings from those that need generation
    const needEmbedding = dto.documents.filter((d) => !d.embedding);
    const textsToEmbed = needEmbedding.map((d) => d.content);

    let generatedEmbeddings: number[][] = [];
    if (textsToEmbed.length > 0) {
      const embeddingConfig = await this.modelClient
        .resolveEmbeddingConfig(collection.embeddingModelId, collection.apiKeyId, collection.dimension)
        .catch((err) => {
          this.logger.warn(`Failed to resolve embedding config for batch: ${err.message}. Using fallback.`);
          return {
            provider: 'NONE' as const,
            modelId: 'fallback',
            apiKey: '',
            dimension: collection.dimension,
          };
        });
      generatedEmbeddings = await this.embeddingService.generateEmbeddings(
        textsToEmbed,
        embeddingConfig,
      );
    }

    const documentIds: string[] = [];
    const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
    let genIdx = 0;

    for (const doc of dto.documents) {
      const embedding = doc.embedding ?? generatedEmbeddings[genIdx++];

      if (embedding.length !== collection.dimension) {
        throw new BadRequestException(
          `Embedding dimension ${embedding.length} does not match collection dimension ${collection.dimension}`,
        );
      }

      const document = Document.create(
        dto.collectionId,
        doc.content,
        embedding,
        doc.metadata || {},
      );

      const rawDocId = doc.documentId || (doc as any).id;
      const documentId = rawDocId ? toQdrantPointId(rawDocId) : uuidv4();
      documentIds.push(documentId);
      points.push(document.toQdrantPoint(documentId));
    }

    const qdrantCollectionName = collection.getQdrantCollectionName();
    
    // Auto-repair if collection is missing in Qdrant but persists in database
    const qdrantExists = await this.qdrantClient.collectionExists(qdrantCollectionName);
    if (!qdrantExists) {
      this.logger.warn(`Collection ${qdrantCollectionName} missing in Qdrant. Re-creating...`);
      const distanceMap = { 
        cosine: 'Cosine' as const, 
        euclidean: 'Euclid' as const, 
        dot: 'Dot' as const 
      };
      await this.qdrantClient.createCollection(
        qdrantCollectionName,
        collection.dimension,
        distanceMap[collection.distance] || 'Cosine'
      );
    }

    await this.qdrantClient.upsertPoints(qdrantCollectionName, points);

    this.logger.log(`Batch upsert completed: ${documentIds.length} documents`);
    return { documentIds };
  }
}
