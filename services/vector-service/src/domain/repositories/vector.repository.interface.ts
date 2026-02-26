import { Collection } from '../entities/collection.entity';

export interface PaginatedCollections {
  data: Collection[];
  total: number;
  page: number;
  limit: number;
}

export interface IVectorRepository {
  createCollection(collection: Collection): Promise<Collection>;
  findCollectionById(id: string): Promise<Collection | null>;
  findCollectionByNameAndUserId(name: string, userId: string): Promise<Collection | null>;
  listCollectionsByUserId(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedCollections>;
  deleteCollection(id: string): Promise<void>;
}
