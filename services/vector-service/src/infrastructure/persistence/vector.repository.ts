import { Injectable, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { Collection } from '../../domain/entities/collection.entity';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VectorRepository implements IVectorRepository {
  private readonly logger = new Logger(VectorRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCollection(collection: Collection): Promise<Collection> {
    const created = await this.prisma.collection.create({
      data: {
        name: collection.name,
        userId: collection.userId,
        dimension: collection.dimension,
        distance: collection.distance,
      },
    });

    return new Collection(
      created.id,
      created.name,
      created.userId,
      created.dimension,
      created.distance as 'cosine' | 'euclidean' | 'dot',
      created.createdAt,
      created.updatedAt,
    );
  }

  async findCollectionById(id: string): Promise<Collection | null> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return null;
    }

    return new Collection(
      collection.id,
      collection.name,
      collection.userId,
      collection.dimension,
      collection.distance as 'cosine' | 'euclidean' | 'dot',
      collection.createdAt,
      collection.updatedAt,
    );
  }

  async findCollectionByNameAndUserId(
    name: string,
    userId: string,
  ): Promise<Collection | null> {
    const collection = await this.prisma.collection.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (!collection) {
      return null;
    }

    return new Collection(
      collection.id,
      collection.name,
      collection.userId,
      collection.dimension,
      collection.distance as 'cosine' | 'euclidean' | 'dot',
      collection.createdAt,
      collection.updatedAt,
    );
  }

  async listCollectionsByUserId(userId: string): Promise<Collection[]> {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return collections.map(
      c =>
        new Collection(
          c.id,
          c.name,
          c.userId,
          c.dimension,
          c.distance as 'cosine' | 'euclidean' | 'dot',
          c.createdAt,
          c.updatedAt,
        ),
    );
  }

  async deleteCollection(id: string): Promise<void> {
    await this.prisma.collection.delete({
      where: { id },
    });
  }
}
