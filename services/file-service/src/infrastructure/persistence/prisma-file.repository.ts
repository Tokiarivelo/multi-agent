import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaService,
  File as PrismaFile,
  FileIndexingStatus as PrismaStatus,
} from '@multi-agent/database';
import { FileRecord, IFileRepository, IndexingStatusType } from '../../domain/file.entity';

@Injectable()
export class PrismaFileRepository implements IFileRepository {
  private readonly logger = new Logger(PrismaFileRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(file: PrismaFile & { indexingStatus?: PrismaStatus | null }): FileRecord {
    return {
      id: file.id,
      userId: file.userId,
      originalName: file.originalName,
      workspacePath: file.workspacePath || '',
      storedName: file.storedName,
      mimeType: file.mimeType,
      size: file.size,
      bucket: file.bucket,
      key: file.key,
      url: file.url || undefined,
      createdAt: file.createdAt,
      indexingStatus: file.indexingStatus
        ? {
            status: file.indexingStatus.status as IndexingStatusType,
            fileId: file.indexingStatus.fileId,
            indexedAt: file.indexingStatus.indexedAt,
            error: file.indexingStatus.error || undefined,
            contentHash: file.indexingStatus.contentHash || undefined,
            collectionId: file.indexingStatus.collectionId || undefined,
            chunkCount: file.indexingStatus.chunkCount || 0,
          }
        : undefined,
    };
  }

  async save(file: FileRecord): Promise<FileRecord> {
    const data = {
      userId: file.userId,
      originalName: file.originalName,
      workspacePath: file.workspacePath,
      storedName: file.storedName,
      mimeType: file.mimeType,
      size: file.size,
      bucket: file.bucket,
      key: file.key,
      url: file.url,
    };

    const saved = await this.prisma.file.upsert({
      where: { id: file.id || '' },
      update: data,
      create: { ...data, id: file.id },
      include: { indexingStatus: true },
    });

    return this.mapToEntity(saved);
  }

  async findById(id: string): Promise<FileRecord | null> {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: { indexingStatus: true },
    });
    return file ? this.mapToEntity(file) : null;
  }

  async findByPath(userId: string, workspacePath: string): Promise<FileRecord | null> {
    const file = await this.prisma.file.findFirst({
      where: { userId, workspacePath },
      include: { indexingStatus: true },
    });
    return file ? this.mapToEntity(file) : null;
  }

  async findByPaths(userId: string, workspacePaths: string[]): Promise<FileRecord[]> {
    const files = await this.prisma.file.findMany({
      where: { userId, workspacePath: { in: workspacePaths } },
      include: { indexingStatus: true },
    });
    return files.map((f) => this.mapToEntity(f));
  }

  async findByPathPrefix(userId: string, prefix: string): Promise<FileRecord[]> {
    const files = await this.prisma.file.findMany({
      where: { userId, workspacePath: { startsWith: prefix } },
      include: { indexingStatus: true },
    });
    return files.map((f) => this.mapToEntity(f));
  }

  async findByUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: FileRecord[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.file.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { indexingStatus: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.count({ where: { userId } }),
    ]);
    return { data: data.map((f) => this.mapToEntity(f)), total };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.file.delete({ where: { id } });
  }

  async deleteByPaths(userId: string, workspacePaths: string[]): Promise<void> {
    await this.prisma.file.deleteMany({
      where: {
        userId,
        workspacePath: { in: workspacePaths },
      },
    });
  }

  async updateIndexingStatus(
    fileId: string,
    status: Partial<FileRecord['indexingStatus']>,
  ): Promise<void> {
    await this.prisma.fileIndexingStatus.upsert({
      where: { fileId },
      update: {
        status: status.status,
        indexedAt: status.indexedAt,
        error: status.error,
        contentHash: status.contentHash,
        collectionId: status.collectionId,
        chunkCount: status.chunkCount,
      },
      create: {
        fileId,
        status: status.status || 'idle',
        indexedAt: status.indexedAt,
        error: status.error,
        contentHash: status.contentHash,
        collectionId: status.collectionId,
        chunkCount: status.chunkCount,
      },
    });
  }
}
