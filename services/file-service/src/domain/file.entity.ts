export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url?: string;
  createdAt: Date;
}

export interface IFileRepository {
  save(file: FileRecord): Promise<FileRecord>;
  findById(id: string): Promise<FileRecord | null>;
  findByUser(
    userId: string,
    page?: number,
    pageSize?: number,
  ): Promise<{ data: FileRecord[]; total: number }>;
  delete(id: string): Promise<void>;
}

export const FILE_REPOSITORY = 'FileRepository';
