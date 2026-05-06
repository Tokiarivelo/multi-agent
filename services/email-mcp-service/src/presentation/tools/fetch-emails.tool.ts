import { Injectable } from '@nestjs/common';
import { GmailFetchService } from '@infrastructure/email/gmail-fetch.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class FetchEmailsTool implements McpToolHandler {
  constructor(private readonly gmail: GmailFetchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_fetch_emails',
      description:
        'Fetch emails from a Gmail inbox via IMAP. Returns subject, sender, date, and a text snippet for each message.',
      inputSchema: {
        type: 'object',
        properties: {
          mailbox: {
            type: 'string',
            description:
              'Mailbox to read (default: INBOX). Examples: INBOX, [Gmail]/Sent Mail, [Gmail]/Spam',
          },
          limit: {
            type: 'string',
            description: 'Maximum number of emails to return (default: 20, max: 100)',
          },
          query: {
            type: 'string',
            description:
              'Optional search filter using key:value pairs. Supported keys: from, to, subject, text, since (YYYY-MM-DD), before (YYYY-MM-DD). Example: "from:alice@example.com subject:invoice"',
          },
          imapUser: {
            type: 'string',
            description: 'Gmail address (uses IMAP_USER env if omitted)',
          },
          imapPass: {
            type: 'string',
            description: 'Gmail App Password (uses IMAP_PASS env if omitted)',
          },
          imapHost: {
            type: 'string',
            description: 'IMAP host (default: imap.gmail.com)',
          },
          imapPort: {
            type: 'string',
            description: 'IMAP port (default: 993)',
          },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const limit = args['limit'] ? Math.min(Number(args['limit']), 100) : 20;

    const emails = await this.gmail.fetchEmails({
      mailbox: args['mailbox'] as string | undefined,
      limit,
      query: args['query'] as string | undefined,
      imapUser: args['imapUser'] as string | undefined,
      imapPass: args['imapPass'] as string | undefined,
      imapHost: args['imapHost'] as string | undefined,
      imapPort: args['imapPort'] ? Number(args['imapPort']) : undefined,
    });

    return textResult({ count: emails.length, emails });
  }
}
