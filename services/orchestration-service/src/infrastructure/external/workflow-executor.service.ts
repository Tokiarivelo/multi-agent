import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { WorkflowHealingService } from './workflow-healing.service';

class ExecutionCancelledError extends Error {
  constructor(executionId: string) {
    super(`Execution ${executionId} was cancelled`);
    this.name = 'ExecutionCancelledError';
  }
}

@Injectable()
export class WorkflowExecutorService implements IWorkflowExecutor {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private readonly maxRetries: number;
  private readonly promptEmitter = new EventEmitter();
  private readonly cancelledExecutions = new Set<string>();

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly agentClient: AgentClientService,
    private readonly toolClient: ToolClientService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workflowGateway: WorkflowGateway,
    private readonly healingService: WorkflowHealingService,
  ) {
    this.maxRetries = this.configService.get<number>('MAX_RETRY_ATTEMPTS', 3);
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

      // ── Functional failure detection (non-blocking, runs after completion) ──
      if (!hasFailedNodes && execution.isCompleted()) {
        this.detectFunctionalFailureAsync(execution, context).catch((err) => {
          this.logger.warn(
            `Functional failure detection error for ${execution.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    } catch (error) {
      if (error instanceof ExecutionCancelledError) {
        this.logger.log(`Execution ${execution.id} cancelled`);
        if (execution.status !== ExecutionStatus.CANCELLED) {
          execution.cancel();
          await this.updateExecution(execution);
          this.workflowGateway.sendExecutionUpdate(execution);
        }
      } else {
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
    } finally {
      this.cancelledExecutions.delete(execution.id);
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
    if (this.cancelledExecutions.has(execution.id)) {
      throw new ExecutionCancelledError(execution.id);
    }

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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const stackTrace = error instanceof Error ? error.stack : undefined;

        // ── Auto-healing: attempt AI-assisted fix when retries are exhausted ──
        const autoHealEnabled = this.configService.get<boolean>('AUTO_HEAL_ENABLED', true);
        const healingModelId = this.configService.get<string>('HEALING_MODEL_ID', '');

        if (autoHealEnabled && healingModelId) {
          try {
            const healingContext = {
              executionId: execution.id,
              nodeId,
              nodeName: node.customName || node.type,
              nodeType: node.type,
              nodeConfig: node.config ?? {},
              input,
              errorMessage,
              stackTrace,
              retryCount: nodeExecution?.retryCount ?? this.maxRetries,
            };

            const suggestion = await this.healingService.analyzeError(
              healingContext,
              healingModelId,
              context.userId,
            );

            await this.healingService.saveHealingLog(healingContext, suggestion, 'PENDING');

            if (
              suggestion.strategy === 'AUTO_FIX' &&
              suggestion.confidence >= 0.75 &&
              Object.keys(suggestion.fixedConfig).length > 0
            ) {
              this.logger.log(
                `[AUTO-HEAL] Applying fix for node ${nodeId}: ${suggestion.fixSummary}`,
              );

              // Patch node config in-memory and retry once
              node.config = { ...node.config, ...suggestion.fixedConfig };
              execution.incrementRetryCount(nodeId);
              await this.updateExecution(execution);

              this.workflowGateway.sendNodeUpdate(
                execution.id,
                nodeId,
                node.customName || node.type,
                'RUNNING',
                {
                  input,
                  healing: { applied: true, fixSummary: suggestion.fixSummary },
                },
              );

              await this.executeNode(nodeId, workflow, execution, context);
              return;
            }
          } catch (healErr) {
            this.logger.warn(
              `[AUTO-HEAL] Analysis failed for node ${nodeId}: ${healErr instanceof Error ? healErr.message : String(healErr)}`,
            );
          }
        }

        execution.failNodeExecution(nodeId, errorMessage);
        await this.updateExecution(execution);
        this.workflowGateway.sendNodeUpdate(
          execution.id,
          nodeId,
          node.customName || node.type,
          'FAILED',
          { input, error: errorMessage },
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

        this.logger.log(
          `[AGENT node] executionId=${context?.executionId ?? 'MISSING'} nodeId=${node.id} workflowId=${context?.workflowId ?? 'MISSING'}`,
        );

        const agentCallConfig = {
          agentId: node.config.agentId as string,
          input,
          config: {
            ...node.config,
            ...(workspacePath ? { workspacePath } : {}),
            userId: context?.userId,
            workflowId: context?.workflowId,
            executionId: context?.executionId,
            nodeId: node.id,
            isTest: context?.isTest ?? false,
          },
          toolIds: (node.config.toolIds as string[] | undefined) ?? [],
          subAgents: (node.config.subAgents as any[] | undefined) ?? [],
          maxTokens: node.config.maxTokens as number | undefined,
        };

        let agentResult = await this.agentClient.executeAgent(agentCallConfig);
        if (!agentResult.success) {
          throw new Error(agentResult.error || 'Agent execution failed');
        }

        console.log('agentResult :>> ', JSON.stringify(agentResult, null, 2));

        // ── Smart Ask-user: auto-detect __ASK_USER__ sentinel ──────────────
        //
        // The agent embeds the sentinel ANYWHERE in its response text:
        //   __ASK_USER__:{"question":"...","type":"...","choices":[...]}
        //
        // Because the agent-service wraps output in multiple layers of
        // JSON.stringify, we must deep-scan EVERY string value in the
        // agentResult.output tree — not just the top-level fields.
        //
        // Detection is automatic — no node config flag required.
        if (execution) {
          interface AskUserPayload {
            question: string;
            type: 'single_choice' | 'multiple_choice' | 'danger_choice' | 'custom';
            choices?: string[];
          }

          // ── Deep-scan helper ─────────────────────────────────────────────
          // Recursively collects all strings reachable from `value`.
          // If a string is valid JSON it is also recursed into.
          const collectStrings = (value: unknown, depth = 0): string[] => {
            if (depth > 8) return []; // guard against pathological nesting
            if (typeof value === 'string') {
              const strings: string[] = [value];
              try {
                const parsed: unknown = JSON.parse(value);
                strings.push(...collectStrings(parsed, depth + 1));
              } catch {
                /* not JSON – ignore */
              }
              return strings;
            }
            if (Array.isArray(value)) {
              return value.flatMap((v) => collectStrings(v, depth + 1));
            }
            if (value !== null && typeof value === 'object') {
              return Object.values(value as Record<string, unknown>).flatMap((v) =>
                collectStrings(v, depth + 1),
              );
            }
            return [];
          };

          // ── Interaction loop: keep asking until the agent produces a final answer ──
          // Each iteration: scan agentResult for __ASK_USER__, pause for user input,
          // re-run the agent with the answer, then scan again.  Exit when no question
          // is detected (agent is done) or when the safety cap is reached.
          const resolveAgentText = (value: unknown): string => {
            if (typeof value === 'string') {
              try {
                return resolveAgentText(JSON.parse(value));
              } catch {
                return value;
              }
            }
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              const obj = value as Record<string, unknown>;
              if (typeof obj.output === 'string') return resolveAgentText(obj.output);
              if (typeof obj.text === 'string') return resolveAgentText(obj.text);
              if (typeof obj.content === 'string') return resolveAgentText(obj.content);
            }
            return '';
          };

          const SENTINEL_RE_SOURCE = /__ASK_USER__:(\{[\s\S]*?\})/g.source;
          let interactionRound = 0;
          const MAX_INTERACTIONS = 20;

          while (interactionRound < MAX_INTERACTIONS) {
            interactionRound++;

            // ── Step 1: Collect all text candidates ────────────────────────
            const allStrings = collectStrings(agentResult.output);
            this.logger.debug(
              `[ASK_USER] node=${node.id} round=${interactionRound} scanning ${allStrings.length} string(s)`,
            );

            // ── Step 2: Find the sentinel ──────────────────────────────────
            let askUser: AskUserPayload | null = null;
            let sentinelSourceText = '';

            for (const candidate of allStrings) {
              let match: RegExpExecArray | null;
              let lastMatch: RegExpExecArray | null = null;
              const re = new RegExp(SENTINEL_RE_SOURCE, 'g');
              while ((match = re.exec(candidate)) !== null) {
                lastMatch = match;
              }
              if (!lastMatch) continue;

              try {
                const parsed = JSON.parse(lastMatch[1]) as Record<string, unknown>;
                if (typeof parsed.question === 'string') {
                  askUser = {
                    question: parsed.question,
                    type:
                      (parsed.type as AskUserPayload['type']) ??
                      (Array.isArray(parsed.choices) && (parsed.choices as unknown[]).length > 0
                        ? 'single_choice'
                        : 'custom'),
                    choices: Array.isArray(parsed.choices)
                      ? (parsed.choices as string[])
                      : undefined,
                  };
                  sentinelSourceText = candidate;
                  this.logger.log(
                    `[ASK_USER] node=${node.id} detected — type=${askUser.type} ` +
                      `choices=${askUser.choices?.length ?? 0}`,
                  );
                  break;
                }
              } catch {
                this.logger.warn(
                  `AGENT node ${node.id}: failed to parse __ASK_USER__ JSON — raw: ${lastMatch[1]}`,
                );
              }
            }

            // ── Step 3: Heuristic fallback — bare question without sentinel ─
            if (!askUser) {
              const plainText = resolveAgentText(agentResult.output).trim();
              if (plainText) {
                const lines = plainText
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                const lastLine = lines[lines.length - 1] ?? '';
                if (lastLine.endsWith('?')) {
                  askUser = { question: lastLine, type: 'custom', choices: undefined };
                  sentinelSourceText = plainText;
                  this.logger.log(
                    `[ASK_USER] node=${node.id} heuristic: bare question detected — ` +
                      `"${lastLine.slice(0, 80)}"`,
                  );
                }
              }
            }

            // No question in this response → agent is done
            if (!askUser) break;

            // ── Pause workflow and wait for user input ─────────────────────
            const questionType = askUser.type ?? 'single_choice';
            const choices = askUser.choices ?? [];
            const visibleText = sentinelSourceText.replace(/__ASK_USER__:\{[\s\S]*?\}/g, '').trim();

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
                output: agentResult.output,
                prompt: askUser.question,
                agentMessage: visibleText,
                proposals: choices,
                questionType,
                multiSelect: questionType === 'multiple_choice',
              },
            );

            this.logger.log(
              `AGENT node ${node.id} paused (round ${interactionRound}) — waiting for user input (type: ${questionType})`,
            );

            const userResponse = await new Promise<string>((resolve) => {
              this.promptEmitter.once(`resume_${execution.id}_${node.id}`, resolve);
            });

            if (userResponse === '__CANCELLED__' || this.cancelledExecutions.has(execution.id)) {
              throw new ExecutionCancelledError(execution.id);
            }

            // Resume: re-run agent with user's answer injected
            execution.startNodeExecution(node.id, node.customName || node.type, input);
            await this.updateExecution(execution);
            this.workflowGateway.sendNodeUpdate(
              execution.id,
              node.id,
              node.customName || node.type,
              'RUNNING',
              { input, prompt: askUser.question, userResponse, questionType },
            );

            const retryInput =
              typeof input === 'object' && input !== null
                ? { ...input, userResponse, questionType }
                : { originalInput: input, userResponse, questionType };

            agentResult = await this.agentClient.executeAgent({
              ...agentCallConfig,
              input: retryInput,
            });
            if (!agentResult.success) {
              throw new Error(agentResult.error || 'Agent re-execution after user input failed');
            }
            // Loop: scan the new agentResult for another __ASK_USER__
          }
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

      case NodeType.TOOL:
      case NodeType.MCP: {
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
        const promptTemplate = (node.config?.prompt as string) || '';

        // Resolve {{variables}} from input
        const resolvedPrompt = promptTemplate
          ? promptTemplate.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
              const value = path
                .trim()
                .split('.')
                .reduce((acc: any, key: string) => acc?.[key], input);
              return value !== undefined ? String(value) : match;
            })
          : '';

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

          if (userInput === '__CANCELLED__' || this.cancelledExecutions.has(execution.id)) {
            throw new ExecutionCancelledError(execution.id);
          }

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

      case NodeType.ORCHESTRATOR: {
        const {
          agentId,
          maxIterations = 10,
          maxRetries: nodeMaxRetries = 3,
          retryBackoffMs = 1000,
          terminateWhen = '',
          subAgentStrategy = 'auto',
          continueOnSubAgentFailure = false,
          toolIds: orchestratorToolIds = [],
          subAgents: staticSubAgents = [],
          maxTokens: orchestratorMaxTokens,
        } = node.config ?? {};

        if (!agentId) {
          throw new Error('ORCHESTRATOR node requires an agentId in config');
        }

        const iterationResults: Array<{
          iteration: number;
          output: unknown;
          subAgentOutputs?: unknown[];
        }> = [];
        let lastOutput: unknown = null;
        let done = false;

        const push = (level: string, ...args: any[]) => {
          const line = `[${level}] ORCHESTRATOR: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
          if (logSink) logSink.push(line);
          this.logger.log(line);
        };

        const evalTerminateWhen = (output: unknown, iteration: number): boolean => {
          if (!terminateWhen) return false;
          try {
            return !!new Function('output', 'iteration', 'results', 'context', terminateWhen)(
              output,
              iteration,
              iterationResults,
              context?.variables,
            );
          } catch (err) {
            push(
              'WARN',
              `terminateWhen evaluation error: ${err instanceof Error ? err.message : String(err)}`,
            );
            return false;
          }
        };

        const cap = Math.min(Number(maxIterations) || 10, 100);

        for (let iteration = 0; iteration < cap && !done; iteration++) {
          push('LOG', `starting iteration ${iteration + 1}/${cap}`);

          let agentResult: Awaited<ReturnType<typeof this.agentClient.executeAgent>> | null = null;
          let retryCount = 0;

          // ── Retry loop for each iteration ─────────────────────────────────────
          while (retryCount <= nodeMaxRetries) {
            const iterInput =
              typeof input === 'object' && input !== null
                ? {
                    ...input,
                    _iteration: iteration,
                    _previousOutput: lastOutput,
                    _results: iterationResults,
                  }
                : {
                    originalInput: input,
                    _iteration: iteration,
                    _previousOutput: lastOutput,
                    _results: iterationResults,
                  };

            agentResult = await this.agentClient.executeAgent({
              agentId,
              input: iterInput,
              toolIds: orchestratorToolIds as string[],
              subAgents: staticSubAgents,
              maxTokens: orchestratorMaxTokens as number | undefined,
            });

            if (agentResult.success) break;

            retryCount++;
            if (retryCount > nodeMaxRetries) {
              throw new Error(
                `ORCHESTRATOR agent "${agentId}" failed after ${nodeMaxRetries} retries on iteration ${iteration + 1}: ${agentResult.error}`,
              );
            }

            const backoff = retryBackoffMs * Math.pow(2, retryCount - 1);
            push('WARN', `agent failed (attempt ${retryCount}), retrying in ${backoff}ms…`);
            await new Promise((r) => setTimeout(r, backoff));
          }

          const rawOutput: string =
            typeof agentResult?.output?.output === 'string'
              ? agentResult.output.output
              : typeof agentResult?.output === 'string'
                ? agentResult.output
                : JSON.stringify(agentResult?.output ?? '');

          // ── __DONE__ signal ───────────────────────────────────────────────────
          if (rawOutput.includes('__DONE__')) {
            push(
              'LOG',
              `__DONE__ signal received — terminating loop after iteration ${iteration + 1}`,
            );
            lastOutput = agentResult?.output;
            iterationResults.push({ iteration, output: lastOutput });
            done = true;
            break;
          }

          // ── __SPAWN_SUBAGENTS__ signal ────────────────────────────────────────
          let subAgentOutputs: unknown[] | undefined;
          if (subAgentStrategy === 'auto') {
            const spawnMatch = rawOutput.match(/__SPAWN_SUBAGENTS__:(\[[\s\S]*?\])(?:\s|$)/);
            if (spawnMatch) {
              let spawnConfigs: Array<{
                agentId: string;
                input: Record<string, unknown>;
                toolIds?: string[];
              }> = [];
              try {
                spawnConfigs = JSON.parse(spawnMatch[1]);
              } catch {
                push('WARN', `failed to parse __SPAWN_SUBAGENTS__ JSON — skipping spawn`);
              }

              if (spawnConfigs.length > 0) {
                push('LOG', `spawning ${spawnConfigs.length} sub-agent(s) in parallel`);
                const spawnResults = await Promise.allSettled(
                  spawnConfigs.map((cfg) =>
                    this.agentClient.executeAgent({
                      agentId: cfg.agentId,
                      input: cfg.input ?? {},
                      toolIds: cfg.toolIds ?? [],
                    }),
                  ),
                );

                subAgentOutputs = spawnResults.map((r, i) => {
                  if (r.status === 'fulfilled') {
                    return r.value.success ? r.value.output : { error: r.value.error };
                  }
                  const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
                  if (!continueOnSubAgentFailure) {
                    throw new Error(`Sub-agent ${spawnConfigs[i]?.agentId} failed: ${msg}`);
                  }
                  push('WARN', `sub-agent ${spawnConfigs[i]?.agentId} failed (continuing): ${msg}`);
                  return { error: msg };
                });

                push('LOG', `all sub-agents completed — ${subAgentOutputs.length} result(s)`);
              }
            }
          }

          lastOutput = subAgentOutputs
            ? { agentOutput: agentResult?.output, subAgentOutputs }
            : agentResult?.output;

          iterationResults.push({ iteration, output: lastOutput, subAgentOutputs });

          // ── terminateWhen JS expression ───────────────────────────────────────
          if (evalTerminateWhen(lastOutput, iteration)) {
            push('LOG', `terminateWhen condition met — stopping after iteration ${iteration + 1}`);
            done = true;
          }
        }

        if (!done) {
          push('LOG', `reached maxIterations (${cap}) — stopping`);
        }

        push('LOG', `completed — ${iterationResults.length} iteration(s)`);

        return {
          output: lastOutput,
          iterations: iterationResults.length,
          results: iterationResults,
        };
      }

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  // ─── Functional failure detection (runs async after successful completion) ──

  private async detectFunctionalFailureAsync(
    execution: WorkflowExecution,
    context: any,
  ): Promise<void> {
    const functionalHealingEnabled = this.configService.get<boolean>(
      'FUNCTIONAL_HEALING_ENABLED',
      false,
    );
    const healingModelId = this.configService.get<string>('HEALING_MODEL_ID', '');

    if (!functionalHealingEnabled || !healingModelId) return;

    const nodeOutputs = (execution.nodeExecutions as any[])
      .filter((n: any) => n.status === 'COMPLETED' && n.output !== undefined)
      .map((n: any) => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName ?? n.nodeId,
        nodeType: 'UNKNOWN',
        output: n.output,
        status: n.status,
      }));

    if (nodeOutputs.length === 0) return;

    const originalRequest =
      typeof execution.input === 'string' ? execution.input : JSON.stringify(execution.input ?? {});

    const functionalCtx = {
      executionId: execution.id,
      originalRequest,
      nodeOutputs,
      finalOutput: execution.output ?? context.variables,
    };

    const result = await this.healingService.detectFunctionalFailure(
      functionalCtx,
      healingModelId,
      execution.userId,
    );

    if (result.isFunctionalFailure && result.confidence >= 0.6) {
      await this.healingService.saveFunctionalFailureLog(functionalCtx, result, 'PENDING');

      this.logger.warn(
        `[FUNCTIONAL-FAIL] execution=${execution.id} node=${result.failedNodeId} ` +
          `confidence=${result.confidence} reason="${result.failureReason}"`,
      );

      this.workflowGateway.sendExecutionUpdate({
        ...execution,
        metadata: { functionalFailure: { detected: true, reason: result.failureReason } },
      } as any);
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

    // Signal the running async execution to stop at next node boundary
    this.cancelledExecutions.add(executionId);

    // Unblock any nodes currently waiting for user input
    const waitingNodeIds = (execution.nodeExecutions as any[])
      .filter((n: any) => n.status === 'WAITING_INPUT')
      .map((n: any) => n.nodeId as string);

    for (const nodeId of waitingNodeIds) {
      this.promptEmitter.emit(`resume_${executionId}_${nodeId}`, '__CANCELLED__');
    }

    if (execution.isRunning() || execution.status === ExecutionStatus.PENDING) {
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

      // Always provide an executionId so token-progress reporting works even during standalone tests
      const effectiveExecId = executionId ?? randomUUID();

      const output = await this.executeNodeByType(
        node,
        input,
        {
          variables: { ...input, executionId: effectiveExecId, workflowId, userId },
          executionId: effectiveExecId,
          workflowId,
          userId,
          isTest: true,
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
