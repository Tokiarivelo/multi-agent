import { PrismaClient, ModelProvider } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SYSTEM_USER_EMAIL = 'system@multi-agent.local';

const OLLAMA_MODEL = {
  name: 'Ollama llama3.2',
  provider: ModelProvider.OLLAMA,
  modelId: 'llama3.2',
  modelName: 'llama3.2',
  description: 'Local LLM via Ollama — llama3.2',
  maxTokens: 8192,
  supportsStreaming: true,
  defaultTemperature: 0.7,
  isActive: true,
  isDefault: false,
  providerSettings: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
  },
};

const OLLAMA_AGENT = {
  name: 'Project Assistant (Ollama)',
  description: 'Agent IA local pour la gestion de projets',
  systemPrompt: `You are an expert project management assistant running entirely on a local LLM.

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
- Flag blockers and risks proactively`,
  tools: ['pdf_read', 'file_read', 'trello_create_card', 'trello_move_card'],
  temperature: 0.7,
  maxTokens: 4096,
  isSystem: true,
  metadata: {
    isCustom: true,
    provider: 'OLLAMA',
    version: '1.0.0',
  },
};

async function getOrCreateSystemUser(): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { email: SYSTEM_USER_EMAIL } });
  if (existing) {
    console.log(`ℹ️  System user already exists: ${existing.id}`);
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email: SYSTEM_USER_EMAIL,
      firstName: 'System',
      lastName: 'Agent',
      role: 'ADMIN',
      isActive: true,
      provider: 'system',
    },
  });
  console.log(`✅ Created system user: ${user.id}`);
  return user.id;
}

async function getOrCreateOllamaModel(): Promise<string> {
  const existing = await prisma.model.findFirst({
    where: { name: OLLAMA_MODEL.name },
  });

  if (existing) {
    await prisma.model.update({
      where: { id: existing.id },
      data: OLLAMA_MODEL,
    });
    console.log(`🔄 Updated Ollama model: ${existing.id}`);
    return existing.id;
  }

  const model = await prisma.model.create({ data: OLLAMA_MODEL });
  console.log(`✅ Created Ollama model: ${model.id}`);
  return model.id;
}

async function getToolIds(toolNames: string[]): Promise<string[]> {
  const tools = await prisma.tool.findMany({
    where: { name: { in: toolNames } },
    select: { id: true, name: true },
  });

  const found = tools.map((t) => t.name);
  const missing = toolNames.filter((n) => !found.includes(n));
  if (missing.length > 0) {
    console.warn(`⚠️  Tools not found in DB (skipped): ${missing.join(', ')}`);
    console.warn('   Run seed-tools first to register built-in tools.');
  }

  return tools.map((t) => t.id);
}

async function main() {
  console.log('🌱 Seeding system agents...');

  const systemUserId = await getOrCreateSystemUser();
  const modelId = await getOrCreateOllamaModel();
  const toolIds = await getToolIds(OLLAMA_AGENT.tools);

  const existing = await prisma.agent.findFirst({
    where: { name: OLLAMA_AGENT.name, isSystem: true },
  });

  const agentData = {
    userId: systemUserId,
    name: OLLAMA_AGENT.name,
    description: OLLAMA_AGENT.description,
    systemPrompt: OLLAMA_AGENT.systemPrompt,
    modelId,
    tools: toolIds,
    temperature: OLLAMA_AGENT.temperature,
    maxTokens: OLLAMA_AGENT.maxTokens,
    isSystem: true,
    metadata: OLLAMA_AGENT.metadata,
  };

  if (existing) {
    await prisma.agent.update({ where: { id: existing.id }, data: agentData });
    console.log(`🔄 Updated system agent: "${OLLAMA_AGENT.name}" (${existing.id})`);
  } else {
    const agent = await prisma.agent.create({ data: agentData });
    console.log(`✅ Created system agent: "${OLLAMA_AGENT.name}" (${agent.id})`);
  }

  console.log('✨ System agents seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
