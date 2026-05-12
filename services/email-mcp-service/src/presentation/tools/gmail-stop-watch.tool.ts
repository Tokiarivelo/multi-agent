import { Injectable } from '@nestjs/common';
import { GmailWatchService } from '@infrastructure/email/gmail-watch.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class GmailStopWatchTool implements McpToolHandler {
  constructor(private readonly gmailWatch: GmailWatchService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_stop_watch',
      description:
        'Stop an active Gmail push-notification watch for the authenticated Gmail account. ' +
        'After calling this, no more Pub/Sub push notifications will be sent. ' +
        'The workflow trigger registered in the orchestration service must be unregistered separately.',
      inputSchema: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Google OAuth2 refresh token for the Gmail account whose watch to cancel.',
          },
        },
        required: ['refreshToken'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    await this.gmailWatch.stopWatch({
      refreshToken: args['refreshToken'] as string,
    });

    return textResult({ success: true, message: 'Gmail watch subscription stopped.' });
  }
}
