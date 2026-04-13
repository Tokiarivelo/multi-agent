import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiSession {
  id: string;
  workflowId?: string;
  modelId: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDefinition {
  nodes: unknown[];
  edges: unknown[];
  version: number;
  inputSchema?: unknown[];
  outputSchema?: unknown[];
}

interface AiJsonResponse {
  name?: string;
  description?: string;
  message?: string;
  definition?: GeneratedDefinition;
}

export interface WorkflowAiResult {
  sessionId: string;
  message: string;
  definition?: GeneratedDefinition;
  name?: string;
  description?: string;
  history: AiMessage[];
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const WORKFLOW_SYSTEM_PROMPT = `You are an expert workflow designer for a multi-agent automation platform.
Your task is to generate or modify workflow definitions based on user requirements.

A workflow definition has this structure:
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "message": "Brief explanation of what was created or changed",
  "definition": {
    "nodes": [...],
    "edges": [...],
    "version": 1
  }
}

Available node types:
- START: Entry point (exactly 1 required, no config needed)
- END: Exit point (at least 1 required, no config needed)
- AGENT: Run an AI agent — config: { agentId: "", prompt: "optional prompt template using {{input.field}}" }
- PROMPT: Transform/template input — config: { template: "Hello {{input.name}}, process: {{input.data}}" }
- TEXT: Inject static text — config: { text: "your static content here" }
- CONDITIONAL: Branch logic — config: { condition: "output.score > 0.5" } (JS boolean expression)
- TRANSFORM: Data transformation — config: { transform: "return { result: input.data, count: input.items.length }" } (JS function body)
- LOOP: Repeat steps — config: { maxIterations: 5, condition: "output.done !== true" }
- TOOL: Execute a tool — config: { toolId: "" }
- SUBWORKFLOW: Run another workflow — config: { workflowId: "" }

WorkflowNode schema:
{
  "id": "unique-kebab-case-id",
  "type": "NODE_TYPE",
  "data": {
    "customName": "Human readable label",
    "config": { ...type-specific-config }
  },
  "position": { "x": number, "y": number }
}

WorkflowEdge schema:
{
  "id": "edge-source-to-target",
  "source": "source-node-id",
  "target": "target-node-id",
  "condition": "optional JS boolean expression for conditional routing"
}

Layout rules:
- Place START at position (0, 0)
- Space nodes 250px apart horizontally for linear flows
- For branching, offset branches ±150px vertically
- END nodes go last, furthest right

Validation rules (CRITICAL):
- Exactly 1 START node required
- At least 1 END node required
- All node IDs must be unique kebab-case strings
- All edge IDs must be unique
- Every edge source and target must reference an existing node ID
- CONDITIONAL nodes should have separate outgoing edges each with a condition expression
- The first edge from a CONDITIONAL node (true branch) uses a JS truthy expression
- The second edge (false/else branch) uses the negated expression or a catch-all

IMPORTANT: Respond ONLY with valid JSON — no markdown fences, no prose before or after. Pure JSON only.`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowAiService {
  private readonly logger = new Logger(WorkflowAiService.name);
  private readonly sessions = new Map<string, AiSession>();
  private readonly agentServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.agentServiceUrl = this.configService.get<string>('AGENT_SERVICE_URL')!;
  }

  // ─── Generate ─────────────────────────────────────────────────────────────

  async generateWorkflow(opts: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<WorkflowAiResult> {
    const session = this.getOrCreateSession(opts.sessionId, undefined, opts.modelId);

    const userMessage: AiMessage = {
      role: 'user',
      content: opts.prompt,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    const apiMessages = this.buildApiMessages(session);
    const response = await this.callCompletion(opts.modelId, apiMessages);
    const { parsed, raw } = this.parseJsonResponse(response.content);

    session.messages.push({
      role: 'assistant',
      content: raw,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

    return {
      sessionId: session.id,
      message: parsed?.message ?? 'Workflow generated successfully',
      definition: parsed?.definition as GeneratedDefinition | undefined,
      name: parsed?.name,
      description: parsed?.description,
      history: session.messages,
    };
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  async editWorkflow(opts: {
    workflowId: string;
    prompt: string;
    modelId: string;
    sessionId?: string;
    currentDefinition: unknown;
  }): Promise<WorkflowAiResult> {
    const session = this.getOrCreateSession(opts.sessionId, opts.workflowId, opts.modelId);

    const userContent =
      `Current workflow definition:\n` +
      JSON.stringify(opts.currentDefinition, null, 2) +
      `\n\nUser request: ${opts.prompt}\n\n` +
      `Please apply the requested changes and return the complete updated workflow JSON.`;

    session.messages.push({
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    });

    const apiMessages = this.buildApiMessages(session);
    const response = await this.callCompletion(opts.modelId, apiMessages);
    const { parsed, raw } = this.parseJsonResponse(response.content);

    session.messages.push({
      role: 'assistant',
      content: raw,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

    return {
      sessionId: session.id,
      message: parsed?.message ?? 'Workflow updated successfully',
      definition: parsed?.definition as GeneratedDefinition | undefined,
      name: parsed?.name,
      description: parsed?.description,
      history: session.messages,
    };
  }

  // ─── Session management ───────────────────────────────────────────────────

  getSession(sessionId: string): AiSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  listSessions(workflowId?: string): AiSession[] {
    const all = Array.from(this.sessions.values());
    return workflowId ? all.filter((s) => s.workflowId === workflowId) : all;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getOrCreateSession(
    sessionId: string | undefined,
    workflowId: string | undefined,
    modelId: string,
  ): AiSession {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) return existing;
    }
    const id = sessionId ?? uuidv4();
    const session: AiSession = {
      id,
      workflowId,
      modelId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  private buildApiMessages(session: AiSession): Array<{ role: string; content: string }> {
    return [
      { role: 'system', content: WORKFLOW_SYSTEM_PROMPT },
      ...session.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  private parseJsonResponse(raw: string): {
    parsed: AiJsonResponse | null;
    raw: string;
  } {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    try {
      return { parsed: JSON.parse(cleaned) as AiJsonResponse, raw: cleaned };
    } catch {
      this.logger.warn('AI response was not valid JSON; storing raw content');
      return { parsed: null, raw };
    }
  }

  private async callCompletion(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ content: string }> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.agentServiceUrl}/api/completions`, {
          modelId,
          messages,
        }),
      );
      return data as { content: string };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Completion call failed: ${msg}`);
      throw new Error(`AI completion failed: ${msg}`);
    }
  }
}
