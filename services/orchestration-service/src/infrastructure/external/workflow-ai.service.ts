import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  ResourceProvisioningService,
  AgentRecord,
  ToolRecord,
} from './resource-provisioning.service';

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
  config?: Record<string, unknown>;
  customName?: string;
}

export interface NodeAiResult {
  sessionId: string;
  message: string;
  config?: Record<string, unknown>;
  customName?: string;
  history: AiMessage[];
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

// ─── Node Edit System Prompt ──────────────────────────────────────────────────

const NODE_EDIT_SYSTEM_PROMPT = `You are an expert node configuration assistant for a multi-agent workflow automation platform.
The user will describe changes to a specific workflow node's configuration.

Node type configs:
- AGENT: { agentId, inputMapping?, pipelineSteps?, strictMode?, inputFields?, outputFields? }
- TOOL/MCP: { toolId, strictMode?, inputFields?, outputFields? }
- CONDITIONAL: { condition (JS bool expression on "output") }
- TRANSFORM: { script (JS or Python fn body), language ("javascript"|"python") }
- PROMPT: { prompt (text, supports {{variable}}) }
- TEXT: { text }
- LOOP: { collection (dot-path e.g. "items"), itemScript?, filterScript?, maxIterations? }
- SHELL: { command, cwd? }
- GITHUB: { method, endpoint, token?, body? }
- SLACK: { token, channel, message }
- WHATSAPP: { token, phoneNumberId, to, message }
- SUBWORKFLOW: { workflowId, inputMapping?, outputMapping? }
- ORCHESTRATOR: { agentId, maxIterations?, maxRetries?, terminateWhen?, subAgentStrategy?, toolIds?, subAgents?, maxTokens? }

RESPONSE FORMAT — always respond with ONLY valid JSON (no markdown fences):
{
  "message": "Brief description of changes made (or answer if no change requested)",
  "config": { ...only the fields that need updating... },
  "customName": "New node label (only if user asked to rename)"
}

Rules:
- Only include "config" fields that need to change — the frontend merges them into the existing config
- If the user asks a question without requesting a change, use "config": {} and answer in "message"
- Never include agentId/toolId values — those are already set in the existing config
- For CONDITIONAL, "condition" must be a valid JavaScript boolean expression where "output" is the previous node's output object`;

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
    const userId = opts.userId ?? 'system';

    // ── 1. Fetch existing catalog in parallel so the AI can reuse resources ──
    const [existingAgents, existingTools] = await Promise.all([
      this.provisioningService.listAllAgents(userId),
      this.provisioningService.listAllTools(),
    ]);

    // ── 2. Compose user message with catalog context ──────────────────────────
    const catalogContext = this.buildCatalogContext(existingAgents, existingTools);
    const userMessage: AiMessage = {
      role: 'user',
      content: `${catalogContext}\n\nUser request: ${opts.prompt}`,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    const apiMessages = this.buildApiMessages(session);
    const response = await this.callCompletion(opts.modelId, apiMessages, userId);
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
        userId,
        existingAgents,
        existingTools,
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
    const userId = opts.userId ?? 'system';

    // ── 1. Fetch existing catalog ──────────────────────────────────────────────
    const [existingAgents, existingTools] = await Promise.all([
      this.provisioningService.listAllAgents(userId),
      this.provisioningService.listAllTools(),
    ]);

    // ── 2. Compose user message ──────────────────────────────────────────────
    const catalogContext = this.buildCatalogContext(existingAgents, existingTools);
    const userContent =
      `Current workflow definition:\n` +
      JSON.stringify(opts.currentDefinition, null, 2) +
      `\n\n${catalogContext}` +
      `\n\nUser request: ${opts.prompt}\n\n` +
      `Please apply the requested changes and return the complete updated workflow JSON.`;

    session.messages.push({
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    });

    const apiMessages = this.buildApiMessages(session);
    const response = await this.callCompletion(opts.modelId, apiMessages, userId);
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
        userId,
        existingAgents,
        existingTools,
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

  // ─── Edit Node ───────────────────────────────────────────────────────────

  async editNode(opts: {
    nodeType: string;
    nodeConfig: Record<string, unknown>;
    customName?: string;
    prompt: string;
    modelId: string;
    sessionId?: string;
    userId?: string;
  }): Promise<NodeAiResult> {
    const sessionKey = `node:${opts.sessionId ?? opts.nodeType}`;
    const session = this.getOrCreateSession(sessionKey, undefined, opts.modelId);
    const userId = opts.userId ?? 'system';

    const contextPrefix = `Node type: ${opts.nodeType}\nCurrent config: ${JSON.stringify(opts.nodeConfig, null, 2)}${opts.customName ? `\nCurrent name: ${opts.customName}` : ''}\n\nUser request: `;

    const userMessage: AiMessage = {
      role: 'user',
      content: contextPrefix + opts.prompt,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);
    session.updatedAt = new Date().toISOString();

    const apiMessages = [
      { role: 'system', content: NODE_EDIT_SYSTEM_PROMPT },
      ...session.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await this.callCompletion(opts.modelId, apiMessages, userId);
    const { parsed, raw } = this.parseJsonResponse(response.content);

    const assistantMessage: AiMessage = {
      role: 'assistant',
      content: raw,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();

    return {
      sessionId: session.id,
      message: parsed?.message ?? response.content,
      config: parsed?.config,
      customName: parsed?.customName,
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
    /** Pre-fetched agent catalog — prevents redundant HTTP calls */
    agentCatalog?: AgentRecord[],
    /** Pre-fetched tool catalog */
    toolCatalog?: ToolRecord[],
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
            const { id: agentId, wasCreated } = await this.provisioningService.resolveOrCreateAgent(
              {
                name: agentName,
                description: `Agent for workflow step: ${agentName}`,
                modelId,
                systemPrompt: config.systemPrompt as string | undefined,
                userId,
                existingCatalog: agentCatalog,
              },
            );

            // Only surface newly-created resources in the provisioning summary
            if (wasCreated) {
              provisionedResources.agents.push({ name: agentName, id: agentId });
            }
            const newConfig = { ...config, agentId, agentName: undefined };
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
            const { id: toolId, wasCreated } = await this.provisioningService.resolveOrCreateTool({
              name: toolName,
              description: config.description as string | undefined,
              category: type === 'MCP' ? 'MCP' : 'CUSTOM',
              existingCatalog: toolCatalog,
            });

            if (wasCreated) {
              provisionedResources.tools.push({ name: toolName, id: toolId });
            }
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

  // ─── Catalog context builder ───────────────────────────────────────────────

  /**
   * Formats the existing agent and tool catalogs into a compact block that
   * is prepended to the user prompt so the AI prefers existing resources.
   *
   * When both catalogs are empty (first use / clean installation) nothing is
   * injected so the prompt remains unchanged.
   */
  private buildCatalogContext(agents: AgentRecord[], tools: ToolRecord[]): string {
    if (agents.length === 0 && tools.length === 0) return '';

    const lines: string[] = ['EXISTING RESOURCES (prefer these over inventing new names):'];

    if (agents.length > 0) {
      lines.push('');
      lines.push('Available Agents (use agentName exactly as listed):');
      agents.forEach((a) => {
        const desc = a.description ? ` — ${a.description}` : '';
        lines.push(`  • "${a.name}"${desc}`);
      });
    }

    if (tools.length > 0) {
      lines.push('');
      lines.push('Available Tools (use toolName exactly as listed):');
      tools.forEach((t) => {
        const desc = t.description ? ` — ${t.description}` : '';
        lines.push(`  • "${t.name}"${desc}`);
      });
    }

    lines.push('');
    lines.push(
      'RULE: For every AGENT/TOOL node, first check the lists above. ' +
        'Only use a name NOT in the list if none of the existing resources fits the task.',
    );

    return lines.join('\n');
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
    userId?: string,
  ): Promise<{ content: string }> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.agentServiceUrl}/api/completions`, {
          modelId,
          messages,
          userId,
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
