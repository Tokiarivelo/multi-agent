import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface WorkflowExecutionSummary {
  executionId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  nodeExecutions: unknown;
  error: string | null;
  createdAt: string;
}

export interface PaginatedExecutionSummaries {
  data: WorkflowExecutionSummary[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class GetWorkflowExecutionsUseCase {
  private readonly logger = new Logger(GetWorkflowExecutionsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workflowId: string,
    page = 1,
    limit = 10,
    sortBy: 'createdAt' | 'startedAt' | 'completedAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<PaginatedExecutionSummaries> {
    // Verify workflow exists
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    const skip = (page - 1) * limit;

    const [total, executions] = await Promise.all([
      this.prisma.workflowExecution.count({ where: { workflowId } }),
      this.prisma.workflowExecution.findMany({
        where: { workflowId },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    if (executions.length === 0) {
      return { data: [], total, page, limit };
    }

    const executionIds = executions.map((e) => e.id);

    // Aggregate token usage per execution
    const tokenGroups = await this.prisma.tokenUsage.groupBy({
      by: ['executionId'],
      where: { executionId: { in: executionIds } },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
    });

    const tokenMap = new Map(
      tokenGroups.map((g) => [
        g.executionId,
        {
          totalTokens: g._sum.totalTokens ?? 0,
          inputTokens: g._sum.inputTokens ?? 0,
          outputTokens: g._sum.outputTokens ?? 0,
        },
      ]),
    );

    const data: WorkflowExecutionSummary[] = executions.map((exec) => {
      const tokens = tokenMap.get(exec.id) ?? { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
      const duration =
        exec.startedAt && exec.completedAt
          ? exec.completedAt.getTime() - exec.startedAt.getTime()
          : null;

      return {
        executionId: exec.id,
        status: exec.status,
        startedAt: exec.startedAt?.toISOString() ?? null,
        completedAt: exec.completedAt?.toISOString() ?? null,
        duration,
        totalTokens: tokens.totalTokens,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        nodeExecutions: exec.nodeExecutions,
        error: exec.error ?? null,
        createdAt: exec.createdAt.toISOString(),
      };
    });

    this.logger.log(`Found ${total} executions for workflow ${workflowId}`);
    return { data, total, page, limit };
  }
}
