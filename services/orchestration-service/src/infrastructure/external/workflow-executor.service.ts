import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWorkflowExecutor } from '../../application/interfaces/workflow-executor.interface';
import {
  WorkflowExecution,
  ExecutionStatus,
} from '../../domain/entities/workflow-execution.entity';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import { WorkflowExecutionService } from '../../domain/services/workflow-execution.service';
import { NodeType } from '../../domain/entities/workflow.entity';
import { AgentClientService } from './agent-client.service';
import { ToolClientService } from './tool-client.service';
import { PrismaService } from '../database/prisma.service';
import { WorkflowGateway } from '../../presentation/gateways/workflow.gateway';
import { ExecutionStatus as PrismaExecutionStatus } from '@prisma/client';
import { EventEmitter } from 'events';

@Injectable()
export class WorkflowExecutorService implements IWorkflowExecutor {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private readonly maxRetries: number;
  private readonly executionTimeout: number;
  private readonly promptEmitter = new EventEmitter();

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly agentClient: AgentClientService,
    private readonly toolClient: ToolClientService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workflowGateway: WorkflowGateway,
  ) {
    this.maxRetries = this.configService.get<number>('MAX_RETRY_ATTEMPTS', 3);
    this.executionTimeout = this.configService.get<number>('EXECUTION_TIMEOUT', 300000);
  }

  async execute(workflowId: string, input: any, userId: string): Promise<WorkflowExecution> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution = new WorkflowExecution({
      workflowId,
      status: ExecutionStatus.PENDING,
      input,
      userId,
      nodeExecutions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedExecution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: execution.workflowId,
        status: execution.status as unknown as PrismaExecutionStatus,
        input: execution.input,
        userId: execution.userId,
        nodeExecutions: execution.nodeExecutions as any,
      },
    });

    execution.id = savedExecution.id;

    this.executeAsync(execution, workflow).catch((error) => {
      this.logger.error(
        `Async execution failed for ${execution.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    });

    return execution;
  }

  private async executeAsync(execution: WorkflowExecution, workflow: any): Promise<void> {
    try {
      execution.start();
      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);

      const startNodeId = this.workflowExecutionService.findStartNode(workflow);
      if (!startNodeId) {
        throw new Error('No START node found in workflow');
      }

      const context = {
        variables: { ...execution.input },
        executionId: execution.id,
        workflowId: workflow.id,
        userId: execution.userId,
      };

      await this.executeNode(startNodeId, workflow, execution, context);

      if (!execution.isFailed()) {
        execution.complete(context.variables);
      }

      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);
    } catch (error) {
      this.logger.error(
        `Execution ${execution.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      execution.fail(error instanceof Error ? error.message : 'Unknown error');
      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);
    }
  }

  private async executeNode(
    nodeId: string,
    workflow: any,
    execution: WorkflowExecution,
    context: any,
  ): Promise<void> {
    const node = workflow.definition.nodes.find((n: any) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const input = this.workflowExecutionService.buildNodeInput(node, execution, context);

    if (this.workflowExecutionService.isEndNode(workflow, nodeId)) {
      this.logger.log(`Reached END node ${nodeId}`);

      execution.startNodeExecution(nodeId, node.customName || node.type, input);
      await this.updateExecution(execution);
      this.workflowGateway.sendNodeUpdate(
        execution.id,
        nodeId,
        node.customName || node.type,
        'RUNNING',
        input,
      );

      execution.completeNodeExecution(nodeId, input);
      await this.updateExecution(execution);
      this.workflowGateway.sendNodeUpdate(
        execution.id,
        nodeId,
        node.customName || node.type,
        'COMPLETED',
        input,
      );

      return;
    }

    execution.startNodeExecution(nodeId, node.customName || node.type, input);
    await this.updateExecution(execution);
    this.workflowGateway.sendExecutionUpdate(execution);
    this.workflowGateway.sendNodeUpdate(
      execution.id,
      nodeId,
      node.customName || node.type,
      'RUNNING',
      input,
    );

    try {
      const output = await this.executeNodeByType(node, input, execution);

      execution.completeNodeExecution(nodeId, output);
      context.variables = { ...context.variables, ...output };

      const nextNodes = this.workflowExecutionService.determineNextNodes(
        workflow,
        nodeId,
        execution,
      );

      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);
      this.workflowGateway.sendNodeUpdate(
        execution.id,
        nodeId,
        node.customName || node.type,
        'COMPLETED',
        output,
      );

      if (nextNodes.length === 0) {
        this.logger.log(`No next nodes found after ${nodeId}, assuming implicit END of branch`);
      } else {
        for (const nextNodeId of nextNodes) {
          await this.executeNode(nextNodeId, workflow, execution, context);
        }
      }
    } catch (error) {
      this.logger.error(
        `Node ${nodeId} execution failed`,
        error instanceof Error ? error.stack : String(error),
      );

      const nodeExecution = execution.getNodeExecution(nodeId);
      if (
        nodeExecution &&
        this.workflowExecutionService.shouldRetry(node, nodeExecution, this.maxRetries)
      ) {
        execution.incrementRetryCount(nodeId);
        await this.updateExecution(execution);
        this.logger.log(`Retrying node ${nodeId}, attempt ${nodeExecution.retryCount + 1}`);
        await this.executeNode(nodeId, workflow, execution, context);
      } else {
        execution.failNodeExecution(
          nodeId,
          error instanceof Error ? error.message : 'Unknown error',
        );
        await this.updateExecution(execution);
        this.workflowGateway.sendNodeUpdate(
          execution.id,
          nodeId,
          node.customName || node.type,
          'FAILED',
          { error: error instanceof Error ? error.message : 'Unknown error' },
        );
        throw error;
      }
    }
  }

  private async executeNodeByType(
    node: any,
    input: any,
    execution?: WorkflowExecution,
  ): Promise<any> {
    switch (node.type) {
      case NodeType.START:
        return input;

      case NodeType.AGENT:
        const agentResult = await this.agentClient.executeAgent({
          agentId: node.config.agentId,
          input,
          config: node.config,
        });
        if (!agentResult.success) {
          throw new Error(agentResult.error || 'Agent execution failed');
        }
        return agentResult.output;

      case NodeType.TOOL:
        const toolResult = await this.toolClient.executeTool({
          toolId: node.config.toolId,
          input,
          config: node.config,
        });
        if (!toolResult.success) {
          throw new Error(toolResult.error || 'Tool execution failed');
        }
        return toolResult.output;

      case NodeType.TRANSFORM:
        return this.workflowExecutionService.transformData(input, node.config);

      case NodeType.CONDITIONAL:
        return input;

      case NodeType.PROMPT: {
        const promptTemplate = node.config?.prompt as string;
        if (!promptTemplate) return { prompt: '' };

        // Resolve {{variables}} from input
        const resolvedPrompt = promptTemplate.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
          const value = path
            .trim()
            .split('.')
            .reduce((acc: any, key: string) => acc?.[key], input);
          return value !== undefined ? String(value) : match;
        });

        if (execution && execution.id) {
          execution.waitNodeExecution(node.id);
          await this.updateExecution(execution);
          this.workflowGateway.sendExecutionUpdate(execution);
          this.workflowGateway.sendNodeUpdate(
            execution.id,
            node.id,
            node.customName || node.type,
            'WAITING_INPUT',
            {
              prompt: resolvedPrompt,
            },
          );

          this.logger.log(
            `Prompt node waiting. Registering listener for: resume_${execution.id}_${node.id}`,
          );
          const userInput = await new Promise((resolve) => {
            this.promptEmitter.once(`resume_${execution.id}_${node.id}`, (data) => {
              this.logger.log(
                `Prompt listener fired for: resume_${execution.id}_${node.id} with data: ${data}`,
              );
              resolve(data);
            });
          });

          // Resume status
          execution.startNodeExecution(node.id, node.customName || node.type, input);
          await this.updateExecution(execution);
          this.workflowGateway.sendExecutionUpdate(execution);
          this.workflowGateway.sendNodeUpdate(
            execution.id,
            node.id,
            node.customName || node.type,
            'RUNNING',
          );

          return { prompt: resolvedPrompt, response: userInput };
        }

        return { prompt: resolvedPrompt };
      }

      case NodeType.TEXT:
        return { text: node.config?.text || '' };

      case NodeType.FILE:
        return { files: node.config?.files || [] };

      case NodeType.END:
        return input;

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async updateExecution(execution: WorkflowExecution): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: execution.status as PrismaExecutionStatus,
        output: execution.output,
        error: execution.error,
        nodeExecutions: execution.nodeExecutions as any,
        currentNodeId: execution.currentNodeId,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        updatedAt: new Date(),
      },
    });
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution | null> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return null;
    }

    return new WorkflowExecution({
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status as ExecutionStatus,
      input: execution.input ?? undefined,
      output: execution.output ?? undefined,
      error: (execution.error === null ? undefined : execution.error) as string | undefined,
      nodeExecutions: execution.nodeExecutions as any[],
      currentNodeId: (execution.currentNodeId === null ? undefined : execution.currentNodeId) as
        | string
        | undefined,
      startedAt: (execution.startedAt === null ? undefined : execution.startedAt) as
        | Date
        | undefined,
      completedAt: (execution.completedAt === null ? undefined : execution.completedAt) as
        | Date
        | undefined,
      userId: execution.userId,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    });
  }

  async cancelExecution(executionId: string): Promise<void> {
    const execution = await this.getExecutionStatus(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.isRunning()) {
      execution.cancel();
      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);
    }
  }

  resumePromptNode(executionId: string, nodeId: string, response: string): void {
    this.logger.log(`Emitting resume event for: resume_${executionId}_${nodeId}`);
    const hasListeners = this.promptEmitter.listenerCount(`resume_${executionId}_${nodeId}`);
    if (hasListeners === 0) {
      this.logger.warn(`No listeners found for event: resume_${executionId}_${nodeId}`);
    }
    this.promptEmitter.emit(`resume_${executionId}_${nodeId}`, response);
  }
}
