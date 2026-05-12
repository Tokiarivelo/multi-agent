import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GmailNotificationProcessorService } from './gmail-notification-processor.service';
import axios from 'axios';

interface PullNotificationResponse {
  count: number;
  notifications: Array<{
    emailAddress: string;
    historyId: string;
  }>;
}

/**
 * Polls Gmail Pub/Sub subscriptions for new email notifications.
 * Google publishes Gmail events to Pub/Sub topics — we pull them periodically.
 */
@Injectable()
export class GmailPollerService {
  private readonly logger = new Logger(GmailPollerService.name);
  private readonly emailMcpUrl: string;
  private readonly pollingEnabled: boolean;
  private readonly projectId: string;
  private readonly subscriptionName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationProcessor: GmailNotificationProcessorService,
  ) {
    this.emailMcpUrl = this.configService.get<string>('EMAIL_MCP_URL', 'http://localhost:3012');
    this.pollingEnabled =
      this.configService.get<string>('GMAIL_POLLING_ENABLED', 'false') === 'true';
    this.projectId = this.configService.get<string>('GMAIL_PUBSUB_PROJECT_ID', '');
    this.subscriptionName = this.configService.get<string>('GMAIL_PUBSUB_SUBSCRIPTION', '');

    if (this.pollingEnabled && (!this.projectId || !this.subscriptionName)) {
      this.logger.warn(
        'Gmail polling enabled but GMAIL_PUBSUB_PROJECT_ID or GMAIL_PUBSUB_SUBSCRIPTION not set — polling disabled',
      );
    } else if (this.pollingEnabled) {
      this.logger.log(
        `Gmail poller initialized — project: ${this.projectId}, subscription: ${this.subscriptionName}`,
      );
    }
  }

  /**
   * Poll for Gmail notifications every 30 seconds.
   * Adjust frequency based on expected email volume.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollNotifications(): Promise<void> {
    if (!this.pollingEnabled || !this.projectId || !this.subscriptionName) {
      return;
    }

    try {
      await this.pullAndProcess();
    } catch (error: unknown) {
      this.logger.error(
        `Gmail polling error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Manually trigger a pull operation.
   * Can be called via API endpoint for testing or immediate processing.
   */
  async pullAndProcess(maxMessages = 10): Promise<{ processed: number; notifications: any[] }> {
    this.logger.debug(`Pulling Gmail notifications — max: ${maxMessages}`);

    const response = await this.callPullNotifications(maxMessages);

    if (response.count === 0) {
      this.logger.debug('No new Gmail notifications');
      return { processed: 0, notifications: [] };
    }

    this.logger.log(`Received ${response.count} Gmail notifications`);

    const results = await Promise.allSettled(
      response.notifications.map(async (notification) => {
        const result = await this.notificationProcessor.process(
          notification.emailAddress,
          notification.historyId,
        );
        return { ...notification, ...result };
      }),
    );

    const notifications = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
    );

    return { processed: response.count, notifications };
  }

  private async callPullNotifications(maxMessages: number): Promise<PullNotificationResponse> {
    const url = `${this.emailMcpUrl}/api/tools/gmail/pull-notifications`;
    const payload = {
      projectId: this.projectId,
      subscriptionName: this.subscriptionName,
      maxMessages: String(maxMessages),
    };

    this.logger.debug(`Calling gmail_pull_notifications: ${JSON.stringify(payload)}`);

    const response = await axios.post(url, payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    const content = response.data?.content?.[0]?.text;
    if (!content) throw new Error('Invalid response from gmail_pull_notifications');

    return JSON.parse(content) as PullNotificationResponse;
  }
}
