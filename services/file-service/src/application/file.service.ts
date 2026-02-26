import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import { MinioService } from '../infrastructure/minio/minio.service';
import { FILE_REPOSITORY, FileRecord, IFileRepository } from '../domain/file.entity';

@Injectable()
export class FileService {
  constructor(
    private readonly minio: MinioService,
    @Inject(FILE_REPOSITORY) private readonly repo: IFileRepository,
  ) {}

  async upload(
    userId: string,
    originalName: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<FileRecord> {
    const id = uuidv4();
    const ext = originalName.split('.').pop() ?? 'bin';
    const storedName = `${id}.${ext}`;
    const key = `${userId}/${storedName}`;
    const resolvedMime =
      mimeType ?? (mime.lookup(originalName) as string) ?? 'application/octet-stream';
    const bucket = this.minio.getBucket();

    await this.minio.upload(key, buffer, resolvedMime);

    const presignedUrl = await this.minio.getPresignedUrl(key, 7 * 24 * 60 * 60); // 7 days max
    const record: FileRecord = {
      id,
      userId,
      originalName,
      storedName,
      mimeType: resolvedMime,
      size: buffer.length,
      bucket,
      key,
      url: presignedUrl,
      createdAt: new Date(),
    };

    return this.repo.save(record);
  }

  async initiateUpload(
    userId: string,
    originalName: string,
    mimeType: string,
    size: number,
  ): Promise<{ uploadUrl: string; record: FileRecord }> {
    const id = uuidv4();
    const ext = originalName.split('.').pop() ?? 'bin';
    const storedName = `${id}.${ext}`;
    const key = `${userId}/${storedName}`;
    const resolvedMime =
      mimeType || (mime.lookup(originalName) as string) || 'application/octet-stream';
    const bucket = this.minio.getBucket();

    // Get the pre-signed Put URL directly from MinIO
    const uploadUrl = await this.minio.getPresignedPutUrl(key);
    // Also generate a pre-signed Get URL for immediate viewing access
    const presignedGetUrl = await this.minio.getPresignedUrl(key, 7 * 24 * 60 * 60);

    const record: FileRecord = {
      id,
      userId,
      originalName,
      storedName,
      mimeType: resolvedMime,
      size,
      bucket,
      key,
      url: presignedGetUrl,
      createdAt: new Date(),
    };

    const savedRecord = await this.repo.save(record);
    return { uploadUrl, record: savedRecord };
  }

  async getPresignedUrl(id: string, userId: string): Promise<string> {
    const file = await this.repo.findById(id);
    if (!file) throw new NotFoundException(`File ${id} not found`);
    if (file.userId !== userId) throw new ForbiddenException('Access denied');
    return this.minio.getPresignedUrl(file.key);
  }

  async listFiles(userId: string, page = 1, pageSize = 20) {
    return this.repo.findByUser(userId, page, pageSize);
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    const file = await this.repo.findById(id);
    if (!file) throw new NotFoundException(`File ${id} not found`);
    if (file.userId !== userId) throw new ForbiddenException('Access denied');
    await this.minio.delete(file.key);
    await this.repo.delete(id);
  }
}
