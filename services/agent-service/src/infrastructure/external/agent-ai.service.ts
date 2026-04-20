import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CompletionUseCase } from '../../application/use-cases/completion.use-case';
import { ToolClientService, ToolSummary } from './tool-client.service';

export interface AgentAiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface GeneratedAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[]; // real tool IDs after provisioning
  metadata: Record<string, unknown>;
}

export interface ProvisionedTool {
  name: string;
  id: string;
  created: boolean; // true = auto-created, false = matched existing
}

export interface AgentAiResult {
  sessionId: string;
  message: string;
  config?: GeneratedAgentConfig;
  provisionedTools?: ProvisionedTool[];
  history: AgentAiMessage[];
}

interface AgentAiSession {
  id: string;
  modelId: string;
  messages: AgentAiMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── Prompt builder (catalog injected at runtime) ─────────────────────────────

function buildSystemPrompt(catalogContext: string): string {
  return `You are an expert AI agent designer for a multi-agent automation platform.
Generate a complete agent configuration based on the user's description.

${catalogContext}

Respond with this JSON structure:
{
  "name": "Agent Name",
  "description": "What this agent does",
  "message": "Brief explanation of what was generated",
  "config": {
    "name": "Agent Name",
    "description": "Detailed description",
    "systemPrompt": "Full system prompt for the agent",
    "temperature": 0.7,
    "maxTokens": 4096,
    "tools": ["Tool Name A", "Tool Name B"],
    "metadata": {}
  }
}

Guidelines:
- name: Short, action-oriented (e.g. "PDF Task Extractor", "Code Review Agent")
- description: 1-2 sentences
- systemPrompt: Start with "You are a [role]..." with detailed instructions
- temperature: 0.0-0.3 factual, 0.5-0.7 balanced, 0.8-1.0 creative
- maxTokens: 1024 short, 2048-4096 detailed, 8192 very long
- tools: Use ONLY names from the AVAILABLE TOOLS list when they match the need.
  For capabilities not covered by existing tools, use a short descriptive name
  like "PDF Text Extractor" or "Weather API Fetcher" — never library names
  (not "PDF.js", "axios", "Tesseract.js", etc.).
  Leave tools as [] if no external tools are needed.
- metadata: extra key-value pairs, {} if not needed

IMPORTANT: Pure JSON only. No markdown fences, no prose.`;
}

type CompletionRole = 'system' | 'user' | 'assistant';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AgentAiService {
  private readonly logger = new Logger(AgentAiService.name);
  private readonly sessions = new Map<string, AgentAiSession>();

  constructor(
    private readonly completionUseCase: CompletionUseCase,
    private readonly toolClient: ToolClientService,
  ) {}

  async generateAgent(opts: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<AgentAiResult> {
    // 1. Fetch existing tools catalog to inject into prompt
    const catalog = await this.toolClient.listToolsCatalog();
    const catalogContext = this.buildCatalogContext(catalog);

    const session = this.getOrCreateSession(opts.sessionId, opts.modelId);

    session.messages.push({
      role: 'user',
      content: opts.prompt,
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = buildSystemPrompt(catalogContext);
    const apiMessages: Array<{ role: CompletionRole; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map((m) => ({
        role: m.role as CompletionRole,
        content: m.content,
      })),
    ];

    const response = await this.completionUseCase.execute({
      modelId: opts.modelId,
      messages: apiMessages,
    });

    const { parsed, raw } = this.parseJsonResponse(response.content);

    session.messages.push({
      role: 'assistant',
      content: raw,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

    // 2. Resolve tool names → real IDs (auto-create missing tools)
    let resolvedConfig = parsed?.config;
    let provisionedTools: ProvisionedTool[] | undefined;

    if (resolvedConfig && Array.isArray(resolvedConfig.tools) && resolvedConfig.tools.length > 0) {
      const { toolIds, provisioned } = await this.resolveTools(
        resolvedConfig.tools,
        catalog,
        opts.modelId,
      );
      resolvedConfig = { ...resolvedConfig, tools: toolIds };
      provisionedTools = provisioned;
    }

    return {
      sessionId: session.id,
      message: parsed?.message ?? 'Agent configuration generated successfully',
      config: resolvedConfig,
      provisionedTools,
      history: session.messages,
    };
  }

  getSession(sessionId: string): AgentAiSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ─── Tool resolution ────────────────────────────────────────────────────────

  private async resolveTools(
    toolNames: string[],
    catalog: ToolSummary[],
    modelId: string,
  ): Promise<{ toolIds: string[]; provisioned: ProvisionedTool[] }> {
    const toolIds: string[] = [];
    const provisioned: ProvisionedTool[] = [];

    for (const name of toolNames) {
      const match = this.findCatalogMatch(name, catalog);

      if (match) {
        toolIds.push(match.id);
        provisioned.push({ name: match.name, id: match.id, created: false });
        continue;
      }

      // Not found — auto-generate and create via AI
      try {
        const generated = await this.toolClient.generateToolWithAi(
          `Create a tool named "${name}". Generate a complete tool configuration for this capability.`,
          modelId,
        );

        if (generated) {
          const created = await this.toolClient.createTool(generated);
          toolIds.push(created.id);
          provisioned.push({ name: created.name, id: created.id, created: true });
          this.logger.log(`Auto-created tool "${created.name}" (${created.id})`);
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-create tool "${name}": ${err.message}`);
        // Skip tool rather than fail the whole agent generation
      }
    }

    return { toolIds, provisioned };
  }

  /** Case-insensitive exact then partial name match against the catalog. */
  private findCatalogMatch(name: string, catalog: ToolSummary[]): ToolSummary | null {
    const needle = name.toLowerCase();
    // Exact match first
    const exact = catalog.find((t) => t.name.toLowerCase() === needle);
    if (exact) return exact;
    // Partial match: catalog name contains the search term or vice versa
    return (
      catalog.find(
        (t) => t.name.toLowerCase().includes(needle) || needle.includes(t.name.toLowerCase()),
      ) ?? null
    );
  }

  private buildCatalogContext(catalog: ToolSummary[]): string {
    if (catalog.length === 0) {
      return 'AVAILABLE TOOLS: none registered yet.';
    }
    const lines = catalog.map((t) => `  - ${t.name}: ${t.description}`).join('\n');
    return `AVAILABLE TOOLS (use these names when they match the need):\n${lines}`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private getOrCreateSession(sessionId: string | undefined, modelId: string): AgentAiSession {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) return existing;
    }
    const id = sessionId ?? randomUUID();
    const session: AgentAiSession = {
      id,
      modelId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  private parseJsonResponse(raw: string): {
    parsed: { message?: string; config?: GeneratedAgentConfig } | null;
    raw: string;
  } {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    try {
      return { parsed: JSON.parse(cleaned), raw: cleaned };
    } catch {
      this.logger.warn('AI response was not valid JSON; storing raw content');
      return { parsed: null, raw };
    }
  }
}
