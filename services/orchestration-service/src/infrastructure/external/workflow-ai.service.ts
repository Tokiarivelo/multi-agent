import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { ResourceProvisioningService } from './resource-provisioning.service';

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
  /** Resources that were automatically created during provisioning */
  provisionedResources?: {
    agents: Array<{ name: string; id: string }>;
    tools: Array<{ name: string; id: string }>;
  };
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
- AGENT: Run an AI agent — config: { agentName: "Descriptive Agent Name", prompt: "optional prompt template using {{input.field}}" }
  → Use agentName (a human-readable name describing what the agent does), NOT agentId
- PROMPT: Transform/template input — config: { template: "Hello {{input.name}}, process: {{input.data}}" }
- TEXT: Inject static text — config: { text: "your static content here" }
- CONDITIONAL: Branch logic — config: { condition: "output.score > 0.5" } (JS boolean expression)
- TRANSFORM: Data transformation — config: { transform: "return { result: input.data, count: input.items.length }" } (JS function body)
- LOOP: Repeat steps — config: { maxIterations: 5, condition: "output.done !== true" }
- TOOL: Execute a tool — config: { toolName: "Descriptive Tool Name", description: "What this tool does" }
  → Use toolName (a human-readable name), NOT toolId
- SUBWORKFLOW: Run another workflow — config: { workflowId: "" }

IMPORTANT for AGENT and TOOL nodes:
- NEVER use agentId or toolId — always use agentName and toolName respectively
- Choose descriptive, action-oriented names (e.g. "Code Review Agent", "Email Sender Tool")
- Each unique agent or tool in the workflow MUST have a unique, specific name

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
- Place START at position (100, 0)
- Space nodes 200px apart VERTICALLY for linear flows (increase y by 200 each step)
- Keep x centered around 300 for the main branch
- For branching (CONDITIONAL), offset child branches ±250px horizontally while still descending vertically
- END nodes go last at the bottom (largest y value)
- Example main chain positions: START(100,0) → Node1(100,200) → Node2(100,400) → END(100,600)

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
    private readonly provisioningService: ResourceProvisioningService,
  ) {
    this.agentServiceUrl = this.configService.get<string>('AGENT_SERVICE_URL')!;
  }

  // ─── Generate ─────────────────────────────────────────────────────────────

  async generateWorkflow(opts: {
    prompt: string;
    modelId: string;
    sessionId?: string;
    userId?: string;
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

    const rawDefinition = parsed?.definition as GeneratedDefinition | undefined;
    let provisionedDefinition: GeneratedDefinition | undefined;
    let provisionedResources: WorkflowAiResult['provisionedResources'];
    if (rawDefinition) {
      const provisioned = await this.provisionResources(
        rawDefinition,
        opts.modelId,
        opts.userId ?? 'system',
      );
      provisionedDefinition = provisioned.definition;
      provisionedResources = provisioned.provisionedResources;
    }

    return {
      sessionId: session.id,
      message: parsed?.message ?? 'Workflow generated successfully',
      definition: provisionedDefinition,
      name: parsed?.name,
      description: parsed?.description,
      history: session.messages,
      provisionedResources,
    };
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  async editWorkflow(opts: {
    workflowId: string;
    prompt: string;
    modelId: string;
    sessionId?: string;
    currentDefinition: unknown;
    userId?: string;
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

    const rawDefinition = parsed?.definition as GeneratedDefinition | undefined;
    let provisionedDefinition: GeneratedDefinition | undefined;
    let provisionedResources: WorkflowAiResult['provisionedResources'];
    if (rawDefinition) {
      const provisioned = await this.provisionResources(
        rawDefinition,
        opts.modelId,
        opts.userId ?? 'system',
      );
      provisionedDefinition = provisioned.definition;
      provisionedResources = provisioned.provisionedResources;
    }

    return {
      sessionId: session.id,
      message: parsed?.message ?? 'Workflow updated successfully',
      definition: provisionedDefinition,
      name: parsed?.name,
      description: parsed?.description,
      history: session.messages,
      provisionedResources,
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

  // ─── Resource provisioning ───────────────────────────────────────────────

  /**
   * Scans all AGENT and TOOL nodes in the definition.
   * For each one that has agentName / toolName (but no real agentId / toolId),
   * it calls the provisioning service to find-or-create the resource and
   * patches the node config with the real ID.
   *
   * The modelId used for the workflow generation is reused as the default
   * model for auto-created agents.
   */
  private async provisionResources(
    definition: GeneratedDefinition,
    modelId: string,
    userId: string,
  ): Promise<{
    definition: GeneratedDefinition;
    provisionedResources: {
      agents: Array<{ name: string; id: string }>;
      tools: Array<{ name: string; id: string }>;
    };
  }> {
    const provisionedResources = {
      agents: [] as Array<{ name: string; id: string }>,
      tools: [] as Array<{ name: string; id: string }>,
    };

    if (!definition.nodes || definition.nodes.length === 0) {
      return { definition, provisionedResources };
    }

    const patchedNodes = await Promise.all(
      definition.nodes.map(async (node: any) => {
        const raw = node as Record<string, unknown>;
        const data = (raw.data as Record<string, unknown>) ?? {};
        const config =
          (raw.config as Record<string, unknown>) ?? (data.config as Record<string, unknown>) ?? {};
        const type = raw.type as string;

        if (type === 'AGENT') {
          const agentName =
            (config.agentName as string | undefined) ||
            (raw.customName as string | undefined) ||
            (data.customName as string | undefined);

          if (agentName && !config.agentId) {
            const agentId = await this.provisioningService.findOrCreateAgent({
              name: agentName,
              description: `Agent for workflow step: ${agentName}`,
              modelId,
              systemPrompt: config.systemPrompt as string | undefined,
              userId,
            });

            provisionedResources.agents.push({ name: agentName, id: agentId });
            const newConfig = { ...config, agentId, agentName: undefined };
            // Support both flat-config and nested-data formats
            if (raw.config !== undefined) {
              return { ...raw, config: newConfig };
            }
            return { ...raw, data: { ...data, config: newConfig } };
          }
        }

        if (type === 'TOOL' || type === 'MCP') {
          const toolName =
            (config.toolName as string | undefined) ||
            (raw.customName as string | undefined) ||
            (data.customName as string | undefined);

          if (toolName && !config.toolId) {
            const toolId = await this.provisioningService.findOrCreateTool({
              name: toolName,
              description: config.description as string | undefined,
              category: type === 'MCP' ? 'MCP' : 'CUSTOM',
            });

            provisionedResources.tools.push({ name: toolName, id: toolId });
            const newConfig = { ...config, toolId, toolName: undefined };
            if (raw.config !== undefined) {
              return { ...raw, config: newConfig };
            }
            return { ...raw, data: { ...data, config: newConfig } };
          }
        }

        return node;
      }),
    );

    return { definition: { ...definition, nodes: patchedNodes }, provisionedResources };
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
