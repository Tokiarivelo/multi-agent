import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModelProvider } from '@prisma/client';
import { PrismaService } from './prisma.service';

const SYSTEM_USER_EMAIL = 'system@multi-agent.local';

const OLLAMA_MODEL_NAME = 'Ollama llama3.2';
const OLLAMA_AGENT_NAME = 'Project Assistant (Ollama)';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedSystemAgents();
    } catch (error) {
      this.logger.error(`Seeding failed: ${error.message}`, error.stack);
    }
  }

  private async seedSystemAgents(): Promise<void> {
    this.logger.log('Seeding system agents...');

    const systemUserId = await this.getOrCreateSystemUser();
    const modelId = await this.getOrCreateOllamaModel();
    const toolIds = await this.getToolIds(['pdf_read', 'file_read', 'trello_create_card', 'trello_move_card']);

    await this.upsertOllamaAgent(systemUserId, modelId, toolIds);

    this.logger.log('System agents seeded successfully.');
  }

  private async getOrCreateSystemUser(): Promise<string> {
    const existing = await this.prisma.user.findFirst({
      where: { email: SYSTEM_USER_EMAIL },
      select: { id: true },
    });

    if (existing) return existing.id;

    const user = await this.prisma.user.create({
      data: {
        email: SYSTEM_USER_EMAIL,
        firstName: 'System',
        lastName: 'Agent',
        role: 'ADMIN',
        isActive: true,
        provider: 'system',
      },
      select: { id: true },
    });

    this.logger.log(`Created system user: ${user.id}`);
    return user.id;
  }

  private async getOrCreateOllamaModel(): Promise<string> {
    const existing = await this.prisma.model.findFirst({
      where: { name: OLLAMA_MODEL_NAME },
      select: { id: true },
    });

    if (existing) return existing.id;

    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';

    const model = await this.prisma.model.create({
      data: {
        name: OLLAMA_MODEL_NAME,
        provider: ModelProvider.OLLAMA,
        modelId: 'llama3.2',
        modelName: 'llama3.2',
        description: 'Local LLM via Ollama — llama3.2',
        maxTokens: 8192,
        supportsStreaming: true,
        defaultTemperature: 0.7,
        isActive: true,
        isDefault: false,
        providerSettings: { baseUrl },
      },
      select: { id: true },
    });

    this.logger.log(`Created Ollama model: ${model.id}`);
    return model.id;
  }

  private async getToolIds(toolNames: string[]): Promise<string[]> {
    const tools = await this.prisma.tool.findMany({
      where: { name: { in: toolNames } },
      select: { id: true, name: true },
    });

    const missing = toolNames.filter((n) => !tools.some((t) => t.name === n));
    if (missing.length > 0) {
      this.logger.warn(`Tools not found (skipped): ${missing.join(', ')}. Run seed-tools first.`);
    }

    return tools.map((t) => t.id);
  }

  private async upsertOllamaAgent(
    userId: string,
    modelId: string,
    toolIds: string[],
  ): Promise<void> {
    const systemPrompt = `You are an expert project management assistant running entirely on a local LLM.

Your responsibilities:
- Help teams plan, track, and deliver projects efficiently
- Break down complex goals into actionable tasks
- Read and summarize project documents (PDF, text files)
- Create and organize Trello cards for task tracking
- Provide clear status updates and risk assessments

Guidelines:
- Be concise and action-oriented
- Always confirm before creating or moving Trello cards
- When reading files, summarize key points relevant to the project
- Respond in the same language as the user
- Flag blockers and risks proactively`;

    const agentData = {
      userId,
      name: OLLAMA_AGENT_NAME,
      description: 'Agent IA local pour la gestion de projets',
      systemPrompt,
      modelId,
      tools: toolIds,
      temperature: 0.7,
      maxTokens: 4096,
      isSystem: true,
      metadata: { isCustom: true, provider: 'OLLAMA', version: '1.0.0' },
    };

    const existing = await this.prisma.agent.findFirst({
      where: { name: OLLAMA_AGENT_NAME, isSystem: true },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.agent.update({ where: { id: existing.id }, data: agentData });
      this.logger.log(`Updated system agent: "${OLLAMA_AGENT_NAME}"`);
    } else {
      const agent = await this.prisma.agent.create({ data: agentData, select: { id: true } });
      this.logger.log(`Created system agent: "${OLLAMA_AGENT_NAME}" (${agent.id})`);
    }
  }
}
