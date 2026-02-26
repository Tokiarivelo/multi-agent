export interface IQdrantClient {
  createCollection(name: string, dimension: number, distance: 'Cosine' | 'Euclid' | 'Dot'): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  upsertPoints(collectionName: string, points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>): Promise<void>;
  search(collectionName: string, vector: number[], limit: number, filter?: Record<string, any>): Promise<Array<{ id: string; score: number; payload: Record<string, any> }>>;
  collectionExists(name: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
}
