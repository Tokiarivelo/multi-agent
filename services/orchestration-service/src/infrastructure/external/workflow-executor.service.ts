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
        { input },
      );

      execution.completeNodeExecution(nodeId, input);
      await this.updateExecution(execution);
      this.workflowGateway.sendNodeUpdate(
        execution.id,
        nodeId,
        node.customName || node.type,
        'COMPLETED',
        { input, output: input },
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
      { input },
    );

    try {
      const nodeLogs: string[] = [];
      const output = await this.executeNodeByType(node, input, execution, nodeLogs);

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
        { input, output, logs: nodeLogs.length > 0 ? nodeLogs : undefined },
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
          { input, error: error instanceof Error ? error.message : 'Unknown error' },
        );
        throw error;
      }
    }
  }

  private async executeNodeByType(
    node: any,
    input: any,
    execution?: WorkflowExecution,
    logSink?: string[],
  ): Promise<any> {
    switch (node.type) {
      case NodeType.START:
        return input;

      case NodeType.AGENT: {
        const agentResult = await this.agentClient.executeAgent({
          agentId: node.config.agentId as string,
          input,
          config: node.config,
          toolIds: (node.config.toolIds as string[] | undefined) ?? [],
          subAgents: (node.config.subAgents as any[] | undefined) ?? [],
          maxTokens: node.config.maxTokens as number | undefined,
        });
        if (!agentResult.success) {
          throw new Error(agentResult.error || 'Agent execution failed');
        }

        // ── Execute post-processing pipeline steps ──────────────────────────
        const pipelineSteps: Array<{
          id: string;
          type: 'TOOL' | 'TRANSFORM';
          label: string;
          config: Record<string, any>;
        }> = Array.isArray(node.config.pipelineSteps) ? (node.config.pipelineSteps as any[]) : [];

        let pipelineData: any = agentResult.output;

        for (const step of pipelineSteps) {
          if (step.type === 'TOOL') {
            const toolRes = await this.toolClient.executeTool({
              toolId: step.config.toolId,
              input: pipelineData,
              config: step.config,
            });
            if (!toolRes.success) {
              throw new Error(`Pipeline TOOL step "${step.label}" failed: ${toolRes.error}`);
            }
            pipelineData = toolRes.output;
          } else if (step.type === 'TRANSFORM') {
            const transformLogs: string[] = logSink ?? [];
            pipelineData = await this.workflowExecutionService.transformData(
              pipelineData,
              step.config,
              transformLogs,
            );
          }
        }

        return pipelineData;
      }

      case NodeType.TOOL: {
        const toolResult = await this.toolClient.executeTool({
          toolId: node.config.toolId,
          input,
          config: node.config,
        });
        if (!toolResult.success) {
          throw new Error(toolResult.error || 'Tool execution failed');
        }
        return toolResult.output;
      }

      case NodeType.GITHUB: {
        const res = await this.toolClient.executeTool({
          toolName: 'github_api',
          input: {
            token: node.config.token,
            method: node.config.method,
            endpoint: node.config.endpoint,
            body: node.config.body ? JSON.stringify(node.config.body) : undefined,
          },
        });
        if (!res.success) throw new Error(res.error || 'GitHub execution failed');
        return res.output;
      }

      case NodeType.SLACK: {
        const res = await this.toolClient.executeTool({
          toolName: 'slack_post_message',
          input: {
            token: node.config.token,
            channel: node.config.channel,
            message: node.config.message,
          },
        });
        if (!res.success) throw new Error(res.error || 'Slack execution failed');
        return res.output;
      }

      case NodeType.WHATSAPP: {
        const res = await this.toolClient.executeTool({
          toolName: 'whatsapp_send_message',
          input: {
            token: node.config.token,
            phoneNumberId: node.config.phoneNumberId,
            to: node.config.to,
            message: node.config.message,
          },
        });
        if (!res.success) throw new Error(res.error || 'WhatsApp execution failed');
        return res.output;
      }

      case NodeType.SHELL: {
        const res = await this.toolClient.executeTool({
          toolName: 'shell_execute',
          input: { command: node.config.command },
          config: { timeout: node.config.timeout },
        });
        if (!res.success) throw new Error(res.error || 'Shell execution failed');
        return res.output;
      }

      case NodeType.TRANSFORM: {
        const transformLogs: string[] = logSink ?? [];
        const result = await this.workflowExecutionService.transformData(
          input,
          node.config,
          transformLogs,
        );
        return result;
      }

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
              input,
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
            { input, prompt: resolvedPrompt, output: { response: userInput } },
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

      case NodeType.LOOP: {
        const {
          collection: collectionPath = '',
          itemScript = '',
          filterScript = '',
          maxIterations = 100,
        } = node.config ?? {};

        // Resolve nested dot-path (e.g. "data.items" or "$.results")
        const resolvePath = (obj: any, dotPath: string): any => {
          const cleaned = dotPath.replace(/^\$\.?/, '');
          if (!cleaned) return obj;
          return cleaned.split('.').reduce((acc: any, k: string) => acc?.[k], obj);
        };

        const raw = resolvePath(input, collectionPath);
        const items: any[] = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];

        const cap = Math.min(Number(maxIterations) || 100, 10_000);
        const sliced = items.slice(0, cap);

        if (logSink) {
          logSink.push(
            `[LOG] LOOP: iterating ${sliced.length} item(s) from "${collectionPath || 'root'}"`,
          );
        }

        // Build sandbox console
        const push = (level: string, ...args: any[]) => {
          const line = `[${level}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
          if (logSink) logSink.push(line);
          this.logger.log(line);
        };
        const sandboxConsole = {
          log: (...a: any[]) => push('LOG', ...a),
          warn: (...a: any[]) => push('WARN', ...a),
          error: (...a: any[]) => push('ERROR', ...a),
          info: (...a: any[]) => push('INFO', ...a),
        };

        const results: any[] = [];
        for (let idx = 0; idx < sliced.length; idx++) {
          const item = sliced[idx];

          // Optional filter
          if (filterScript) {
            try {
              const shouldInclude = new Function(
                'item',
                'index',
                'data',
                '$',
                'console',
                filterScript,
              )(item, idx, input, input, sandboxConsole);
              if (!shouldInclude) {
                if (logSink)
                  logSink.push(`[LOG] LOOP: skipping item[${idx}] (filter returned falsy)`);
                continue;
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (logSink) logSink.push(`[ERROR] LOOP filter error at index ${idx}: ${msg}`);
              throw new Error(`Loop filter error at index ${idx}: ${msg}`);
            }
          }

          // Transform script (optional — identity if empty)
          if (itemScript) {
            try {
              const transformed = new Function('item', 'index', 'data', '$', 'console', itemScript)(
                item,
                idx,
                input,
                input,
                sandboxConsole,
              );
              results.push(transformed);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (logSink) logSink.push(`[ERROR] LOOP script error at index ${idx}: ${msg}`);
              throw new Error(`Loop script error at index ${idx}: ${msg}`);
            }
          } else {
            results.push(item);
          }
        }

        if (logSink) logSink.push(`[LOG] LOOP: completed — ${results.length} result(s) produced`);

        return { results, count: results.length, collection: collectionPath };
      }

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

  async testNode(
    workflowId: string,
    nodeId: string,
    input: Record<string, unknown>,
    _userId: string,
  ): Promise<{ input: unknown; output: unknown; error?: string; logs: string[] }> {
    const logs: string[] = [];
    const push = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const node = workflow.definition.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in workflow`);

    push(`Testing node "${node.customName || node.type}" (${node.type})`);
    push(`Input: ${JSON.stringify(input, null, 2)}`);

    try {
      const output = await this.executeNodeByType(node as any, input, undefined, logs);
      push(`Output: ${JSON.stringify(output, null, 2)}`);
      push(`Status: SUCCESS`);
      return { input, output, logs };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      push(`Error: ${errMsg}`);
      push(`Status: FAILED`);
      return { input, output: null, error: errMsg, logs };
    }
  }
}
