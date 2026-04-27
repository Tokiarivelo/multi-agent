import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolExecutionResult } from '@domain/tool-execution.interface';
import { ExecuteToolDto } from '@application/dto/execute-tool.dto';
import { SandboxExecutorService } from '@infrastructure/sandbox/sandbox-executor.service';
import { BuiltInToolsService } from '@infrastructure/sandbox/built-in-tools.service';
import { McpExecutorService } from '@infrastructure/sandbox/mcp-executor.service';
import { ToolCategory, McpConfig } from '@domain/tool.entity';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExecuteToolUseCase {
  private readonly defaultTimeout: number;

  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
    private readonly sandboxExecutor: SandboxExecutorService,
    private readonly builtInTools: BuiltInToolsService,
    private readonly mcpExecutor: McpExecutorService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.defaultTimeout = this.configService.get<number>('TOOL_EXECUTION_TIMEOUT', 30000);
  }

  private async getGithubToken(userId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      const settings = user?.settings as Record<string, unknown> | null;
      return (settings?.['githubToken'] as string) ?? null;
    } catch {
      return null;
    }
  }

  private async clearGithubToken(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      const settings = (user?.settings as Record<string, unknown> | null) ?? {};
      const rest = Object.fromEntries(
        Object.entries(settings).filter(([key]) => key !== 'githubToken'),
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { settings: rest as Prisma.InputJsonValue },
      });
    } catch {
      // non-fatal — token will just remain stale in DB
    }
  }

  private isGithubAuthError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('bad credentials') ||
      lower.includes('[http 401]') ||
      lower.includes('[http 403]') ||
      lower.includes('unauthorized') ||
      lower.includes('token has been revoked') ||
      lower.includes('token is expired') ||
      lower.includes('requires authentication') ||
      // Empty MCP internal error — GitHub token was rejected without a message
      /mcp error -32603:\s*$/.test(lower) ||
      (lower.includes('github') && lower.includes('403'))
    );
  }

  async execute(dto: ExecuteToolDto): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      if (!dto.toolId && !dto.toolName) {
        throw new BadRequestException('Either toolId or toolName must be provided');
      }

      const tool = dto.toolId
        ? await this.toolRepository.findById(dto.toolId)
        : await this.toolRepository.findByName(dto.toolName!);

      if (!tool) {
        throw new NotFoundException(`Tool not found`);
      }

      const validation = tool.validateParameters(dto.parameters);
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid parameters',
          errors: validation.errors,
        });
      }

      const timeout = dto.timeout || this.defaultTimeout;

      // Inject workspace cwd into parameters so built-in tools (shell, git, file ops)
      // and sandboxed tools use the correct working directory. Only set when not already
      // provided by the caller in their explicit parameters.
      const parameters =
        dto.cwd && !dto.parameters['cwd'] ? { ...dto.parameters, cwd: dto.cwd } : dto.parameters;

      let result: any;

      if (tool.category === ToolCategory.MCP) {
        if (!tool.mcpConfig) throw new BadRequestException('MCP tool missing mcpConfig');

        let mcpParams = parameters;
        if (tool.repoFullName && tool.repoFullName.includes('/')) {
          const [owner, repo] = tool.repoFullName.split('/');
          mcpParams = { ...mcpParams, owner, repo };
        }

        // Inject the user's GitHub OAuth token as a header so the MCP service
        // acts as the user rather than as the GitHub App service account.
        let mcpConfig: McpConfig = tool.mcpConfig;
        if (tool.repoFullName && dto.userId) {
          const githubToken = await this.getGithubToken(dto.userId);
          if (!githubToken) {
            return {
              success: true,
              data: '__GITHUB_AUTH_REQUIRED__',
              executionTime: Date.now() - startTime,
            };
          }
          mcpConfig = {
            ...mcpConfig,
            headers: { ...(mcpConfig.headers ?? {}), 'x-github-token': githubToken },
          };
        }

        try {
          result = await this.mcpExecutor.execute(mcpConfig, mcpParams, timeout);
        } catch (mcpErr: any) {
          if (tool.repoFullName && dto.userId && this.isGithubAuthError(mcpErr?.message ?? '')) {
            await this.clearGithubToken(dto.userId);
            return {
              success: true,
              data: '__GITHUB_AUTH_REQUIRED__',
              executionTime: Date.now() - startTime,
            };
          }
          throw mcpErr;
        }
      } else if (tool.isBuiltIn) {
        result = await this.builtInTools.execute(tool.name, parameters, timeout, tool.code ?? undefined);
      } else if (tool.code) {
        result = await this.sandboxExecutor.execute(tool.code, parameters, timeout, dto.cwd);
      } else {
        throw new BadRequestException('Tool has no executable code');
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        executionTime,
      };
    }
  }
}
