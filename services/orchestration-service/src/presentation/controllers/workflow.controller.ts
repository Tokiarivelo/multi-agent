import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CreateWorkflowUseCase } from '../../application/use-cases/create-workflow.use-case';
import { GetWorkflowUseCase } from '../../application/use-cases/get-workflow.use-case';
import { ExecuteWorkflowUseCase } from '../../application/use-cases/execute-workflow.use-case';
import { CreateWorkflowDto } from '../../application/dto/create-workflow.dto';
import { ExecuteWorkflowDto } from '../../application/dto/execute-workflow.dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly createWorkflowUseCase: CreateWorkflowUseCase,
    private readonly getWorkflowUseCase: GetWorkflowUseCase,
    private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() dto: CreateWorkflowDto, @Query('userId') userId: string) {
    this.logger.log(`Creating workflow for user ${userId}`);
    return this.createWorkflowUseCase.execute(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Workflows retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    if (userId) {
      return this.getWorkflowUseCase.getByUserId(userId);
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.getWorkflowUseCase.getAll(pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Workflow found' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findOne(@Param('id') id: string) {
    return this.getWorkflowUseCase.execute(id);
  }

  @Post('execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Execute a workflow' })
  @ApiResponse({ status: 202, description: 'Workflow execution started' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async execute(@Body() dto: ExecuteWorkflowDto, @Query('userId') userId: string) {
    this.logger.log(`Executing workflow ${dto.workflowId} for user ${userId}`);
    return this.executeWorkflowUseCase.execute(dto, userId);
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get execution status' })
  @ApiParam({ name: 'executionId', type: String })
  @ApiResponse({ status: 200, description: 'Execution status retrieved' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async getExecutionStatus(@Param('executionId') executionId: string) {
    return this.executeWorkflowUseCase.getExecutionStatus(executionId);
  }

  @Post('executions/:executionId/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a workflow execution' })
  @ApiParam({ name: 'executionId', type: String })
  @ApiResponse({ status: 204, description: 'Execution cancelled' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  async cancelExecution(@Param('executionId') executionId: string) {
    await this.executeWorkflowUseCase.cancelExecution(executionId);
  }
}
