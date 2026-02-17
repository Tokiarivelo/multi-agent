import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { IQdrantClient } from '../../application/interfaces/qdrant.client.interface';

@Injectable()
export class QdrantClientService implements IQdrantClient, OnModuleInit {
  private readonly logger = new Logger(QdrantClientService.name);
  private client!: QdrantClient;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('QDRANT_URL', 'http://qdrant:6333');
    this.logger.log(`Connecting to Qdrant at ${url}`);
    
    this.client = new QdrantClient({
      url,
    });

    try {
      // Test connection
      await this.client.getCollections();
      this.logger.log('Successfully connected to Qdrant');
    } catch (error) {
      this.logger.error('Failed to connect to Qdrant', error);
      throw error;
    }
  }

  async createCollection(
    name: string,
    dimension: number,
    distance: 'Cosine' | 'Euclid' | 'Dot',
  ): Promise<void> {
    this.logger.log(`Creating Qdrant collection: ${name}`);
    
    await this.client.createCollection(name, {
      vectors: {
        size: dimension,
        distance,
      },
    });
  }

  async deleteCollection(name: string): Promise<void> {
    this.logger.log(`Deleting Qdrant collection: ${name}`);
    await this.client.deleteCollection(name);
  }

  async upsertPoints(
    collectionName: string,
    points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>,
  ): Promise<void> {
    this.logger.log(`Upserting ${points.length} points to collection: ${collectionName}`);
    
    await this.client.upsert(collectionName, {
      wait: true,
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  async search(
    collectionName: string,
    vector: number[],
    limit: number,
    filter?: Record<string, any>,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, any> }>> {
    this.logger.log(`Searching in collection: ${collectionName} with limit: ${limit}`);
    
    const results = await this.client.search(collectionName, {
      vector,
      limit,
      filter: filter ? this.buildQdrantFilter(filter) : undefined,
      with_payload: true,
    });

    return results.map(result => ({
      id: result.id as string,
      score: result.score,
      payload: result.payload as Record<string, any>,
    }));
  }

  async collectionExists(name: string): Promise<boolean> {
    try {
      await this.client.getCollection(name);
      return true;
    } catch (error) {
      return false;
    }
  }

  async listCollections(): Promise<string[]> {
    const response = await this.client.getCollections();
    return response.collections.map(c => c.name);
  }

  private buildQdrantFilter(filter: Record<string, any>): any {
    // Convert simple filter object to Qdrant filter format
    const must: any[] = [];

    for (const [key, value] of Object.entries(filter)) {
      must.push({
        key: `metadata.${key}`,
        match: { value },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }
}
