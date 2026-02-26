import { Injectable } from '@nestjs/common';
import { FileRecord, IFileRepository } from '../../domain/file.entity';
import { v4 as uuidv4 } from 'uuid';

/** In-memory repository — replace with Prisma for persistence */
@Injectable()
export class InMemoryFileRepository implements IFileRepository {
  private store = new Map<string, FileRecord>();

  async save(file: FileRecord): Promise<FileRecord> {
    if (!file.id) file.id = uuidv4();
    this.store.set(file.id, file);
    return file;
  }

  async findById(id: string): Promise<FileRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findByUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: FileRecord[]; total: number }> {
    const all = [...this.store.values()].filter((f) => f.userId === userId);
    const total = all.length;
    const data = all.slice((page - 1) * pageSize, page * pageSize);
    return { data, total };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
