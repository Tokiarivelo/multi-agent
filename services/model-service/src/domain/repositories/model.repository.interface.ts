import { Model, CreateModelInput, UpdateModelInput, ModelProvider } from '../entities/model.entity';

export interface PaginatedModels {
  data: Model[];
  total: number;
  page: number;
  limit: number;
}

export interface ModelRepositoryInterface {
  create(input: CreateModelInput): Promise<Model>;
  findById(id: string): Promise<Model | null>;
  findByName(name: string): Promise<Model | null>;
  findAll(filters?: ModelFilters): Promise<PaginatedModels>;
  update(id: string, input: UpdateModelInput): Promise<Model>;
  delete(id: string): Promise<void>;
  findByProvider(provider: ModelProvider): Promise<Model[]>;
  getDefaultModel(): Promise<Model | null>;
  setDefaultModel(id: string): Promise<Model>;
}

export interface ModelFilters {
  provider?: ModelProvider;
  isActive?: boolean;
  supportsStreaming?: boolean;
  page?: number;
  limit?: number;
}
