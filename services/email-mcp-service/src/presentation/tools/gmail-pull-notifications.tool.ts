import { Injectable, Logger } from '@nestjs/common';
import { GmailPubSubService } from '@infrastructure/email/gmail-pubsub.service';
import { McpToolHandler, McpToolSchema, McpToolResult } from '@domain/email-tool.interface';

@Injectable()
export class GmailPullNotificationsTool implements McpToolHandler {
  private readonly logger = new Logger(GmailPullNotificationsTool.name);

  constructor(private readonly pubsubService: GmailPubSubService) {}

  schema(): McpToolSchema {
    return {
      name: 'gmail_pull_notifications',
      description:
        'Pull Gmail push notifications from a Pub/Sub subscription. Returns historyId for each notification that can be used with Gmail History API to fetch message details.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Google Cloud Project ID',
          },
          subscriptionName: {
            type: 'string',
            description: 'Pub/Sub subscription name (not full path)',
          },
          maxMessages: {
            type: 'string',
            description: 'Maximum number of messages to pull (default: 10)',
          },
          credentialsPath: {
            type: 'string',
            description: 'Optional path to Google Cloud credentials JSON file',
          },
        },
        required: ['projectId', 'subscriptionName'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const projectId = args.projectId as string;
    const subscriptionName = args.subscriptionName as string;
    const maxMessages = args.maxMessages ? parseInt(args.maxMessages as string, 10) : 10;
    const credentialsPath = args.credentialsPath as string | undefined;

    this.logger.log(`Pulling notifications from ${subscriptionName}`);

    try {
      const notifications = await this.pubsubService.pullNotifications({
        projectId,
        subscriptionName,
        maxMessages,
        credentialsPath,
      });

      const result = {
        count: notifications.length,
        notifications,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to pull notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
