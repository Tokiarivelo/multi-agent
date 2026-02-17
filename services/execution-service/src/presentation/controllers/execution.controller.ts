import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IExecutionRepository } from '../../domain/repositories/execution.repository.interface';
import { GetExecutionLogsUseCase } from '../../application/use-cases/get-execution-logs.use-case';
import { IEventPublisher } from '../../application/interfaces/event-publisher.interface';
import { ExecutionDomainService } from '../../domain/services/execution.domain.service';
import { Logger } from '@multi-agent/common';

@ApiTags('executions')
@Controller('executions')
export class ExecutionController {
  private readonly logger = new Logger(ExecutionController.name);

  constructor(
    @Inject(IExecutionRepository)
    private readonly executionRepository: IExecutionRepository,
    private readonly getExecutionLogsUseCase: GetExecutionLogsUseCase,
    private readonly executionDomainService: ExecutionDomainService,
    @Inject(IEventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get execution by ID' })
  @ApiResponse({ status: 200, description: 'Execution found' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecution(@Param('id') id: string) {
    this.logger.info(`Getting execution ${id}`);

    const execution = await this.executionRepository.findById(id);
    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      userId: execution.userId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      error: execution.error,
      metadata: execution.metadata,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs' })
  @ApiResponse({ status: 200, description: 'Execution logs found' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecutionLogs(@Param('id') id: string) {
    this.logger.info(`Getting logs for execution ${id}`);

    const execution = await this.executionRepository.findById(id);
    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }

    const logs = await this.getExecutionLogsUseCase.execute(id);

    return logs.map(log => ({
      id: log.id,
      executionId: log.executionId,
      nodeId: log.nodeId,
      nodeName: log.nodeName,
      status: log.status,
      input: log.input,
      output: log.output,
      error: log.error,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      duration: log.duration,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    }));
  }

  @Get()
  @ApiOperation({ summary: 'List executions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Executions list' })
  async listExecutions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page number');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid limit (must be between 1 and 100)');
    }

    this.logger.info(`Listing executions - page: ${pageNum}, limit: ${limitNum}`);

    const result = await this.executionRepository.findAll({
      page: pageNum,
      limit: limitNum,
    });

    return {
      data: result.data.map(execution => ({
        id: execution.id,
        workflowId: execution.workflowId,
        userId: execution.userId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        metadata: execution.metadata,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed execution' })
  @ApiResponse({ status: 200, description: 'Execution retry initiated' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  @ApiResponse({ status: 400, description: 'Execution cannot be retried' })
  async retryExecution(@Param('id') id: string) {
    this.logger.info(`Retrying execution ${id}`);

    const execution = await this.executionRepository.findById(id);
    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }

    if (!execution.isRetryable()) {
      throw new BadRequestException(
        `Execution ${id} cannot be retried (status: ${execution.status})`,
      );
    }

    // Find the failed node
    const failedNode = await this.executionDomainService.findFailedNode(id);
    if (!failedNode) {
      throw new BadRequestException(`No failed node found for execution ${id}`);
    }

    // Publish retry event (this would be handled by the orchestrator service)
    await this.eventPublisher.publish('execution.retry.requested', {
      executionId: id,
      workflowId: execution.workflowId,
      failedNodeId: failedNode.nodeId,
      timestamp: new Date().toISOString(),
    });

    this.logger.info(`Retry requested for execution ${id} starting from node ${failedNode.nodeId}`);

    return {
      message: 'Execution retry initiated',
      executionId: id,
      failedNodeId: failedNode.nodeId,
    };
  }
}
