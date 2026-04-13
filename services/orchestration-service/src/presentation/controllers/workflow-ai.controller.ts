import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorkflowAiService } from '../../infrastructure/external/workflow-ai.service';
import { GetWorkflowUseCase } from '../../application/use-cases/get-workflow.use-case';

@ApiTags('Workflow AI')
@Controller('workflows/ai')
export class WorkflowAiController {
  private readonly logger = new Logger(WorkflowAiController.name);

  constructor(
    private readonly workflowAiService: WorkflowAiService,
    private readonly getWorkflowUseCase: GetWorkflowUseCase,
  ) {}

  // ─── Generate ─────────────────────────────────────────────────────────────

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a new workflow from a natural-language prompt' })
  @ApiResponse({ status: 200, description: 'Generated workflow definition with session context' })
  async generate(@Body() body: { prompt: string; modelId: string; sessionId?: string }) {
    if (!body.prompt?.trim()) throw new BadRequestException('prompt is required');
    if (!body.modelId?.trim()) throw new BadRequestException('modelId is required');

    this.logger.log(`Generating workflow with model ${body.modelId}`);
    return this.workflowAiService.generateWorkflow({
      prompt: body.prompt,
      modelId: body.modelId,
      sessionId: body.sessionId,
    });
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  @Post(':workflowId/edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit an existing workflow with AI assistance' })
  @ApiParam({ name: 'workflowId', type: String })
  @ApiResponse({ status: 200, description: 'Updated workflow definition with session context' })
  async edit(
    @Param('workflowId') workflowId: string,
    @Body() body: { prompt: string; modelId: string; sessionId?: string },
  ) {
    if (!body.prompt?.trim()) throw new BadRequestException('prompt is required');
    if (!body.modelId?.trim()) throw new BadRequestException('modelId is required');

    const workflow = await this.getWorkflowUseCase.execute(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    this.logger.log(`Editing workflow ${workflowId} with model ${body.modelId}`);
    return this.workflowAiService.editWorkflow({
      workflowId,
      prompt: body.prompt,
      modelId: body.modelId,
      sessionId: body.sessionId,
      currentDefinition: workflow.definition,
    });
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  @Get('sessions')
  @ApiOperation({ summary: 'List AI sessions (optionally filtered by workflow)' })
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  listSessions(@Query('workflowId') workflowId?: string) {
    return this.workflowAiService.listSessions(workflowId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get an AI session with full message history' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiResponse({ status: 200, description: 'Session data' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.workflowAiService.getSession(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return session;
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an AI session' })
  @ApiParam({ name: 'sessionId', type: String })
  deleteSession(@Param('sessionId') sessionId: string) {
    this.workflowAiService.deleteSession(sessionId);
  }
}
