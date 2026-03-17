import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as fs from 'fs/promises';
import * as path from 'path';

@ApiTags('Workspace')
@Controller('workspace')
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

  private validatePath(targetPath: string) {
    if (!targetPath) {
      throw new BadRequestException('Path is required');
    }
    const isAbsolute = targetPath.startsWith('/') || /^[A-Za-z]:[/\\]/.test(targetPath);
    if (!isAbsolute) {
      throw new BadRequestException('Absolute path is required');
    }
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get file tree for an absolute path' })
  async getTree(@Query('path') rootPath: string) {
    this.validatePath(rootPath);
    this.logger.log(`Fetching tree for: ${rootPath}`);

    const buildTree = async (currentPath: string, depth = 0): Promise<any> => {
      const name = path.basename(currentPath);
      const stats = await fs.stat(currentPath);

      if (stats.isDirectory()) {
        // Limit depth to prevent massive recursive scans if someone points to /
        if (depth > 5) return { name, path: currentPath, kind: 'directory', children: [] };

        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const children = await Promise.all(
          entries
            .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
            .map((e) => buildTree(path.join(currentPath, e.name), depth + 1)),
        );
        return { name, path: currentPath, kind: 'directory', children };
      }
      return { name, path: currentPath, kind: 'file', size: stats.size };
    };

    try {
      return await buildTree(rootPath);
    } catch (error: any) {
      this.logger.error(`Failed to build tree: ${error.message}`);
      throw new BadRequestException(`Failed to read directory: ${error.message}`);
    }
  }

  @Get('file')
  @ApiOperation({ summary: 'Read file content' })
  async readFile(@Query('path') filePath: string) {
    this.validatePath(filePath);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content };
    } catch (error: any) {
      throw new BadRequestException(`Failed to read file: ${error.message}`);
    }
  }

  @Post('file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Write file content' })
  async writeFile(@Body() body: { path: string; content: string }) {
    this.validatePath(body.path);
    try {
      await fs.writeFile(body.path, body.content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(`Failed to write file: ${error.message}`);
    }
  }

  @Post('item')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new file or directory' })
  async createItem(@Body() body: { path: string; type: 'file' | 'directory' }) {
    this.validatePath(body.path);
    try {
      if (body.type === 'directory') {
        await fs.mkdir(body.path, { recursive: true });
      } else {
        await fs.writeFile(body.path, '', 'utf-8');
      }
      return { success: true };
    } catch (error: any) {
      throw new BadRequestException(`Failed to create ${body.type}: ${error.message}`);
    }
  }
}
