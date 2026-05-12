import { Injectable, Logger } from '@nestjs/common';
import { GmailHistoryService } from '@infrastructure/email/gmail-history.service';
import { McpToolHandler, McpToolSchema, McpToolResult } from '@domain/email-tool.interface';

@Injectable()
export class GmailFetchHistoryTool implements McpToolHandler {
  private readonly logger = new Logger(GmailFetchHistoryTool.name);

  constructor(private readonly historyService: GmailHistoryService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_fetch_history',
      description:
        'Fetch new Gmail messages added since a given historyId using the Gmail History API. ' +
        'Returns subject, sender, snippet, and attachment info for each new message.',
      inputSchema: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'OAuth2 refresh token for the Gmail account',
          },
          startHistoryId: { type: 'string', description: 'historyId to start from (exclusive)' },
          maxResults: { type: 'number', description: 'Max messages to return (default: 50)' },
        },
        required: ['refreshToken', 'startHistoryId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const refreshToken = args.refreshToken as string;
    const startHistoryId = args.startHistoryId as string;
    const maxResults = args.maxResults as number | undefined;

    this.logger.log(`Fetching history since ${startHistoryId}`);

    const messages = await this.historyService.fetchNewMessages({
      refreshToken,
      startHistoryId,
      maxResults,
    });

    return {
      content: [
        { type: 'text', text: JSON.stringify({ count: messages.length, messages }, null, 2) },
      ],
    };
  }
}
