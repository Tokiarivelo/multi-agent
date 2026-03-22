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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FileService } from '../../application/file.service';
import { FileIndexingService } from '../../application/file-indexing.service';

@ApiTags('files')
@Controller('api/files')
export class FileController {
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
  async upload(@UploadedFile() file: Express.Multer.File, @Query('userId') userId: string) {
    if (!file) {
      throw new BadRequestException('File is missing or multipart transmission failed');
    }
    const record = await this.fileService.upload(
      userId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    return record;
  }

  @Post('initiate-upload')
  @ApiOperation({ summary: 'Get a presigned URL to upload a file directly to MinIO' })
  async initiateUpload(
    @Body() dto: { originalName: string; mimeType: string; size: number },
    @Query('userId') userId: string,
  ) {
    return this.fileService.initiateUpload(userId, dto.originalName, dto.mimeType, dto.size || 0);
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
    this.fileIndexingService.removeIndex(id);
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
    this.fileIndexingService.indexFile(
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
    const status = this.fileIndexingService.getStatus(id);
    if (!status) return { fileId: id, status: 'idle' };
    return status;
  }

  @Delete(':id/index')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a file from the vector index' })
  async removeIndex(@Param('id') id: string) {
    this.fileIndexingService.removeIndex(id);
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
