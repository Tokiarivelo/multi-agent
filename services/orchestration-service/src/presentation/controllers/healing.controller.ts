import { Body, Controller, Get, Inject, Logger, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WorkflowHealingService } from '../../infrastructure/external/workflow-healing.service';
import { IWorkflowExecutor, WORKFLOW_EXECUTOR } from '../../application/interfaces/workflow-executor.interface';


interface HealRequestDto {
  modelId: string;
  userId?: string;
}

interface ApplyFixRequestDto {
  healingLogId: string;
  modelId: string;
  userId?: string;
}

interface AnalyzeOutcomeDto {
  modelId: string;
  originalRequest?: string; // override if not inferrable from execution.input
  forceLlm?: boolean;
  userId?: string;
}

@Controller('workflows/executions')
export class HealingController {
  private readonly logger = new Logger(HealingController.name);

  constructor(
    private readonly healingService: WorkflowHealingService,
    private readonly prisma: PrismaService,
    @Inject(WORKFLOW_EXECUTOR) private readonly executorService: IWorkflowExecutor,
  ) {}

  // ─── Analyze a failed execution and suggest a fix ─────────────────────────

  @Post(':id/heal')
  async analyzeExecution(
    @Param('id') executionId: string,
    @Body() dto: HealRequestDto,
  ) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { workflow: true },
    });

    if (!execution) {
      return { error: `Execution ${executionId} not found` };
    }

    if (execution.status !== 'FAILED') {
      return { error: 'Only failed executions can be healed' };
    }

    const nodeExecutions = (execution.nodeExecutions as any[]) ?? [];
    const failedNode = nodeExecutions.find((n: any) => n.status === 'FAILED');

    if (!failedNode) {
      return { error: 'No failed node found in execution' };
    }

    const workflowDef = (execution.workflow as any)?.definition ?? {};
    const nodeDefinition = (workflowDef.nodes as any[])?.find(
      (n: any) => n.id === failedNode.nodeId,
    );

    const context = {
      executionId,
      nodeId: failedNode.nodeId,
      nodeName: failedNode.nodeName ?? failedNode.nodeId,
      nodeType: nodeDefinition?.type ?? 'UNKNOWN',
      nodeConfig: nodeDefinition?.config ?? {},
      input: failedNode.input ?? {},
      errorMessage: failedNode.error ?? 'Unknown error',
      retryCount: failedNode.retryCount ?? 0,
    };

    const suggestion = await this.healingService.analyzeError(
      context,
      dto.modelId,
      dto.userId ?? execution.userId,
    );

    const logId = await this.healingService.saveHealingLog(context, suggestion, 'PENDING');

    return {
      healingLogId: logId,
      executionId,
      failedNodeId: failedNode.nodeId,
      failedNodeName: failedNode.nodeName,
      errorMessage: context.errorMessage,
      suggestion,
    };
  }

  // ─── Apply the suggested fix and re-run from the failed node ─────────────

  @Post(':id/apply-fix')
  async applyFix(
    @Param('id') executionId: string,
    @Body() dto: ApplyFixRequestDto,
  ) {
    const [execution, healingLog] = await Promise.all([
      this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        include: { workflow: true },
      }),
      this.prisma.workflowHealingLog.findUnique({
        where: { id: dto.healingLogId },
      }),
    ]);

    if (!execution || !healingLog) {
      return { error: 'Execution or healing log not found' };
    }

    const suggestion = healingLog.suggestion as any;
    const workflow = execution.workflow as any;

    if (!workflow?.definition?.nodes) {
      return { error: 'Workflow definition not found' };
    }

    // Apply fixedConfig to the target node in the workflow definition
    const updatedNodes = (workflow.definition.nodes as any[]).map((node: any) => {
      if (node.id === healingLog.nodeId) {
        return {
          ...node,
          config: {
            ...node.config,
            ...suggestion.fixedConfig,
          },
        };
      }
      return node;
    });

    // Persist the updated workflow definition with the fix applied
    await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        definition: {
          ...workflow.definition,
          nodes: updatedNodes,
        },
        updatedAt: new Date(),
      },
    });

    // Mark healing log as applied
    await this.healingService.updateHealingLogStatus(dto.healingLogId, 'APPLIED');

    // Start a new execution with the patched workflow
    const userId = dto.userId ?? execution.userId;
    const newExecution = await this.executorService.execute(
      workflow.id,
      execution.input ?? {},
      userId,
    );

    this.logger.log(
      `Healing applied for execution ${executionId}, node ${healingLog.nodeId}. ` +
        `New execution: ${newExecution.id}`,
    );

    return {
      success: true,
      newExecutionId: newExecution.id,
      healingLogId: dto.healingLogId,
      fixApplied: suggestion.fixSummary,
    };
  }

  // ─── Reject a suggested fix ───────────────────────────────────────────────

  @Post(':id/reject-fix')
  async rejectFix(
    @Param('id') _executionId: string,
    @Body() body: { healingLogId: string },
  ) {
    await this.healingService.updateHealingLogStatus(body.healingLogId, 'REJECTED');
    return { success: true };
  }

  // ─── Analyze outcome of a COMPLETED execution for functional failures ────

  @Post(':id/analyze-outcome')
  async analyzeOutcome(
    @Param('id') executionId: string,
    @Body() dto: AnalyzeOutcomeDto,
  ) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return { error: `Execution ${executionId} not found` };
    }

    const nodeExecutions = (execution.nodeExecutions as any[]) ?? [];
    const nodeOutputs = nodeExecutions
      .filter((n: any) => n.output !== undefined)
      .map((n: any) => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName ?? n.nodeId,
        nodeType: 'UNKNOWN',
        output: n.output,
        status: n.status,
      }));

    const originalRequest =
      dto.originalRequest ??
      (typeof execution.input === 'string'
        ? execution.input
        : JSON.stringify(execution.input ?? {}));

    const functionalCtx = {
      executionId,
      originalRequest,
      nodeOutputs,
      finalOutput: execution.output,
    };

    const userId = dto.userId ?? execution.userId;
    const result = await this.healingService.detectFunctionalFailure(
      functionalCtx,
      dto.modelId,
      userId,
      dto.forceLlm ?? false,
    );

    let logId: string | undefined;
    if (result.isFunctionalFailure) {
      logId = await this.healingService.saveFunctionalFailureLog(functionalCtx, result, 'PENDING');
    }

    return {
      executionId,
      executionStatus: execution.status,
      ...result,
      healingLogId: logId,
    };
  }

  // ─── List healing history for an execution ────────────────────────────────

  @Get(':id/healing-logs')
  async getHealingLogs(@Param('id') executionId: string) {
    const logs = await this.healingService.getHealingLogs(executionId);
    return { data: logs };
  }
}
