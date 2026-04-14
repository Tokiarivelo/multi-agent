import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// ─── Shared entity shapes (minimal) ─────────────────────────────────────────

interface AgentRecord {
  id: string;
  name: string;
}

interface ToolRecord {
  id: string;
  name: string;
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

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Given an agent name, find its ID or create a placeholder agent.
   * Returns the real agent ID.
   */
  async findOrCreateAgent(opts: {
    name: string;
    description?: string;
    modelId: string;
    systemPrompt?: string;
    userId: string;
  }): Promise<string> {
    try {
      // 1. Search existing agents by name
      const existing = await this.findAgentByName(opts.name, opts.userId);
      if (existing) {
        this.logger.log(`Reusing existing agent "${opts.name}" (${existing.id})`);
        return existing.id;
      }

      // 2. Create new agent
      const created = await this.createAgent(opts);
      this.logger.log(`Auto-created agent "${opts.name}" (${created.id})`);
      return created.id;
    } catch (err) {
      this.logger.error(
        `Failed to find/create agent "${opts.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
      // Return a placeholder so the workflow is still persisted; user can fix later
      return `__unresolved_agent_${opts.name.toLowerCase().replace(/\s+/g, '_')}`;
    }
  }

  /**
   * Given a tool name, find its ID or create a placeholder CUSTOM tool.
   * Returns the real tool ID.
   */
  async findOrCreateTool(opts: {
    name: string;
    description?: string;
    category?: string;
  }): Promise<string> {
    try {
      // 1. Search existing tools by name
      const existing = await this.findToolByName(opts.name);
      if (existing) {
        this.logger.log(`Reusing existing tool "${opts.name}" (${existing.id})`);
        return existing.id;
      }

      // 2. Create new placeholder tool
      const created = await this.createTool(opts);
      this.logger.log(`Auto-created tool "${opts.name}" (${created.id})`);
      return created.id;
    } catch (err) {
      this.logger.error(
        `Failed to find/create tool "${opts.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return `__unresolved_tool_${opts.name.toLowerCase().replace(/\s+/g, '_')}`;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async findAgentByName(name: string, userId: string): Promise<AgentRecord | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{ data: AgentRecord[] }>(
          `${this.agentServiceUrl}/api/agents?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}&pageSize=10`,
        ),
      );
      const agents: AgentRecord[] = data?.data ?? (data as any) ?? [];
      // Exact-match; the repo does contains/insensitive so we narrow here
      return agents.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null;
    } catch {
      return null;
    }
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
      // 409 Conflict (name taken) — re-fetch and return the existing agent
      if (err?.response?.status === 409) {
        const existing = await this.findAgentByName(opts.name, opts.userId);
        if (existing) return existing;
      }
      throw err;
    }
  }

  private async findToolByName(name: string): Promise<ToolRecord | null> {
    try {
      // Use the search endpoint for a case-insensitive contains match, then
      // narrow to an exact match client-side to avoid false positives.
      const { data } = await firstValueFrom(
        this.httpService.get<{ data: ToolRecord[] }>(
          `${this.toolServiceUrl}/api/tools?search=${encodeURIComponent(name)}&pageSize=20`,
        ),
      );
      const tools: ToolRecord[] = data?.data ?? (data as any) ?? [];
      return tools.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
    } catch {
      return null;
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
          // Stub code — user will fill in the real implementation
          code: `// TODO: implement ${opts.name}\nasync function run(input) {\n  return { result: 'Not yet implemented' };\n}`,
        }),
      );
      return data;
    } catch (err: any) {
      // 409 Conflict = name already exists (race condition) — re-fetch it
      if (err?.response?.status === 409) {
        const existing = await this.findToolByName(opts.name);
        if (existing) return existing;
      }
      throw err;
    }
  }
}
