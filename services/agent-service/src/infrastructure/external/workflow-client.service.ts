import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface NodeExecutionData {
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  status: string;
  input?: any;
  output?: any;
  error?: string;
  waitData?: {
    proposals?: string[];
    questionType?: string;
    multiSelect?: boolean;
    prompt?: string;
    agentMessage?: string;
  };
}

export interface WorkflowPollResult {
  id: string;
  status: string;
  output?: any;
  error?: string;
  nodeExecutions: NodeExecutionData[];
}

export interface WorkflowStreamCallbacks {
  onNodeRunning: (node: NodeExecutionData) => void;
  onNodeCompleted: (node: NodeExecutionData) => void;
  onNodeWaiting: (node: NodeExecutionData) => Promise<string>;
  onComplete: (output: any) => void;
  onError: (error: string) => void;
}

const AI_NODE_TYPES = new Set(['AGENT', 'PROMPT', 'ORCHESTRATOR']);

@Injectable()
export class WorkflowClientService {
  private readonly logger = new Logger(WorkflowClientService.name);
  private readonly orchestrationUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.orchestrationUrl = this.configService.get<string>(
      'ORCHESTRATION_SERVICE_URL',
      'http://localhost:3003',
    );
  }

  async startExecution(workflowId: string, input: Record<string, any>, userId: string): Promise<string> {
    const res = await firstValueFrom(
      this.httpService.post<{ id: string }>(
        `${this.orchestrationUrl}/api/workflows/${workflowId}/execute?userId=${userId}`,
        { input },
      ),
    );
    return res.data.id;
  }

  async resumeNode(executionId: string, nodeId: string, userInput: string): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.orchestrationUrl}/api/workflows/executions/${executionId}/nodes/${nodeId}/resume`,
        { input: userInput },
      ),
    );
  }

  async streamExecution(executionId: string, callbacks: WorkflowStreamCallbacks): Promise<void> {
    const seen = new Map<string, string>(); // nodeId → last known status
    const maxMs = 120_000;
    const pollMs = 600;
    const deadline = Date.now() + maxMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));

      let poll: WorkflowPollResult;
      try {
        const res = await firstValueFrom(
          this.httpService.get<WorkflowPollResult>(
            `${this.orchestrationUrl}/api/workflows/executions/${executionId}`,
          ),
        );
        poll = res.data;
      } catch {
        continue;
      }

      for (const node of poll.nodeExecutions ?? []) {
        const prev = seen.get(node.nodeId);
        if (prev === node.status) continue;
        seen.set(node.nodeId, node.status);

        if (node.status === 'RUNNING') {
          callbacks.onNodeRunning(node);
        } else if (node.status === 'COMPLETED') {
          callbacks.onNodeCompleted(node);
        } else if (node.status === 'WAITING_INPUT') {
          const answer = await callbacks.onNodeWaiting(node);
          await this.resumeNode(executionId, node.nodeId, answer);
          seen.set(node.nodeId, 'RESUMED');
        }
      }

      if (poll.status === 'COMPLETED') {
        callbacks.onComplete(poll.output);
        return;
      }
      if (poll.status === 'FAILED' || poll.status === 'CANCELLED') {
        callbacks.onError(poll.error ?? `Workflow ${poll.status.toLowerCase()}`);
        return;
      }
    }

    callbacks.onError('Workflow execution timed out');
  }

  isAiNode(nodeType?: string): boolean {
    return !!nodeType && AI_NODE_TYPES.has(nodeType.toUpperCase());
  }

  extractOutputText(output: any): string {
    if (!output) return 'Workflow completed with no output.';
    if (typeof output === 'string') return output;
    if (typeof output.text === 'string') return output.text;
    if (typeof output.content === 'string') return output.content;
    if (typeof output.result === 'string') return output.result;
    if (typeof output.message === 'string') return output.message;
    return JSON.stringify(output, null, 2);
  }
}
