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
import { GetWorkflowExecutionsUseCase } from '../../application/use-cases/get-workflow-executions.use-case';
import { CreateWorkflowDto } from '../../application/dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../../application/dto/update-workflow.dto';
import { ExecuteWorkflowDto } from '../../application/dto/execute-workflow.dto';
import { AddNodeDto, UpdateNodeDto, AddEdgeDto } from '../../application/dto/node-operation.dto';
import { WorkflowHealingService } from '../../infrastructure/external/workflow-healing.service';
import { spawn } from 'child_process';

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
    private readonly getWorkflowExecutionsUseCase: GetWorkflowExecutionsUseCase,
    private readonly healingService: WorkflowHealingService,
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

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get paginated execution history for a workflow with token metrics' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'startedAt', 'completedAt', 'status'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getExecutions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const validSortFields = ['createdAt', 'startedAt', 'completedAt', 'status'] as const;
    const resolvedSortBy = validSortFields.includes(sortBy as any)
      ? (sortBy as (typeof validSortFields)[number])
      : 'createdAt';
    const resolvedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    return this.getWorkflowExecutionsUseCase.execute(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      resolvedSortBy,
      resolvedSortOrder,
    );
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

  @Post(':id/nodes/:nodeId/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a single node in isolation with manual input' })
  @ApiParam({ name: 'id', description: 'Workflow ID', type: String })
  @ApiParam({ name: 'nodeId', description: 'Node ID to test', type: String })
  @ApiResponse({ status: 200, description: 'Node test result with input, output and logs' })
  async testNode(
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Query('userId') userId: string,
    @Body()
    body: {
      input?: Record<string, unknown>;
      type?: string;
      config?: Record<string, unknown>;
      executionId?: string;
    },
  ) {
    this.logger.log(`Testing node ${nodeId} in workflow ${id} for user ${userId}`);
    return this.executeWorkflowUseCase.testNode(
      id,
      nodeId,
      body.input ?? {},
      userId,
      body.type,
      body.config,
      body.executionId,
    );
  }

  @Post(':id/nodes/:nodeId/analyze-test-outcome')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze the functional outcome of a test node run with optional custom prompt',
  })
  async analyzeTestOutcome(
    @Param('id') workflowId: string,
    @Param('nodeId') nodeId: string,
    @Query('userId') userId: string,
    @Body()
    body: {
      modelId: string;
      output: unknown;
      input?: unknown;
      nodeType?: string;
      nodeName?: string;
      forceLlm?: boolean;
      /** Optional user-defined analysis instructions */
      prompt?: string;
      /** Current tool IDs on this node — returned alongside the result so the UI can display suggested changes */
      currentTools?: string[];
      /** Available tools in the workflow */
      availableTools?: { id: string; name: string }[];
    },
  ) {
    const ctx = {
      executionId: `test-${workflowId}-${nodeId}`,
      originalRequest: body.prompt
        ? `${body.prompt}\n\nNode input: ${JSON.stringify(body.input ?? {})}`
        : JSON.stringify(body.input ?? {}),
      nodeOutputs: [
        {
          nodeId,
          nodeName: body.nodeName ?? nodeId,
          nodeType: body.nodeType ?? 'UNKNOWN',
          output: body.output,
          status: 'COMPLETED',
        },
      ],
      finalOutput: body.output,
    };

    const result = await this.healingService.detectFunctionalFailure(
      ctx,
      body.modelId,
      userId,
      body.forceLlm ?? !!body.prompt, // force LLM when user provided a custom prompt
      body.prompt,
      body.currentTools,
      body.availableTools,
    );

    let healingLogId: string | undefined;
    if (result.isFunctionalFailure) {
      healingLogId = await this.healingService.saveFunctionalFailureLog(
        ctx,
        result,
        'PENDING',
        true,
      );
    }

    return { ...result, healingLogId, currentTools: body.currentTools ?? [] };
  }

  // ─── Workspace helpers ────────────────────────────────────────────────────

  /**
   * Opens the given absolute folder path in the native OS file manager.
   * Works only when the server runs on the same machine as the user (local dev).
   * Uses: xdg-open (Linux), open (macOS), explorer (Windows).
   */
  @Post('reveal-folder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reveal a folder in the native OS file manager (local dev only)' })
  @ApiResponse({ status: 200, description: 'Folder opened in file manager' })
  @ApiResponse({ status: 400, description: 'Invalid or relative path' })
  async revealFolder(@Body() body: { path: string }) {
    const { path: folderPath } = body;

    // Security: reject anything that isn't a clear absolute path
    const isAbsolute =
      typeof folderPath === 'string' &&
      (folderPath.startsWith('/') || /^[A-Za-z]:[/\\]/.test(folderPath));
    const isRelative =
      !folderPath ||
      folderPath === '.' ||
      folderPath === '..' ||
      folderPath.startsWith('./') ||
      folderPath.startsWith('../') ||
      folderPath.startsWith('.\\') ||
      folderPath.startsWith('..\\');

    if (!isAbsolute || isRelative) {
      return {
        success: false,
        error: `Invalid path "${folderPath}". Must be an absolute path (e.g. /home/user/project).`,
      };
    }

    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer' : 'xdg-open';

    this.logger.log(`Revealing folder [${platform}]: ${cmd} "${folderPath}"`);
    spawn(cmd, [folderPath], { detached: true, stdio: 'ignore' }).unref();

    return { success: true, path: folderPath };
  }
}
