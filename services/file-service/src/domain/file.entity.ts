export type IndexingStatusType = 'idle' | 'indexing' | 'indexed' | 'error';

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  workspacePath?: string; // Virtual path in the workspace
  storedName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url?: string;
  createdAt: Date;
  indexingStatus?: {
    status: IndexingStatusType;
    fileId: string;
    indexedAt: Date | null;
    error?: string;
    contentHash?: string;
    collectionId?: string;
    chunkCount?: number;
  };
}

export interface IFileRepository {
  save(file: FileRecord): Promise<FileRecord>;
  findById(id: string): Promise<FileRecord | null>;
  findByPath(userId: string, workspacePath: string): Promise<FileRecord | null>;
  findByPaths(userId: string, workspacePaths: string[]): Promise<FileRecord[]>;
  findByPathPrefix(userId: string, prefix: string): Promise<FileRecord[]>;
  findByUser(
    userId: string,
    page?: number,
    pageSize?: number,
  ): Promise<{ data: FileRecord[]; total: number }>;
  delete(id: string): Promise<void>;
  deleteByPaths(userId: string, workspacePaths: string[]): Promise<void>;
  updateIndexingStatus(
    fileId: string,
    status: Partial<FileRecord['indexingStatus']>,
  ): Promise<void>;
}

export const FILE_REPOSITORY = 'FileRepository';
