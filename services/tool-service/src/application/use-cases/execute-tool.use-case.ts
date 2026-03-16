import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolExecutionResult } from '@domain/tool-execution.interface';
import { ExecuteToolDto } from '@application/dto/execute-tool.dto';
import { SandboxExecutorService } from '@infrastructure/sandbox/sandbox-executor.service';
import { BuiltInToolsService } from '@infrastructure/sandbox/built-in-tools.service';

@Injectable()
export class ExecuteToolUseCase {
  private readonly defaultTimeout: number;

  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
    private readonly sandboxExecutor: SandboxExecutorService,
    private readonly builtInTools: BuiltInToolsService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTimeout = this.configService.get<number>('TOOL_EXECUTION_TIMEOUT', 30000);
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
      let result: any;

      if (tool.isBuiltIn) {
        result = await this.builtInTools.execute(tool.name, dto.parameters, timeout);
      } else if (tool.code) {
        result = await this.sandboxExecutor.execute(tool.code, dto.parameters, timeout);
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
