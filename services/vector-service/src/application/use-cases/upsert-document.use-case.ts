import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';
import { EmbeddingService } from '../../domain/services/embedding.service';
import { UpsertDocumentDto, UpsertDocumentsDto } from '../dto/upsert-document.dto';
import { Document } from '../../domain/entities/document.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UpsertDocumentUseCase {
  private readonly logger = new Logger(UpsertDocumentUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(dto: UpsertDocumentDto): Promise<{ documentId: string }> {
    this.logger.log(`Upserting document to collection: ${dto.collectionId}`);

    // Get collection
    const collection = await this.vectorRepository.findCollectionById(dto.collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection '${dto.collectionId}' not found`);
    }

    // Generate embedding if not provided
    let embedding = dto.embedding;
    if (!embedding) {
      embedding = await this.embeddingService.generateEmbedding(dto.content);
    }

    // Validate embedding dimension
    if (embedding.length !== collection.dimension) {
      throw new BadRequestException(
        `Embedding dimension ${embedding.length} does not match collection dimension ${collection.dimension}`,
      );
    }

    // Create document
    const document = Document.create(
      dto.collectionId,
      dto.content,
      embedding,
      dto.metadata || {},
    );

    const documentId = dto.documentId || uuidv4();
    const point = document.toQdrantPoint(documentId);

    // Upsert to Qdrant
    const qdrantCollectionName = collection.getQdrantCollectionName();
    await this.qdrantClient.upsertPoints(qdrantCollectionName, [point]);

    this.logger.log(`Document upserted successfully: ${documentId}`);
    return { documentId };
  }

  async executeBatch(dto: UpsertDocumentsDto): Promise<{ documentIds: string[] }> {
    this.logger.log(`Batch upserting ${dto.documents.length} documents to collection: ${dto.collectionId}`);

    // Get collection
    const collection = await this.vectorRepository.findCollectionById(dto.collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection '${dto.collectionId}' not found`);
    }

    const documentIds: string[] = [];
    const points: Array<{ id: string; vector: number[]; payload: Record<string, any> }> = [];

    for (const doc of dto.documents) {
      // Generate embedding if not provided
      let embedding = doc.embedding;
      if (!embedding) {
        embedding = await this.embeddingService.generateEmbedding(doc.content);
      }

      // Validate embedding dimension
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

      const documentId = doc.documentId || uuidv4();
      documentIds.push(documentId);
      points.push(document.toQdrantPoint(documentId));
    }

    // Batch upsert to Qdrant
    const qdrantCollectionName = collection.getQdrantCollectionName();
    await this.qdrantClient.upsertPoints(qdrantCollectionName, points);

    this.logger.log(`Batch upsert completed: ${documentIds.length} documents`);
    return { documentIds };
  }
}
