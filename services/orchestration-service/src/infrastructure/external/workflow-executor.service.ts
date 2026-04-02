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
    let context: any;

    try {
      execution.start();
      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);

      const startNodeId = this.workflowExecutionService.findStartNode(workflow);
      if (!startNodeId) {
        throw new Error('No START node found in workflow');
      }

      context = {
        variables: { ...execution.input },
        executionId: execution.id,
        workflowId: workflow.id,
        userId: execution.userId,
      };

      await this.executeNode(startNodeId, workflow, execution, context);

      const hasFailedNodes = execution.nodeExecutions.some((n) => n.status === 'FAILED');

      if (hasFailedNodes) {
        execution.fail('One or more nodes failed during execution');
      } else if (!execution.isFailed()) {
        execution.complete(context.variables);
      }

      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);

      this.saveExecutionLogs(execution, workflow.id, context);
    } catch (error) {
      this.logger.error(
        `Execution ${execution.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      execution.fail(error instanceof Error ? error.message : 'Unknown error');
      await this.updateExecution(execution);
      this.workflowGateway.sendExecutionUpdate(execution);

      this.saveExecutionLogs(
        execution,
        workflow.id,
        context || { variables: { ...execution.input } },
      );
    }
  }

  private saveExecutionLogs(execution: WorkflowExecution, workflowId: string, context: any) {
    if (context?.variables?.outputLogsToFile && context?.variables?.workspaceId) {
      let logText = `Execution ID: ${execution.id}\nWorkflow ID: ${workflowId}\nStatus: ${execution.status}\n\n`;
      for (const ne of execution.nodeExecutions as any[]) {
        logText += `--- Node: ${ne.nodeName} (${ne.nodeId}) [${ne.status}] ---\n`;
        if (ne.input) logText += `Input: ${JSON.stringify(ne.input, null, 2)}\n`;
        if (ne.output) logText += `Output: ${JSON.stringify(ne.output, null, 2)}\n`;
        if (ne.error) logText += `Error: ${ne.error}\n`;
        if (ne.logs && Array.isArray(ne.logs) && ne.logs.length > 0) {
          logText += `Logs:\n${ne.logs.join('\n')}\n`;
        }
        logText += `\n`;
      }

      try {
        const requestId = `log_${execution.id}_${Date.now()}`;
        this.workflowGateway.sendWorkspaceRequest(execution.id, requestId, 'write', {
          filePath: `logs/execution_${execution.id}.log`,
          content: logText,
          workspaceId: context.variables.workspaceId,
        });
        this.logger.log(`Requested saving logs to workspace for execution ${execution.id}`);
      } catch (logErr) {
        this.logger.error(
          `Failed to save logs to workspace`,
          logErr instanceof Error ? logErr.stack : String(logErr),
        );
      }
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
      // Strict Mode: validate input schema before execution
      if (node.config?.strictMode && Array.isArray(node.config.inputFields)) {
        const inputErrors = this.validateSchema(input, node.config.inputFields, 'input');
        if (inputErrors.length > 0) {
          throw new Error(
            `[Strict Mode] Node "${node.customName || node.type}" input validation failed:\n${inputErrors.join('\n')}`,
          );
        }
      }

      const nodeLogs: string[] = [];
      const output = await this.executeNodeByType(node, input, context, execution, nodeLogs);

      // Strict Mode: validate output schema after execution
      if (node.config?.strictMode && Array.isArray(node.config.outputFields)) {
        const outputErrors = this.validateSchema(output, node.config.outputFields, 'output');
        if (outputErrors.length > 0) {
          throw new Error(
            `[Strict Mode] Node "${node.customName || node.type}" output validation failed:\n${outputErrors.join('\n')}`,
          );
        }
      }

      execution.completeNodeExecution(nodeId, output);

      const outputObj =
        typeof output === 'object' && output !== null && !Array.isArray(output)
          ? output
          : { [node.customName || node.type || nodeId]: output };

      Object.assign(context.variables, outputObj);

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
        await Promise.allSettled(
          nextNodes.map((nextNodeId) => this.executeNode(nextNodeId, workflow, execution, context)),
        );
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
      }
    }
  }

  private async executeNodeByType(
    node: any,
    input: any,
    context: any,
    execution?: WorkflowExecution,
    logSink?: string[],
  ): Promise<any> {
    switch (node.type) {
      case NodeType.START:
        return input;

      case NodeType.AGENT: {
        // Propagate the active workspace path so the agent can use it as cwd
        // for file_read, pdf_read, and shell_execute without manual configuration.
        // context.variables.cwd is set by the frontend from the active workspace's nativePath.
        const workspacePath =
          (node.config.workspacePath as string | undefined) ||
          (typeof context?.variables?.cwd === 'string' ? context.variables.cwd : undefined);

        const agentResult = await this.agentClient.executeAgent({
          agentId: node.config.agentId as string,
          input,
          config: {
            ...node.config,
            ...(workspacePath ? { workspacePath } : {}),
          },
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
        const rawCwd =
          node.config.cwd ||
          (input?.cwd && typeof input.cwd === 'string' ? input.cwd : null) ||
          (context?.variables?.cwd && typeof context.variables.cwd === 'string'
            ? context.variables.cwd
            : null);

        // Guard: cwd must be set and must be an absolute server-side path.
        // Reject relative paths (./, ../, plain names) to prevent accidental writes
        // outside the configured workspace.
        if (!rawCwd) {
          throw new Error(
            '[WORKSPACE_SETUP_REQUIRED] SHELL node requires a working directory (cwd). ' +
              'Set a valid absolute Path in your workspace (e.g. /home/user/project).',
          );
        }

        // eslint-disable-next-line no-useless-escape
        const isAbsoluteCwd = rawCwd.startsWith('/') || /^[A-Za-z]:[/\\]/.test(rawCwd);
        // prettier-ignore
        const isRelativeCwd = rawCwd === '.' || rawCwd === '..' || rawCwd.startsWith('./') || rawCwd.startsWith('../') || rawCwd.startsWith('.\\') || rawCwd.startsWith('..\\');

        if (isRelativeCwd || !isAbsoluteCwd) {
          throw new Error(
            `SHELL node: invalid cwd "${rawCwd}". ` +
              'cwd must be an absolute path (e.g. /home/user/project or C:\\Users\\user\\project). ' +
              'Relative paths like ./ or ../ are not permitted.',
          );
        }

        const cwd = rawCwd;

        const res = await this.toolClient.executeTool({
          toolName: 'shell_execute',
          input: {
            command: node.config.command,
            cwd,
          },
          config: { timeout: node.config.timeout },
        });
        if (!res.success) throw new Error(res.error || 'Shell execution failed');

        const shellOutput = res.output?.success && res.output?.data ? res.output.data : res.output;

        if (logSink) {
          logSink.push(`[SHELL] Executing command: ${node.config.command}`);
          logSink.push(`[SHELL] Context CWD: ${context?.variables?.cwd || 'none'}`);
          logSink.push(`[SHELL] Input CWD: ${input?.cwd || 'none'}`);
          logSink.push(`[SHELL] Config CWD: ${node.config.cwd || 'none'}`);
          logSink.push(`[SHELL] Resolved CWD: ${cwd}`);

          if (shellOutput?.stdout)
            logSink.push(`[LOG] STDOUT: ${String(shellOutput.stdout).trim()}`);
          if (shellOutput?.stderr)
            logSink.push(`[ERROR] STDERR: ${String(shellOutput.stderr).trim()}`);
        }

        if (shellOutput?.code !== 0 && shellOutput?.code !== undefined) {
          throw new Error(
            shellOutput.error || shellOutput.stderr || 'Shell command returned non-zero exit code',
          );
        }

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

      case NodeType.WORKSPACE_READ: {
        const filePath = node.config?.filePath as string | undefined;
        if (!filePath) {
          throw new Error('WORKSPACE_READ node requires a filePath in config');
        }
        if (!execution) {
          throw new Error('WORKSPACE_READ requires an active execution context');
        }

        const requestId = `${execution.id}_${node.id}_${Date.now()}`;
        const workspaceId =
          (node.config?.workspaceId as string | undefined) ||
          (context?.variables?.workspaceId as string | undefined);
        this.workflowGateway.sendWorkspaceRequest(execution.id, requestId, 'read', {
          filePath,
          ...(workspaceId ? { workspaceId } : {}),
        });

        const response = await new Promise<{ result?: unknown; error?: string }>((resolve) => {
          const emitter = this.workflowGateway.getWorkspaceEmitter();
          const timeoutMs = 30_000;
          const timer = setTimeout(() => {
            emitter.removeAllListeners(`ws_response_${requestId}`);
            resolve({ error: 'workspace:response timeout after 30s' });
          }, timeoutMs);

          emitter.once(`ws_response_${requestId}`, (data: { result?: unknown; error?: string }) => {
            clearTimeout(timer);
            resolve(data);
          });
        });

        if (response.error) throw new Error(response.error);
        return response.result ?? { content: '', path: filePath };
      }

      case NodeType.WORKSPACE_WRITE: {
        const filePath = node.config?.filePath as string | undefined;
        if (!filePath) {
          throw new Error('WORKSPACE_WRITE node requires a filePath in config');
        }
        if (!execution) {
          throw new Error('WORKSPACE_WRITE requires an active execution context');
        }

        // Resolve template variables from input: {{variable}}
        const rawContent = (node.config?.content as string) ?? '';
        const resolvedContent = rawContent
          ? rawContent.replace(/\{\{([^}]+)\}\}/g, (_match: string, key: string) => {
              const val = key
                .trim()
                .split('.')
                .reduce((acc: unknown, k: string) => {
                  if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k];
                  return undefined;
                }, input as unknown);
              return val !== undefined ? String(val) : '';
            })
          : JSON.stringify(typeof input === 'object' ? input : { value: input }, null, 2);

        const requestId = `${execution.id}_${node.id}_${Date.now()}`;
        const workspaceIdWrite =
          (node.config?.workspaceId as string | undefined) ||
          (context?.variables?.workspaceId as string | undefined);
        this.workflowGateway.sendWorkspaceRequest(execution.id, requestId, 'write', {
          filePath,
          content: resolvedContent,
          ...(workspaceIdWrite ? { workspaceId: workspaceIdWrite } : {}),
        });

        const response = await new Promise<{ result?: unknown; error?: string }>((resolve) => {
          const emitter = this.workflowGateway.getWorkspaceEmitter();
          const timeoutMs = 30_000;
          const timer = setTimeout(() => {
            emitter.removeAllListeners(`ws_response_${requestId}`);
            resolve({ error: 'workspace:response timeout after 30s' });
          }, timeoutMs);

          emitter.once(`ws_response_${requestId}`, (data: { result?: unknown; error?: string }) => {
            clearTimeout(timer);
            resolve(data);
          });
        });

        if (response.error) throw new Error(response.error);
        return response.result ?? { written: true, path: filePath };
      }

      case NodeType.SUBWORKFLOW: {
        const subWorkflowId = node.config?.workflowId as string | undefined;
        if (!subWorkflowId) {
          throw new Error('SUBWORKFLOW node requires a workflowId in config');
        }

        // Guard against infinite recursion: a sub-workflow cannot call itself
        if (subWorkflowId === context?.workflowId) {
          throw new Error(
            `SUBWORKFLOW node references the current workflow (${subWorkflowId}). Circular sub-workflow calls are not allowed.`,
          );
        }

        const subWorkflow = await this.workflowRepository.findById(subWorkflowId);
        if (!subWorkflow) {
          throw new Error(`SUBWORKFLOW: referenced workflow "${subWorkflowId}" not found`);
        }

        // Map input overrides from node config
        const inputOverrides = (node.config?.inputMapping as Record<string, string>) ?? {};
        const subInput: Record<string, unknown> = { ...context.variables };
        for (const [subKey, parentKey] of Object.entries(inputOverrides)) {
          const val = context.variables?.[parentKey];
          if (val !== undefined) subInput[subKey] = val;
        }

        // Apply inputSchema: inject defaults for missing keys, validate required fields
        const inputSchema = (subWorkflow.definition?.inputSchema ?? []) as Array<{
          key: string;
          required?: boolean;
          defaultValue?: unknown;
        }>;
        const inputErrors: string[] = [];
        for (const field of inputSchema) {
          if (subInput[field.key] === undefined) {
            if (field.defaultValue !== undefined) {
              subInput[field.key] = field.defaultValue;
            } else if (field.required) {
              inputErrors.push(
                `SUBWORKFLOW "${subWorkflow.name}": required input "${field.key}" is missing and has no default`,
              );
            }
          }
        }
        if (inputErrors.length > 0) {
          throw new Error(inputErrors.join('; '));
        }

        if (logSink) {
          logSink.push(
            `[SUBWORKFLOW] Starting referenced workflow "${subWorkflow.name}" (${subWorkflowId})`,
          );
        }

        // Create a child execution record
        const childExecution = new WorkflowExecution({
          workflowId: subWorkflowId,
          status: ExecutionStatus.PENDING,
          input: subInput,
          userId: context.userId,
          nodeExecutions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const savedChild = await this.prisma.workflowExecution.create({
          data: {
            workflowId: childExecution.workflowId,
            status: childExecution.status as unknown as PrismaExecutionStatus,
            input: childExecution.input,
            userId: childExecution.userId,
            nodeExecutions: childExecution.nodeExecutions as any,
          },
        });
        childExecution.id = savedChild.id;

        // Build child context (inherit parent userId + workspace info, but fresh variables)
        const childContext = {
          variables: { ...subInput },
          executionId: childExecution.id,
          workflowId: subWorkflowId,
          userId: context.userId,
        };

        // Run the child workflow inline (awaited, so the parent blocks until it completes)
        childExecution.start();
        await this.prisma.workflowExecution.update({
          where: { id: childExecution.id },
          data: {
            status: childExecution.status as unknown as PrismaExecutionStatus,
            startedAt: childExecution.startedAt,
            updatedAt: new Date(),
          },
        });
        this.workflowGateway.sendExecutionUpdate(childExecution);

        const startNodeId = this.workflowExecutionService.findStartNode(subWorkflow);
        if (!startNodeId) {
          throw new Error(`SUBWORKFLOW: referenced workflow "${subWorkflowId}" has no START node`);
        }

        await this.executeNode(startNodeId, subWorkflow, childExecution, childContext);

        const hasFailedSubNodes = childExecution.nodeExecutions.some(
          (n: any) => n.status === 'FAILED',
        );
        if (hasFailedSubNodes) {
          childExecution.fail('One or more sub-workflow nodes failed');
        } else if (!childExecution.isFailed()) {
          childExecution.complete(childContext.variables);
        }

        await this.prisma.workflowExecution.update({
          where: { id: childExecution.id },
          data: {
            status: childExecution.status as unknown as PrismaExecutionStatus,
            output: childExecution.output,
            error: childExecution.error,
            nodeExecutions: childExecution.nodeExecutions as any,
            completedAt: childExecution.completedAt,
            updatedAt: new Date(),
          },
        });
        this.workflowGateway.sendExecutionUpdate(childExecution);

        if (childExecution.isFailed()) {
          throw new Error(`SUBWORKFLOW "${subWorkflow.name}" failed: ${childExecution.error}`);
        }

        if (logSink) {
          logSink.push(
            `[SUBWORKFLOW] "${subWorkflow.name}" completed. Child execution ID: ${childExecution.id}`,
          );
        }

        // Map output back: apply outputMapping overrides, then filter by outputSchema
        const outputMapping = (node.config?.outputMapping as Record<string, string>) ?? {};
        const rawChildVars: Record<string, unknown> = { ...(childContext.variables ?? {}) };

        // Apply explicit output key renaming from the node's outputMapping
        for (const [parentKey, subKey] of Object.entries(outputMapping)) {
          const val = rawChildVars[subKey];
          if (val !== undefined) rawChildVars[parentKey] = val;
        }

        // If the child workflow declares an outputSchema, expose ONLY those keys
        // (plus internal _meta keys). If no schema, pass everything through.
        const outputSchema = (subWorkflow.definition?.outputSchema ?? []) as Array<{ key: string }>;
        let exposedVars: Record<string, unknown>;
        if (outputSchema.length > 0) {
          exposedVars = {};
          for (const field of outputSchema) {
            if (rawChildVars[field.key] !== undefined) {
              exposedVars[field.key] = rawChildVars[field.key];
            }
          }
          // Also include any explicitly mapped output keys
          for (const parentKey of Object.keys(outputMapping)) {
            if (rawChildVars[parentKey] !== undefined) {
              exposedVars[parentKey] = rawChildVars[parentKey];
            }
          }
        } else {
          exposedVars = rawChildVars;
        }

        const subOutput: Record<string, unknown> = {
          ...exposedVars,
          _subWorkflowId: subWorkflowId,
          _subExecutionId: childExecution.id,
          _subWorkflowName: subWorkflow.name,
        };

        return subOutput;
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
    userId: string,
    nodeType?: string,
    nodeConfig?: Record<string, unknown>,
    executionId?: string,
  ): Promise<{ input: unknown; output: unknown; error?: string; logs: string[] }> {
    const logs: string[] = [];
    const push = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

    push(
      `Testing node "${nodeId}" - type: ${nodeType || 'original'}, config: ${
        nodeConfig ? 'edited' : 'original'
      }${executionId ? `, execution: ${executionId}` : ''}`,
    );
    push(`Input: ${JSON.stringify(input, null, 2)}`);

    let node: any;
    let execution: WorkflowExecution | undefined;

    if (executionId) {
      execution = (await this.getExecutionStatus(executionId)) ?? undefined;
    }

    if (nodeType && nodeConfig) {
      node = {
        id: nodeId,
        type: nodeType,
        config: nodeConfig,
      };
    } else {
      const workflow = await this.workflowRepository.findById(workflowId);
      if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

      node = workflow.definition.nodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found in workflow`);
    }

    try {
      // Strict Mode: validate input schema before test execution
      if (node.config?.strictMode && Array.isArray(node.config.inputFields)) {
        const inputErrors = this.validateSchema(input, node.config.inputFields, 'input');
        if (inputErrors.length > 0) {
          const msg = `[Strict Mode] Input validation failed:\n${inputErrors.join('\n')}`;
          push(msg);
          return { input, output: null, error: msg, logs };
        }
      }

      const output = await this.executeNodeByType(
        node,
        input,
        {
          variables: { ...input, ...(executionId ? { executionId } : {}), workflowId, userId },
          executionId,
          workflowId,
          userId,
        },
        execution,
        logs,
      );
      // Strict Mode: validate output schema after test execution
      if (node.config?.strictMode && Array.isArray(node.config.outputFields)) {
        const outputErrors = this.validateSchema(output, node.config.outputFields, 'output');
        if (outputErrors.length > 0) {
          const msg = `[Strict Mode] Output validation failed:\n${outputErrors.join('\n')}`;
          push(msg);
          push(`Status: FAILED`);
          return { input, output, error: msg, logs };
        }
      }

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

  /**
   * Validates a value against an array of SchemaField definitions.
   * Returns a list of error messages (empty = valid).
   */
  private validateSchema(
    value: any,
    fields: Array<{ name: string; type: string; required: boolean }>,
    direction: 'input' | 'output',
  ): string[] {
    const errors: string[] = [];

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(
        `  Expected ${direction} to be an object, got ${Array.isArray(value) ? 'array' : typeof value}`,
      );
      return errors;
    }

    for (const field of fields) {
      const fieldValue = value[field.name];
      const isMissing = fieldValue === undefined || fieldValue === null;

      if (field.required && isMissing) {
        errors.push(`  Missing required ${direction} field: "${field.name}"`);
        continue;
      }

      if (!isMissing && field.type !== 'any') {
        const actualType = Array.isArray(fieldValue) ? 'array' : typeof fieldValue;
        const expectedType = field.type;

        if (actualType !== expectedType) {
          errors.push(`  Field "${field.name}": expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    return errors;
  }
}
