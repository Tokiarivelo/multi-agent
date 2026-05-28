import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import * as fs from 'fs';
import * as path from 'path';
import { MinioService } from '../infrastructure/minio/minio.service';
import { FILE_REPOSITORY, FileRecord, IFileRepository } from '../domain/file.entity';

@Injectable()
export class FileService {
  constructor(
    private readonly minio: MinioService,
    private readonly configService: ConfigService,
    @Inject(FILE_REPOSITORY) private readonly repo: IFileRepository,
  ) {}

  async upload(
    userId: string,
    originalName: string,
    buffer: Buffer,
    mimeType?: string,
    workspacePath?: string,
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
    const normalizedPath = workspacePath
      ? workspacePath.startsWith('/')
        ? workspacePath.substring(1)
        : workspacePath
      : undefined;
    const record: FileRecord = {
      id,
      userId,
      originalName,
      workspacePath: normalizedPath,
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
    workspacePath?: string,
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

    const normalizedPath = workspacePath
      ? workspacePath.startsWith('/')
        ? workspacePath.substring(1)
        : workspacePath
      : undefined;
    const record: FileRecord = {
      id,
      userId,
      originalName,
      workspacePath: normalizedPath,
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

  async findByPath(userId: string, workspacePath: string): Promise<FileRecord | null> {
    return this.repo.findByPath(userId, workspacePath);
  }

  async findByPaths(userId: string, workspacePaths: string[]): Promise<FileRecord[]> {
    return this.repo.findByPaths(userId, workspacePaths);
  }

  async findByPathPrefix(userId: string, prefix: string): Promise<FileRecord[]> {
    return this.repo.findByPathPrefix(userId, prefix);
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    const file = await this.repo.findById(id);
    if (!file) throw new NotFoundException(`File ${id} not found`);
    if (file.userId !== userId) throw new ForbiddenException('Access denied');
    await this.minio.delete(file.key);
    await this.repo.delete(id);
  }

  async getFileContent(
    userId: string,
    workspacePath: string,
    workspaceRoot?: string,
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
    const normalizedPath = workspacePath.replace(/^\/+/, '');

    // 1. Try DB/MinIO first
    const file = await this.repo.findByPath(userId, normalizedPath);
    if (file) {
      const buffer = await this.minio.getObject(file.key);
      return {
        buffer,
        mimeType: file.mimeType,
        originalName: file.originalName,
      };
    }

    // 2. Fallback to Local Host Workspace (passed Root or ENV fallback)
    const hostRoot = workspaceRoot || this.configService.get<string>('WORKSPACE_ROOT');
    if (hostRoot) {
      const resolvedRoot = path.resolve(hostRoot);
      const checkRoot = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
      const fullPath = path.resolve(resolvedRoot, normalizedPath);

      // Security check: ensure path is within hostRoot
      if (!fullPath.startsWith(checkRoot) && fullPath !== resolvedRoot) {
        throw new ForbiddenException(
          `Access denied: path "${fullPath}" is outside the allowed workspace root "${checkRoot}"`,
        );
      }

      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const buffer = fs.readFileSync(fullPath);
        const originalName = path.basename(fullPath);
        const mimeType = (mime.lookup(originalName) as string) || 'application/octet-stream';
        return {
          buffer,
          mimeType,
          originalName,
        };
      }
    }

    throw new NotFoundException(`File not found at path: ${workspacePath}`);
  }
}
