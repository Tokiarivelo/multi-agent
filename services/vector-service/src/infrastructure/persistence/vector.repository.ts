import { Injectable, Logger } from '@nestjs/common';
import {
  IVectorRepository,
  PaginatedCollections,
} from '../../domain/repositories/vector.repository.interface';
import { Collection } from '../../domain/entities/collection.entity';
import { PrismaService } from '../database/prisma.service';

type PrismaCollection = {
  id: string;
  name: string;
  userId: string;
  dimension: number;
  embeddingModelId: string | null;
  apiKeyId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toCollection(c: PrismaCollection): Collection {
  return new Collection(
    c.id,
    c.name,
    c.userId,
    c.dimension,
    'cosine',
    c.createdAt,
    c.updatedAt,
    c.embeddingModelId,
    c.apiKeyId,
  );
}

@Injectable()
export class VectorRepository implements IVectorRepository {
  private readonly logger = new Logger(VectorRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCollection(collection: Collection): Promise<Collection> {
    const created = await this.prisma.vectorCollection.create({
      data: {
        name: collection.name,
        userId: collection.userId,
        dimension: collection.dimension,
        embeddingModelId: collection.embeddingModelId ?? undefined,
        apiKeyId: collection.apiKeyId ?? undefined,
      },
    });
    return toCollection(created as PrismaCollection);
  }

  async findCollectionById(id: string): Promise<Collection | null> {
    const record = await this.prisma.vectorCollection.findUnique({ where: { id } });
    return record ? toCollection(record as PrismaCollection) : null;
  }

  async findCollectionByNameAndUserId(name: string, userId: string): Promise<Collection | null> {
    const record = await this.prisma.vectorCollection.findFirst({ where: { name, userId } });
    return record ? toCollection(record as PrismaCollection) : null;
  }

  async listCollectionsByUserId(
    userId: string,
    pageParam = 1,
    limitParam = 20,
  ): Promise<PaginatedCollections> {
    const page = pageParam || 1;
    const limit = limitParam || 20;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.vectorCollection.count({ where: { userId } }),
      this.prisma.vectorCollection.findMany({
        where: { userId },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: (records as PrismaCollection[]).map(toCollection),
      total,
      page,
      limit,
    };
  }

  async deleteCollection(id: string): Promise<void> {
    await this.prisma.vectorCollection.delete({ where: { id } });
  }
}
