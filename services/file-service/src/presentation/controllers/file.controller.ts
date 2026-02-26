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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FileService } from '../../application/file.service';

@ApiTags('files')
@Controller('api/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

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
  }
}
