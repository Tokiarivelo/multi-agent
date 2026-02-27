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
import { UpdateWorkflowUseCase } from '../../application/use-cases/update-workflow.use-case';
import { DeleteWorkflowUseCase } from '../../application/use-cases/delete-workflow.use-case';
import { CreateWorkflowDto } from '../../application/dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../../application/dto/update-workflow.dto';
import { ExecuteWorkflowDto } from '../../application/dto/execute-workflow.dto';
import { AddNodeDto, UpdateNodeDto, AddEdgeDto } from '../../application/dto/node-operation.dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly createWorkflowUseCase: CreateWorkflowUseCase,
    private readonly getWorkflowUseCase: GetWorkflowUseCase,
    private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase,
    private readonly updateWorkflowUseCase: UpdateWorkflowUseCase,
    private readonly deleteWorkflowUseCase: DeleteWorkflowUseCase,
  ) {}

  // ─── Workflow CRUD ────────────────────────────────────────────────────────

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
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : pageSize ? parseInt(pageSize, 10) : 10;

    if (userId) {
      return this.getWorkflowUseCase.getByUserId(userId, pageNum, limitNum);
    }

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

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Workflow updated' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkflowDto) {
    this.logger.log(`Updating workflow ${id}`);
    return this.updateWorkflowUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Workflow deleted' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting workflow ${id}`);
    await this.deleteWorkflowUseCase.execute(id);
  }

  // ─── Node operations ──────────────────────────────────────────────────────

  @Post(':id/nodes')
  @ApiOperation({ summary: 'Add a node to a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Node added' })
  async addNode(@Param('id') id: string, @Body() dto: AddNodeDto) {
    this.logger.log(`Adding node ${dto.id} to workflow ${id}`);
    return this.updateWorkflowUseCase.addNode(id, dto);
  }

  @Put(':id/nodes/:nodeId')
  @ApiOperation({ summary: 'Update a node in a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'nodeId', type: String })
  @ApiResponse({ status: 200, description: 'Node updated' })
  async updateNode(
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeDto,
  ) {
    this.logger.log(`Updating node ${nodeId} in workflow ${id}`);
    return this.updateWorkflowUseCase.updateNode(id, nodeId, dto);
  }

  @Delete(':id/nodes/:nodeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a node from a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'nodeId', type: String })
  @ApiResponse({ status: 204, description: 'Node removed' })
  async removeNode(@Param('id') id: string, @Param('nodeId') nodeId: string) {
    this.logger.log(`Removing node ${nodeId} from workflow ${id}`);
    await this.updateWorkflowUseCase.removeNode(id, nodeId);
  }

  // ─── Edge operations ──────────────────────────────────────────────────────

  @Post(':id/edges')
  @ApiOperation({ summary: 'Add an edge to a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Edge added' })
  async addEdge(@Param('id') id: string, @Body() dto: AddEdgeDto) {
    return this.updateWorkflowUseCase.addEdge(id, dto);
  }

  @Delete(':id/edges/:edgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an edge from a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'edgeId', type: String })
  @ApiResponse({ status: 204, description: 'Edge removed' })
  async removeEdge(@Param('id') id: string, @Param('edgeId') edgeId: string) {
    await this.updateWorkflowUseCase.removeEdge(id, edgeId);
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Execute a workflow by ID (path param variant)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 202, description: 'Workflow execution started' })
  async executeById(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() body: { input?: Record<string, unknown> },
  ) {
    this.logger.log(`Executing workflow ${id} for user ${userId}`);
    return this.executeWorkflowUseCase.execute({ workflowId: id, input: body.input }, userId);
  }

  @Post('execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Execute a workflow (body param variant)' })
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

  @Post('executions/:executionId/nodes/:nodeId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a waiting node' })
  @ApiParam({ name: 'executionId', type: String })
  @ApiParam({ name: 'nodeId', type: String })
  async resumeNode(
    @Param('executionId') executionId: string,
    @Param('nodeId') nodeId: string,
    @Body() body: { input: string },
  ) {
    this.executeWorkflowUseCase.resumeNode(executionId, nodeId, body.input);
    return { success: true };
  }
}
