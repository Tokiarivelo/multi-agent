import { Injectable } from '@nestjs/common';
import { GmailWatchService } from '@infrastructure/email/gmail-watch.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class GmailWatchTool implements McpToolHandler {
  constructor(private readonly gmailWatch: GmailWatchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_watch',
      description:
        'Register a Gmail push-notification watch via Google Pub/Sub. ' +
        'New emails matching the label filter will trigger a push notification to the configured Pub/Sub topic. ' +
        'Returns historyId (current state snapshot) and expiration (epoch ms, max 7 days). ' +
        'You must renew the watch before it expires.',
      inputSchema: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Google OAuth2 refresh token for the Gmail account to watch.',
          },
          topicName: {
            type: 'string',
            description:
              'Google Cloud Pub/Sub topic name in the format "projects/{project-id}/topics/{topic-name}". ' +
              'The Gmail service account must have publish permissions on this topic.',
          },
          labelIds: {
            type: 'string',
            description:
              'Comma-separated Gmail label IDs to filter. Defaults to "INBOX". ' +
              'Common values: INBOX, SENT, SPAM, TRASH, UNREAD, STARRED.',
          },
          labelFilterAction: {
            type: 'string',
            description:
              '"include" (default) to watch only specified labels, "exclude" to ignore them.',
            enum: ['include', 'exclude'],
          },
        },
        required: ['refreshToken', 'topicName'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const labelIds = args['labelIds']
      ? String(args['labelIds'])
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean)
      : ['INBOX'];

    const result = await this.gmailWatch.startWatch({
      refreshToken: args['refreshToken'] as string,
      topicName: args['topicName'] as string,
      labelIds,
      labelFilterAction:
        (args['labelFilterAction'] as 'include' | 'exclude' | undefined) ?? 'include',
    });

    return textResult({
      success: true,
      historyId: result.historyId,
      expiration: result.expiration,
      expiresAt: new Date(Number(result.expiration)).toISOString(),
    });
  }
}
