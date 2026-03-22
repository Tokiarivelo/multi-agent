import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { FileService } from '../../application/file.service';
import { FileIndexingService } from '../../application/file-indexing.service';

describe('FileController', () => {
  let controller: FileController;
  let fileService: jest.Mocked<FileService>;
  let fileIndexingService: jest.Mocked<FileIndexingService>;

  beforeEach(async () => {
    const mockFileService = {
      upload: jest.fn(),
      initiateUpload: jest.fn(),
      listFiles: jest.fn(),
      getPresignedUrl: jest.fn(),
      deleteFile: jest.fn(),
    };

    const mockFileIndexingService = {
      indexFile: jest.fn(),
      getStatus: jest.fn(),
      removeIndex: jest.fn(),
      searchFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: FileService,
          useValue: mockFileService,
        },
        {
          provide: FileIndexingService,
          useValue: mockFileIndexingService,
        },
      ],
    }).compile();

    controller = module.get<FileController>(FileController);
    fileService = module.get(FileService);
    fileIndexingService = module.get(FileIndexingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should upload a file and return the record', async () => {
      const mockFile = {
        originalname: 'test.txt',
        buffer: Buffer.from('hello world'),
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const userId = 'user-123';
      const expectedRecord = { id: 'file-123', originalName: 'test.txt' };

      fileService.upload.mockResolvedValue(expectedRecord as never);

      const result = await controller.upload(mockFile, userId);

      expect(result).toBe(expectedRecord);
      expect(fileService.upload).toHaveBeenCalledWith(
        userId,
        mockFile.originalname,
        mockFile.buffer,
        mockFile.mimetype,
      );
    });
  });

  describe('indexFile', () => {
    it('should start indexing and return status', async () => {
      const fileId = 'file-123';
      const userId = 'user-123';
      const body = { embeddingModelId: 'model-1', apiKeyId: 'key-1' };

      const result = await controller.indexFile(fileId, userId, body);

      expect(result).toEqual({ fileId, status: 'indexing' });
      expect(fileIndexingService.indexFile).toHaveBeenCalledWith(
        fileId,
        userId,
        body.embeddingModelId,
        body.apiKeyId,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('searchFiles', () => {
    it('should search files and return results', async () => {
      const userId = 'user-123';
      const body = { query: 'test', limit: 5 };
      const expectedResults = [{ id: '1', score: 0.9, content: 'test content' }];

      fileIndexingService.searchFiles.mockResolvedValue(expectedResults as unknown as never);

      const result = await controller.searchFiles(userId, body);

      expect(result).toEqual({ results: expectedResults });
      expect(fileIndexingService.searchFiles).toHaveBeenCalledWith(
        userId,
        body.query,
        body.limit,
        undefined,
      );
    });

    it('should throw error if query is missing', async () => {
      const userId = 'user-123';
      const body = { query: '' };

      await expect(controller.searchFiles(userId, body as unknown as never)).rejects.toThrow();
    });
  });
});
