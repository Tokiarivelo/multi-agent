import { ToolEntity, ToolCategory } from './tool.entity';

export interface ToolRepository {
  create(tool: Omit<ToolEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolEntity>;
  findById(id: string): Promise<ToolEntity | null>;
  findByName(name: string): Promise<ToolEntity | null>;
  findAll(filters?: { category?: ToolCategory; isBuiltIn?: boolean }): Promise<ToolEntity[]>;
  update(id: string, tool: Partial<ToolEntity>): Promise<ToolEntity>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<ToolEntity[]>;
}
