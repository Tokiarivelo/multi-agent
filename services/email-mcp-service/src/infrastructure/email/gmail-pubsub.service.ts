import { Injectable, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';

export interface PullNotificationsParams {
  /** Google Cloud Project ID */
  projectId: string;
  /** Subscription name (not full path, just the name) */
  subscriptionName: string;
  /** Maximum number of messages to pull (default: 10) */
  maxMessages?: number;
  /** Optional: Path to Google Cloud credentials JSON file */
  credentialsPath?: string;
}

export interface GmailNotification {
  /** Email address that received the notification */
  emailAddress: string;
  /** Gmail history ID (use this with Gmail History API to fetch details) */
  historyId: string;
}

export interface CreateSubscriptionParams {
  /** Google Cloud Project ID */
  projectId: string;
  /** Topic name (just the name, not full path) */
  topicName: string;
  /** Subscription name to create */
  subscriptionName: string;
  /** Optional: Path to Google Cloud credentials JSON file */
  credentialsPath?: string;
}

@Injectable()
export class GmailPubSubService {
  private readonly logger = new Logger(GmailPubSubService.name);

  /**
   * Create a Pub/Sub subscription to a topic.
   * This is required before you can pull messages.
   */
  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<{ success: boolean; message: string }> {
    const pubSubClient = this.createPubSubClient(params.credentialsPath);
    const topicPath = `projects/${params.projectId}/topics/${params.topicName}`;
    const subscriptionPath = `projects/${params.projectId}/subscriptions/${params.subscriptionName}`;

    try {
      const topic = pubSubClient.topic(topicPath);
      const [exists] = await topic.subscription(params.subscriptionName).exists();

      if (exists) {
        this.logger.log(`Subscription ${params.subscriptionName} already exists`);
        return {
          success: true,
          message: `Subscription ${params.subscriptionName} already exists`,
        };
      }

      await topic.createSubscription(params.subscriptionName);
      this.logger.log(`Created subscription: ${subscriptionPath}`);

      return {
        success: true,
        message: `Subscription ${params.subscriptionName} created successfully`,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Pull notifications from a Pub/Sub subscription.
   * Returns Gmail notifications with historyId for each event.
   */
  async pullNotifications(params: PullNotificationsParams): Promise<GmailNotification[]> {
    const pubSubClient = this.createPubSubClient(params.credentialsPath);
    const subscriptionPath = `projects/${params.projectId}/subscriptions/${params.subscriptionName}`;
    const subscription = pubSubClient.subscription(subscriptionPath);

    const maxMessages = params.maxMessages ?? 10;

    this.logger.log(`Pulling up to ${maxMessages} messages from ${params.subscriptionName}`);

    try {
      // Check if subscription exists
      const [exists] = await subscription.exists();
      if (!exists) {
        throw new Error(
          `Subscription ${params.subscriptionName} does not exist in project ${params.projectId}. ` +
            `Please ensure you've created the subscription using: gcloud pubsub subscriptions create ${params.subscriptionName} --topic=<topic-name>`,
        );
      }

      // Get metadata to check if there are messages
      const [metadata] = await subscription.getMetadata();
      this.logger.log(
        `Subscription metadata: ${JSON.stringify({ name: metadata.name, numUndeliveredMessages: (metadata as { numUndeliveredMessages?: string }).numUndeliveredMessages })}`,
      );

      const notifications: GmailNotification[] = [];

      // Set up a promise that will resolve when we've collected enough messages or timeout
      const pullPromise = new Promise<void>((resolve, reject) => {
        let messageCount = 0;

        // Configure flow control to limit concurrent messages
        subscription.setOptions({
          flowControl: {
            maxMessages: maxMessages,
            allowExcessMessages: false,
          },
        });

        const messageHandler = (message: {
          data: Buffer;
          ackId: string;
          ack: () => void;
          nack: () => void;
        }) => {
          try {
            const data = message.data.toString('utf-8');
            const parsed = JSON.parse(data);

            notifications.push({
              emailAddress: parsed.emailAddress,
              historyId: parsed.historyId,
            });

            // Acknowledge the message immediately
            message.ack();

            messageCount++;
            this.logger.log(
              `Message ${messageCount}/${maxMessages}: ${parsed.emailAddress} (historyId: ${parsed.historyId})`,
            );

            // If we've received the requested number of messages, resolve
            if (messageCount >= maxMessages) {
              this.cleanupSubscription(subscription);
              resolve();
            }
          } catch (parseError: unknown) {
            this.logger.warn(
              `Failed to parse message: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            );
            // Still acknowledge to prevent redelivery
            message.ack();
          }
        };

        const errorHandler = (error: Error) => {
          this.logger.error(`Subscription error: ${error.message}`);
          this.cleanupSubscription(subscription);
          reject(error);
        };

        // Set up event handlers
        subscription.on('message', messageHandler);
        subscription.on('error', errorHandler);

        // Set timeout - if no messages in 10 seconds, assume none available
        const timeoutHandle = setTimeout(() => {
          this.logger.log(`Pull timeout after 10s - received ${messageCount} messages`);
          this.cleanupSubscription(subscription);
          resolve();
        }, 10000);

        // Store timeout handle for cleanup if needed
        (subscription as { _pullTimeout?: NodeJS.Timeout })._pullTimeout = timeoutHandle;
      });

      // Wait for messages or timeout
      await pullPromise;

      if (notifications.length === 0) {
        this.logger.log('No new messages available in subscription');
      } else {
        this.logger.log(`Successfully pulled ${notifications.length} notifications`);
      }

      return notifications;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to pull messages: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to pull messages: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clean up subscription listeners and close connection
   */
  private cleanupSubscription(subscription: {
    removeAllListeners: (event?: string) => void;
    close: () => Promise<void>;
    _pullTimeout?: NodeJS.Timeout;
  }): void {
    // Clear timeout if it exists
    if (subscription._pullTimeout) {
      clearTimeout(subscription._pullTimeout);
    }

    subscription.removeAllListeners('message');
    subscription.removeAllListeners('error');

    // Close connection asynchronously (fire and forget)
    void subscription.close();
  }

  /**
   * Delete a Pub/Sub subscription.
   */
  async deleteSubscription(
    projectId: string,
    subscriptionName: string,
    credentialsPath?: string,
  ): Promise<{ success: boolean; message: string }> {
    const pubSubClient = this.createPubSubClient(credentialsPath);
    const subscriptionPath = `projects/${projectId}/subscriptions/${subscriptionName}`;

    try {
      const subscription = pubSubClient.subscription(subscriptionPath);
      await subscription.delete();

      this.logger.log(`Deleted subscription: ${subscriptionPath}`);
      return {
        success: true,
        message: `Subscription ${subscriptionName} deleted successfully`,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to delete subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to delete subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private createPubSubClient(credentialsPath?: string): PubSub {
    if (credentialsPath) {
      return new PubSub({ keyFilename: credentialsPath });
    }
    // Use Application Default Credentials (ADC)
    return new PubSub();
  }
}
