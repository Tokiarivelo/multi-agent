import { Collection } from '../entities/collection.entity';

export interface IVectorRepository {
  createCollection(collection: Collection): Promise<Collection>;
  findCollectionById(id: string): Promise<Collection | null>;
  findCollectionByNameAndUserId(name: string, userId: string): Promise<Collection | null>;
  listCollectionsByUserId(userId: string): Promise<Collection[]>;
  deleteCollection(id: string): Promise<void>;
}
