import { Injectable } from '@nestjs/common';
import { GmailFetchService } from '@infrastructure/email/gmail-fetch.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class ManipulateEmailsTool implements McpToolHandler {
  constructor(private readonly gmail: GmailFetchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_manipulate_emails',
      description:
        'Manipulate emails in a Gmail inbox (mark as read/unread, move, delete) using their UIDs.',
      inputSchema: {
        type: 'object',
        properties: {
          uids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of email UIDs to manipulate',
          },
          action: {
            type: 'string',
            enum: ['mark_read', 'mark_unread', 'move', 'delete'],
            description: 'Action to perform on the specified emails',
          },
          mailbox: {
            type: 'string',
            description: 'Mailbox where the emails currently reside (default: INBOX)',
          },
          targetMailbox: {
            type: 'string',
            description: 'Target mailbox for the "move" action',
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
        required: ['uids', 'action'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const uids = args['uids'] as number[];
    const action = args['action'] as 'mark_read' | 'mark_unread' | 'move' | 'delete';

    if (!Array.isArray(uids) || uids.length === 0) {
      throw new Error('uids must be a non-empty array of numbers');
    }

    if (!['mark_read', 'mark_unread', 'move', 'delete'].includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    const result = await this.gmail.manipulateEmails({
      mailbox: args['mailbox'] as string | undefined,
      uids,
      action,
      targetMailbox: args['targetMailbox'] as string | undefined,
      imapUser: args['imapUser'] as string | undefined,
      imapPass: args['imapPass'] as string | undefined,
      imapHost: args['imapHost'] as string | undefined,
      imapPort: args['imapPort'] ? Number(args['imapPort']) : undefined,
    });

    return textResult({
      success: result.success,
      modifiedCount: result.modified,
      action,
    });
  }
}
