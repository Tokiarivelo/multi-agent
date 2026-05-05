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
    name: 'http_request',
    description: 'Execute generic HTTP requests with custom method, headers and body',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'url', type: 'string', description: 'Request URL', required: true },
      {
        name: 'method',
        type: 'string',
        description: 'HTTP Method (GET, POST, etc.)',
        required: false,
        default: 'GET',
      },
      { name: 'headers', type: 'object', description: 'Request headers', required: false },
      { name: 'body', type: 'object', description: 'Request payload', required: false },
    ],
    code: null,
  },
  {
    name: 'web_scraper',
    description: 'Scrape content from a website using a URL and optional selector',
    category: ToolCategory.WEB,
    isBuiltIn: true,
    parameters: [
      { name: 'url', type: 'string', description: 'Website URL', required: true },
      {
        name: 'selector',
        type: 'string',
        description: 'CSS selector to extract specific elements',
        required: false,
      },
    ],
    code: null,
  },
  {
    name: 'json_parser',
    description: 'Parse a JSON string into a structured object',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      { name: 'json', type: 'string', description: 'JSON string to parse', required: true },
    ],
    code: null,
  },
  {
    name: 'file_read',
    description: 'Read a file from the server filesystem',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file', required: true },
      { name: 'cwd', type: 'string', description: 'Optional base directory', required: false },
    ],
    code: null,
  },
  {
    name: 'file_write',
    description: 'Write content to a file on the server filesystem',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Target file path', required: true },
      { name: 'content', type: 'string', description: 'Text content to write', required: true },
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
      "Read a file from the user's currently open local workspace (browser File System Access API proxy)",
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
        description: 'Optional ID of the workspace. If missing, use active.',
        required: false,
      },
    ],
    code: null,
  },
  {
    name: 'workspace_write',
    description:
      "Write content to a file in the user's currently open local workspace (browser File System Access API proxy)",
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
        description: 'Optional ID of the workspace. If missing, use active.',
        required: false,
      },
    ],
    code: null,
  },
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
      { name: 'cwd', type: 'string', description: 'Current working directory', required: false },
    ],
    code: null,
  },
  {
    name: 'git_status',
    description: 'Show the working tree status of a Git repository',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      { name: 'cwd', type: 'string', description: 'Path to the repository', required: false },
    ],
    code: null,
  },
  {
    name: 'git_add',
    description: 'Add file contents to the index',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      { name: 'paths', type: 'string', description: 'Files to add', required: false, default: '.' },
      { name: 'cwd', type: 'string', description: 'Path to the repository', required: false },
    ],
    code: null,
  },
  {
    name: 'git_commit',
    description: 'Record changes to the repository',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      { name: 'message', type: 'string', description: 'Commit message', required: true },
      { name: 'cwd', type: 'string', description: 'Path to the repository', required: false },
    ],
    code: null,
  },
  {
    name: 'git_push',
    description: 'Update remote refs along with associated objects',
    category: ToolCategory.CUSTOM,
    isBuiltIn: true,
    parameters: [
      {
        name: 'remote',
        type: 'string',
        description: 'Remote name',
        required: false,
        default: 'origin',
      },
      { name: 'branch', type: 'string', description: 'Branch name', required: false },
      { name: 'cwd', type: 'string', description: 'Path to the repository', required: false },
    ],
    code: null,
  },
  {
    name: 'trello_create_card',
    description: 'Create a new card on a Trello list',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'apiKey', type: 'string', description: 'Trello API Key', required: true },
      { name: 'token', type: 'string', description: 'Trello Auth Token', required: true },
      { name: 'listId', type: 'string', description: 'Trello list ID', required: true },
      { name: 'name', type: 'string', description: 'Card name', required: true },
      { name: 'description', type: 'string', description: 'Card description', required: false },
    ],
    code: null,
  },
  {
    name: 'trello_move_card',
    description: 'Move a card to another Trello list',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'apiKey', type: 'string', description: 'Trello API Key', required: true },
      { name: 'token', type: 'string', description: 'Trello Auth Token', required: true },
      { name: 'listId', type: 'string', description: 'Target list ID', required: true },
      { name: 'cardId', type: 'string', description: 'Trello card ID', required: false },
      { name: 'cardName', type: 'string', description: 'Trello card name', required: false },
      { name: 'boardId', type: 'string', description: 'Trello board ID', required: false },
    ],
    code: null,
  },
  {
    name: 'document_read',
    description: 'Read and parse a document (PDF, DOCX, XLSX, CSV, JSON, HTML, TXT) and return structured text/data.',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file in the workspace', required: true },
      { name: 'encoding', type: 'string', description: 'File encoding', required: false, default: 'utf-8' }
    ],
    code: null,
  },
  {
    name: 'document_generate',
    description: 'Generate a document in various formats (PDF, DOCX, XLSX, MD, CSV, HTML, TXT, JSON) and optionally save it to the workspace.',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'format', type: 'string', description: 'Output format (pdf, docx, xlsx, md, csv, html, txt, json)', required: true },
      { name: 'title', type: 'string', description: 'Document title', required: false },
      { name: 'author', type: 'string', description: 'Document author', required: false },
      { name: 'sections', type: 'array', description: 'Document sections (heading, body, level)', required: false },
      { name: 'table', type: 'object', description: 'Document table (headers, rows)', required: false },
      { name: 'outputPath', type: 'string', description: 'Optional path to save the generated document in the workspace', required: false }
    ],
    code: null,
  },
  {
    name: 'document_parse_image',
    description: 'Extract text (OCR) and metadata from an image file.',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the image in the workspace', required: true }
    ],
    code: null,
  },
  {
    name: 'document_delete',
    description: 'Delete a file or directory from the workspace.',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file or directory to delete', required: true }
    ],
    code: null,
  },
  {
    name: 'document_write',
    description: 'Write plain-text content to a file in the workspace.',
    category: ToolCategory.FILE,
    isBuiltIn: true,
    parameters: [
      { name: 'path', type: 'string', description: 'Path where the file should be created/updated', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true },
      { name: 'encoding', type: 'string', description: 'File encoding', required: false, default: 'utf-8' }
    ],
    code: null,
  },
  // ── Email tools (email-mcp-service, port 3012) ──────────────────────────
  {
    name: 'email_send',
    description: 'Send an email via SMTP. Supports plain text and HTML bodies.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient address(es), comma-separated', required: true },
      { name: 'subject', type: 'string', description: 'Email subject line', required: true },
      { name: 'body', type: 'string', description: 'Plain-text body', required: false },
      { name: 'html', type: 'string', description: 'HTML body (overrides body if provided)', required: false },
      { name: 'from', type: 'string', description: 'Sender address (uses SMTP_FROM env if omitted)', required: false },
      { name: 'smtpHost', type: 'string', description: 'SMTP host (uses SMTP_HOST env if omitted)', required: false },
      { name: 'smtpPort', type: 'string', description: 'SMTP port (uses SMTP_PORT env if omitted)', required: false },
      { name: 'smtpUser', type: 'string', description: 'SMTP user (uses SMTP_USER env if omitted)', required: false },
      { name: 'smtpPass', type: 'string', description: 'SMTP password (uses SMTP_PASS env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'email_send_template',
    description: 'Send an email using a template with {{variable}} placeholders auto-replaced from variables.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'to', type: 'string', description: 'Recipient address(es), comma-separated', required: true },
      { name: 'subject', type: 'string', description: 'Subject — supports {{variable}} placeholders', required: true },
      { name: 'template', type: 'string', description: 'HTML or plain-text template body with {{variable}} placeholders', required: true },
      { name: 'variables', type: 'object', description: 'Key-value pairs for placeholder substitution', required: false },
      { name: 'from', type: 'string', description: 'Sender address (uses SMTP_FROM env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'email_verify_smtp',
    description: 'Verify SMTP connection is working before sending emails.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'smtpHost', type: 'string', description: 'SMTP host to test', required: false },
      { name: 'smtpPort', type: 'string', description: 'SMTP port to test', required: false },
      { name: 'smtpUser', type: 'string', description: 'SMTP user to test', required: false },
      { name: 'smtpPass', type: 'string', description: 'SMTP password to test', required: false },
    ],
    code: null,
  },
  // ── Calendar tools (calendar-mcp-service, port 3013) ────────────────────
  {
    name: 'calendar_create_event',
    description: 'Create a new event in Google Calendar.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'title', type: 'string', description: 'Event title/summary', required: true },
      { name: 'startDateTime', type: 'string', description: 'Start date-time in ISO 8601 (UTC)', required: true },
      { name: 'endDateTime', type: 'string', description: 'End date-time in ISO 8601 (UTC)', required: true },
      { name: 'description', type: 'string', description: 'Event description', required: false },
      { name: 'attendees', type: 'string', description: 'Comma-separated attendee emails', required: false },
      { name: 'location', type: 'string', description: 'Physical or virtual location', required: false },
      { name: 'calendarId', type: 'string', description: 'Calendar ID (default: primary)', required: false },
      { name: 'credentials', type: 'string', description: 'Google credentials JSON (uses env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'calendar_list_events',
    description: 'List upcoming events from Google Calendar.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'timeMin', type: 'string', description: 'Start of range in ISO 8601 (default: now)', required: false },
      { name: 'timeMax', type: 'string', description: 'End of range in ISO 8601', required: false },
      { name: 'maxResults', type: 'string', description: 'Maximum number of events to return (default: 20)', required: false },
      { name: 'calendarId', type: 'string', description: 'Calendar ID (default: primary)', required: false },
      { name: 'credentials', type: 'string', description: 'Google credentials JSON (uses env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'calendar_find_free_slots',
    description: 'Find N available time slots of a given duration in a calendar, scanning working hours (09:00–18:00 UTC).',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'duration', type: 'string', description: 'Slot duration in minutes (e.g. 60)', required: true },
      { name: 'count', type: 'string', description: 'Number of slots to return (default: 3)', required: false },
      { name: 'fromDate', type: 'string', description: 'Search from this ISO 8601 date (default: now)', required: false },
      { name: 'toDate', type: 'string', description: 'Search until this ISO 8601 date (default: +14 days)', required: false },
      { name: 'calendarId', type: 'string', description: 'Calendar ID (default: primary)', required: false },
      { name: 'credentials', type: 'string', description: 'Google credentials JSON (uses env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing Google Calendar event.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'eventId', type: 'string', description: 'Google Calendar event ID', required: true },
      { name: 'title', type: 'string', description: 'New event title', required: false },
      { name: 'description', type: 'string', description: 'New event description', required: false },
      { name: 'startDateTime', type: 'string', description: 'New start date-time in ISO 8601', required: false },
      { name: 'endDateTime', type: 'string', description: 'New end date-time in ISO 8601', required: false },
      { name: 'attendees', type: 'string', description: 'Comma-separated attendee emails (replaces existing)', required: false },
      { name: 'calendarId', type: 'string', description: 'Calendar ID (default: primary)', required: false },
      { name: 'credentials', type: 'string', description: 'Google credentials JSON (uses env if omitted)', required: false },
    ],
    code: null,
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete an event from Google Calendar.',
    category: ToolCategory.API,
    isBuiltIn: true,
    parameters: [
      { name: 'eventId', type: 'string', description: 'Google Calendar event ID to delete', required: true },
      { name: 'calendarId', type: 'string', description: 'Calendar ID (default: primary)', required: false },
      { name: 'credentials', type: 'string', description: 'Google credentials JSON (uses env if omitted)', required: false },
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
