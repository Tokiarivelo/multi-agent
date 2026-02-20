import { Injectable, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { Collection } from '../../domain/entities/collection.entity';
import { PrismaService } from '../database/prisma.service';

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
      },
    });

    return new Collection(
      created.id,
      created.name,
      created.userId,
      created.dimension,
      'cosine', // default distance metric, managed by Qdrant
      created.createdAt,
      created.updatedAt,
    );
  }

  async findCollectionById(id: string): Promise<Collection | null> {
    const record = await this.prisma.vectorCollection.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return new Collection(
      record.id,
      record.name,
      record.userId,
      record.dimension,
      'cosine',
      record.createdAt,
      record.updatedAt,
    );
  }

  async findCollectionByNameAndUserId(name: string, userId: string): Promise<Collection | null> {
    const record = await this.prisma.vectorCollection.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (!record) {
      return null;
    }

    return new Collection(
      record.id,
      record.name,
      record.userId,
      record.dimension,
      'cosine',
      record.createdAt,
      record.updatedAt,
    );
  }

  async listCollectionsByUserId(userId: string): Promise<Collection[]> {
    const records = await this.prisma.vectorCollection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(
      (c) =>
        new Collection(c.id, c.name, c.userId, c.dimension, 'cosine', c.createdAt, c.updatedAt),
    );
  }

  async deleteCollection(id: string): Promise<void> {
    await this.prisma.vectorCollection.delete({
      where: { id },
    });
  }
}
