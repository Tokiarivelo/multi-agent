import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Body,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FileService } from '../../application/file.service';
import { FileIndexingService } from '../../application/file-indexing.service';

@ApiTags('files')
@Controller('api/files')
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly fileService: FileService,
    private readonly fileIndexingService: FileIndexingService,
  ) {}

  /**
   * Upload a file (multipart/form-data). userId is injected by the gateway
   * via a query parameter (?userId=...).
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to MinIO' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('userId') userId: string,
    @Query('workspacePath') workspacePath?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is missing or multipart transmission failed');
    }
    const record = await this.fileService.upload(
      userId,
      file.originalname,
      file.buffer,
      file.mimetype,
      workspacePath,
    );
    return record;
  }

  @Post('initiate-upload')
  @ApiOperation({ summary: 'Get a presigned URL to upload a file directly to MinIO' })
  async initiateUpload(
    @Body() dto: { originalName: string; mimeType: string; size: number; workspacePath?: string },
    @Query('userId') userId: string,
  ) {
    return this.fileService.initiateUpload(
      userId,
      dto.originalName,
      dto.mimeType,
      dto.size || 0,
      dto.workspacePath,
    );
  }

  @Get('by-path')
  @ApiOperation({ summary: 'Get file record and indexing status by workspace path' })
  async getByPath(@Query('userId') userId: string, @Query('path') path: string) {
    const file = await this.fileService.findByPath(userId, path);
    if (!file) {
      return {
        indexingStatus: { status: 'idle', fileId: 'none', indexedAt: null },
      };
    }

    return {
      ...file,
      indexingStatus: file.indexingStatus || {
        fileId: file.id,
        status: 'idle',
        indexedAt: null,
      },
    };
  }

  @Post('bulk-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get file records and indexing statuses for multiple workspace paths' })
  async getBulkStatusByPaths(@Query('userId') userId: string, @Body() body: { paths: string[] }) {
    if (!body.paths || !Array.isArray(body.paths)) {
      throw new BadRequestException('paths must be an array of strings');
    }

    const files = await this.fileService.findByPaths(userId, body.paths);
    const result: Record<string, unknown> = {};

    // For paths that exist in the DB, get their indexing status
    for (const file of files) {
      if (file.workspacePath) {
        result[file.workspacePath] = {
          ...file,
          indexingStatus: file.indexingStatus || {
            fileId: file.id,
            status: 'idle',
            indexedAt: null,
          },
        };
      }
    }

    // For requested paths that DO NOT exist in exactly, return a default 'idle' state.
    // This allows the frontend to have a consistent record.
    for (const path of body.paths) {
      if (!result[path]) {
        result[path] = {
          status: 'idle',
          indexingStatus: { status: 'idle', fileId: 'none', indexedAt: null },
        };
      }
    }

    return result;
  }

  @Post('index-path')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate indexing for a file or directory path' })
  async indexByPath(
    @Query('userId') userId: string,
    @Body()
    body: {
      path: string;
      embeddingModelId?: string;
      apiKeyId?: string;
      useSummarization?: boolean;
      summarizationModelId?: string;
      summarizationApiKeyId?: string;
    },
  ) {
    if (!body.path) {
      throw new BadRequestException('path is required');
    }

    // 1. Check if it's a single file
    const file = await this.fileService.findByPath(userId, body.path);
    const filesToIndex: import('../../domain/file.entity').FileRecord[] = file ? [file] : [];

    // 2. Check if it's a directory (find all files with that prefix)
    const subFiles = await this.fileService.findByPathPrefix(userId, body.path + '/');
    for (const sf of subFiles) {
      if (!filesToIndex.find((f) => f.id === sf.id)) {
        filesToIndex.push(sf);
      }
    }

    if (filesToIndex.length === 0) {
      throw new NotFoundException(`No files found under path: ${body.path}`);
    }

    for (const f of filesToIndex) {
      await this.fileIndexingService.indexFile(
        f.id,
        userId,
        body.embeddingModelId,
        body.apiKeyId,
        body.useSummarization,
        body.summarizationModelId,
        body.summarizationApiKeyId,
      );
    }

    this.logger.log(`Initiated indexing for ${filesToIndex.length} files under path: ${body.path}`);
    return {
      message: `Indexing started for ${filesToIndex.length} files`,
      count: filesToIndex.length,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List files for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async list(
    @Query('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.fileService.listFiles(userId, page, pageSize);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get a presigned download URL for a file' })
  async getUrl(@Param('id') id: string, @Query('userId') userId: string) {
    const url = await this.fileService.getPresignedUrl(id, userId);
    return { url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file' })
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    await this.fileService.deleteFile(id, userId);
    await this.fileIndexingService.removeIndex(id);
  }

  // ── Vector indexing endpoints ─────────────────────────────────────────────

  @Post(':id/index')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start async indexing of a file into the vector DB' })
  async indexFile(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body()
    body?: {
      embeddingModelId?: string;
      apiKeyId?: string;
      useSummarization?: boolean;
      summarizationModelId?: string;
      summarizationApiKeyId?: string;
    },
  ) {
    await this.fileIndexingService.indexFile(
      id,
      userId,
      body?.embeddingModelId,
      body?.apiKeyId,
      body?.useSummarization,
      body?.summarizationModelId,
      body?.summarizationApiKeyId,
    );
    return { fileId: id, status: 'indexing' };
  }

  @Get(':id/index-status')
  @ApiOperation({ summary: 'Get the indexing status of a file' })
  async getIndexStatus(@Param('id') id: string) {
    const status = await this.fileIndexingService.getStatus(id);
    if (!status) return { fileId: id, status: 'idle' };
    return status;
  }

  @Delete(':id/index')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a file from the vector index' })
  async removeIndex(@Param('id') id: string) {
    await this.fileIndexingService.removeIndex(id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Semantic search across indexed workspace files' })
  async searchFiles(
    @Query('userId') userId: string,
    @Body() body: { query: string; limit?: number; fileId?: string },
  ) {
    if (!body.query) throw new NotFoundException('query is required');
    const results = await this.fileIndexingService.searchFiles(
      userId,
      body.query,
      body.limit ?? 5,
      body.fileId,
    );
    return { results };
  }
}
