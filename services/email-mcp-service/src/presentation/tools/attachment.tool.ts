import { Injectable } from '@nestjs/common';
import { GmailFetchService } from '@infrastructure/email/gmail-fetch.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

const IMAP_PARAMS = {
  imapUser: { type: 'string', description: 'Gmail address (uses IMAP_USER env if omitted)' },
  imapPass: { type: 'string', description: 'Gmail App Password (uses IMAP_PASS env if omitted)' },
  imapHost: { type: 'string', description: 'IMAP host (default: imap.gmail.com)' },
  imapPort: { type: 'string', description: 'IMAP port (default: 993)' },
  mailbox: { type: 'string', description: 'Mailbox name (default: INBOX)' },
} as const;

@Injectable()
export class ListAttachmentsTool implements McpToolHandler {
  constructor(private readonly gmail: GmailFetchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_list_attachments',
      description:
        'List all attachments for a specific email by its UID. Returns partId, filename, contentType, and size for each attachment. Use the partId with gmail_download_attachment to retrieve the file content.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'UID of the email (from gmail_fetch_emails result)' },
          ...IMAP_PARAMS,
        },
        required: ['uid'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const attachments = await this.gmail.listAttachments({
      uid: Number(args['uid']),
      mailbox: args['mailbox'] as string | undefined,
      imapUser: args['imapUser'] as string | undefined,
      imapPass: args['imapPass'] as string | undefined,
      imapHost: args['imapHost'] as string | undefined,
      imapPort: args['imapPort'] ? Number(args['imapPort']) : undefined,
    });

    return textResult({ count: attachments.length, attachments });
  }
}

@Injectable()
export class DownloadAttachmentTool implements McpToolHandler {
  constructor(private readonly gmail: GmailFetchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_download_attachment',
      description:
        'Download a specific attachment from an email. Returns the file content as base64-encoded data. Optionally saves the file to a local path on the server.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'UID of the email (from gmail_fetch_emails result)' },
          partId: {
            type: 'string',
            description: 'Part identifier of the attachment (from gmail_list_attachments result)',
          },
          outputPath: {
            type: 'string',
            description:
              'Optional workspace-relative or absolute path to save the file (e.g. downloads/invoice.pdf). Delegates saving to the download_file tool.',
          },
          ...IMAP_PARAMS,
        },
        required: ['uid', 'partId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.gmail.downloadAttachment({
      uid: Number(args['uid']),
      partId: args['partId'] as string,
      savePath: args['outputPath'] as string | undefined,
      mailbox: args['mailbox'] as string | undefined,
      imapUser: args['imapUser'] as string | undefined,
      imapPass: args['imapPass'] as string | undefined,
      imapHost: args['imapHost'] as string | undefined,
      imapPort: args['imapPort'] ? Number(args['imapPort']) : undefined,
    });

    return textResult(result);
  }
}
