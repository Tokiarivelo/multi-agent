import { PrismaClient, ToolCategory } from '@prisma/client';
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

const tools = [
  {
    name: 'github_api',
    description: 'Execute requests against the GitHub REST API',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      {
        name: 'token',
        type: 'string',
        description: 'GitHub Personal Access Token',
        required: true,
      },
      {
        name: 'endpoint',
        type: 'string',
        description: 'GitHub API endpoint (e.g. /repos/owner/repo)',
        required: true,
      },
      {
        name: 'method',
        type: 'string',
        description: 'HTTP Method (GET, POST, etc.)',
        required: false,
        default: 'GET',
      },
      {
        name: 'body',
        type: 'object',
        description: 'JSON payload for POST/PATCH requests',
        required: false,
      },
    ],
    code: null,
  },
  {
    name: 'slack_post_message',
    description: 'Post a message to a Slack channel',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'token', type: 'string', description: 'Slack Bot Token (xoxb-...)', required: true },
      {
        name: 'channel',
        type: 'string',
        description: 'Channel ID or name (e.g. #general)',
        required: true,
      },
      { name: 'text', type: 'string', description: 'Message text to post', required: true },
    ],
    code: null,
  },
  {
    name: 'whatsapp_send_message',
    description: 'Send a WhatsApp message via WhatsApp Cloud API',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'token', type: 'string', description: 'Meta Graph API Access Token', required: true },
      {
        name: 'phoneNumberId',
        type: 'string',
        description: 'WhatsApp Phone Number ID',
        required: true,
      },
      {
        name: 'to',
        type: 'string',
        description: 'Recipient phone number (with country code)',
        required: true,
      },
      { name: 'text', type: 'string', description: 'Message text', required: true },
    ],
    code: null,
  },
  {
    name: 'shell_execute',
    description: 'Execute a shell command locally (if enabled in policy)',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Shell command string to execute',
        required: true,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Execution timeout in ms',
        required: false,
        default: 30000,
      },
    ],
    code: null,
  },
  {
    name: 'pdf_read',
    description: 'Extract text content from a PDF file on the server filesystem',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the PDF file (absolute or relative to workspace root)',
        required: true,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory to resolve relative paths from',
        required: false,
      },
    ],
    code: null,
  },
  {
    name: 'workspace_read',
    description:
      "Read a file from the user's currently open local workspace (browser File System Access API)",
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Path to the file relative to the workspace root',
        required: true,
      },
      {
        name: 'workspaceId',
        type: 'string',
        description:
          'Optional ID of the workspace to read from. If missing, the active/default workspace is used.',
        required: false,
      },
    ],
    code: null,
  },
  {
    name: 'workspace_write',
    description:
      "Write content to a file in the user's currently open local workspace (browser File System Access API)",
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      {
        name: 'filePath',
        type: 'string',
        description: 'Destination path relative to the workspace root',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'Content to write to the file',
        required: true,
      },
      {
        name: 'workspaceId',
        type: 'string',
        description:
          'Optional ID of the workspace to write to. If missing, the active/default workspace is used.',
        required: false,
      },
    ],
    code: null,
  },
];

async function main() {
  console.log('Seeding built-in tools...');
  for (const tool of tools) {
    const existing = await prisma.tool.findFirst({ where: { name: tool.name } });
    if (!existing) {
      await prisma.tool.create({ data: tool });
      console.log(`✅ Created tool: ${tool.name}`);
    } else {
      await prisma.tool.update({
        where: { id: existing.id },
        data: tool,
      });
      console.log(`🔄 Updated tool: ${tool.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
