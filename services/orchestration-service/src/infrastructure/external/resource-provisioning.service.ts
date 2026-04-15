import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// ─── Shared entity shapes (minimal) ─────────────────────────────────────────

export interface AgentRecord {
  id: string;
  name: string;
  description?: string;
}

export interface ToolRecord {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ResourceProvisioningService {
  private readonly logger = new Logger(ResourceProvisioningService.name);
  private readonly agentServiceUrl: string;
  private readonly toolServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.agentServiceUrl = this.configService.get<string>('AGENT_SERVICE_URL')!;
    this.toolServiceUrl = this.configService.get<string>('TOOL_SERVICE_URL')!;
  }

  // ─── Catalog fetchers (used by the AI to pick existing resources) ─────────

  /**
   * Returns all agents visible to `userId` (own + system agents).
   * Used to build the context that is injected into the AI prompt.
   */
  async listAllAgents(userId: string): Promise<AgentRecord[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ data: AgentRecord[] }>(
          `${this.agentServiceUrl}/api/agents?userId=${encodeURIComponent(userId)}&pageSize=200`,
        ),
      );
      return data?.data ?? (data as any) ?? [];
    } catch (err) {
      this.logger.warn(
        `Could not list agents: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /**
   * Returns all tools available in the system.
   * Used to build the context that is injected into the AI prompt.
   */
  async listAllTools(): Promise<ToolRecord[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ data: ToolRecord[] }>(
          `${this.toolServiceUrl}/api/tools?pageSize=200`,
        ),
      );
      return data?.data ?? (data as any) ?? [];
    } catch (err) {
      this.logger.warn(`Could not list tools: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ─── Resolution (find best match, create only if truly nothing exists) ────

  /**
   * Given an agent name from the workflow, resolve it to an existing agent ID.
   *
   * Resolution order:
   *   1. Exact name match (case-insensitive)
   *   2. Partial name match (the workflow name is a substring of an existing name or vice-versa)
   *   3. If existingCatalog is supplied and still no match → create a new agent as a last resort
   */
  async resolveOrCreateAgent(opts: {
    name: string;
    description?: string;
    modelId: string;
    systemPrompt?: string;
    userId: string;
    /** Pre-fetched catalog — avoids extra HTTP call when caller already has it */
    existingCatalog?: AgentRecord[];
  }): Promise<{ id: string; wasCreated: boolean }> {
    try {
      const catalog = opts.existingCatalog ?? (await this.listAllAgents(opts.userId));

      // 1. Exact match
      const exact = catalog.find((a) => a.name.toLowerCase() === opts.name.toLowerCase());
      if (exact) {
        this.logger.log(`[agent] Exact match: "${opts.name}" → ${exact.id}`);
        return { id: exact.id, wasCreated: false };
      }

      // 2. Partial / fuzzy match
      const partial = this.findPartialMatch(opts.name, catalog);
      if (partial) {
        this.logger.log(
          `[agent] Partial match: "${opts.name}" → "${partial.name}" (${partial.id})`,
        );
        return { id: partial.id, wasCreated: false };
      }

      // 3. Nothing found — create
      const created = await this.createAgent(opts);
      this.logger.log(`[agent] Created: "${opts.name}" (${created.id})`);
      return { id: created.id, wasCreated: true };
    } catch (err) {
      this.logger.error(
        `Failed to resolve agent "${opts.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        id: `__unresolved_agent_${opts.name.toLowerCase().replace(/\s+/g, '_')}`,
        wasCreated: false,
      };
    }
  }

  /**
   * Given a tool name from the workflow, resolve it to an existing tool ID.
   *
   * Resolution order:
   *   1. Exact name match (case-insensitive)
   *   2. Partial name match
   *   3. Create as a last resort
   */
  async resolveOrCreateTool(opts: {
    name: string;
    description?: string;
    category?: string;
    /** Pre-fetched catalog */
    existingCatalog?: ToolRecord[];
  }): Promise<{ id: string; wasCreated: boolean }> {
    try {
      const catalog = opts.existingCatalog ?? (await this.listAllTools());

      // 1. Exact match
      const exact = catalog.find((t) => t.name.toLowerCase() === opts.name.toLowerCase());
      if (exact) {
        this.logger.log(`[tool] Exact match: "${opts.name}" → ${exact.id}`);
        return { id: exact.id, wasCreated: false };
      }

      // 2. Partial / fuzzy match
      const partial = this.findPartialMatch(opts.name, catalog);
      if (partial) {
        this.logger.log(`[tool] Partial match: "${opts.name}" → "${partial.name}" (${partial.id})`);
        return { id: partial.id, wasCreated: false };
      }

      // 3. Nothing found — create
      const created = await this.createTool(opts);
      this.logger.log(`[tool] Created: "${opts.name}" (${created.id})`);
      return { id: created.id, wasCreated: true };
    } catch (err) {
      this.logger.error(
        `Failed to resolve tool "${opts.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        id: `__unresolved_tool_${opts.name.toLowerCase().replace(/\s+/g, '_')}`,
        wasCreated: false,
      };
    }
  }

  // ─── Legacy compatibility shims (kept for backward-compat) ───────────────

  /** @deprecated Use resolveOrCreateAgent instead */
  async findOrCreateAgent(opts: {
    name: string;
    description?: string;
    modelId: string;
    systemPrompt?: string;
    userId: string;
  }): Promise<string> {
    const result = await this.resolveOrCreateAgent(opts);
    return result.id;
  }

  /** @deprecated Use resolveOrCreateTool instead */
  async findOrCreateTool(opts: {
    name: string;
    description?: string;
    category?: string;
  }): Promise<string> {
    const result = await this.resolveOrCreateTool(opts);
    return result.id;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Finds the best partial-name match from the catalog.
   * A match is accepted when the searched name tokens (words) mostly appear
   * in the candidate name or vice versa.
   */
  private findPartialMatch<T extends { name: string }>(searchName: string, catalog: T[]): T | null {
    const searchTokens = this.tokenize(searchName);
    if (searchTokens.length === 0) return null;

    let bestMatch: T | null = null;
    let bestScore = 0;

    for (const candidate of catalog) {
      const candidateTokens = this.tokenize(candidate.name);
      const score = this.jaccardSimilarity(searchTokens, candidateTokens);
      // Only accept if the similarity is strong enough to be meaningful
      if (score > 0.5 && score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  /** Splits a name into lowercase words, ignoring common stop-words */
  private tokenize(name: string): string[] {
    const STOP_WORDS = new Set([
      'the',
      'a',
      'an',
      'for',
      'to',
      'of',
      'and',
      'or',
      'in',
      'on',
      'at',
      'by',
    ]);
    return name
      .toLowerCase()
      .split(/[\s\-_]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  /** Jaccard similarity between two token sets */
  private jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter((t) => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private async createAgent(opts: {
    name: string;
    description?: string;
    modelId: string;
    systemPrompt?: string;
    userId: string;
  }): Promise<AgentRecord> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<AgentRecord>(
          `${this.agentServiceUrl}/api/agents?userId=${encodeURIComponent(opts.userId)}`,
          {
            name: opts.name,
            description: opts.description ?? `Auto-created agent for workflow step: ${opts.name}`,
            modelId: opts.modelId,
            systemPrompt:
              opts.systemPrompt ??
              `You are a helpful AI assistant responsible for: ${opts.name}. Perform the task based on the input provided.`,
            temperature: 0.7,
            maxTokens: 2000,
            tools: [],
          },
        ),
      );
      return data;
    } catch (err: any) {
      // 409 Conflict (name taken by a concurrent request) — re-fetch
      if (err?.response?.status === 409) {
        const catalog = await this.listAllAgents(opts.userId);
        const existing = catalog.find((a) => a.name.toLowerCase() === opts.name.toLowerCase());
        if (existing) return existing;
      }
      throw err;
    }
  }

  private async createTool(opts: {
    name: string;
    description?: string;
    category?: string;
  }): Promise<ToolRecord> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<ToolRecord>(`${this.toolServiceUrl}/api/tools`, {
          name: opts.name,
          description: opts.description ?? `Auto-created tool: ${opts.name}`,
          category: opts.category ?? 'CUSTOM',
          parameters: [],
          isBuiltIn: false,
          code: `// TODO: implement ${opts.name}\nasync function run(input) {\n  return { result: 'Not yet implemented' };\n}`,
        }),
      );
      return data;
    } catch (err: any) {
      // 409 Conflict (race condition) — re-fetch
      if (err?.response?.status === 409) {
        const catalog = await this.listAllTools();
        const existing = catalog.find((t) => t.name.toLowerCase() === opts.name.toLowerCase());
        if (existing) return existing;
      }
      throw err;
    }
  }
}
