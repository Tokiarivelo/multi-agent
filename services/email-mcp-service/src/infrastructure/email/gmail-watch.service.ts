import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

export interface GmailWatchParams {
  /** Google OAuth2 refresh token for the target Gmail account */
  refreshToken: string;
  /** Google Cloud Pub/Sub topic name: "projects/{project}/topics/{topic}" */
  topicName: string;
  /** GMAIL label IDs to filter watch events (default: ['INBOX']) */
  labelIds?: string[];
  /** Label filter action: "include" (default) or "exclude" */
  labelFilterAction?: 'include' | 'exclude';
}

export interface GmailWatchResult {
  /** Google's watch subscription history ID */
  historyId: string;
  /** Unix-epoch ms when this subscription expires (7 days max) */
  expiration: string;
}

export interface GmailStopWatchParams {
  refreshToken: string;
}

@Injectable()
export class GmailWatchService {
  private readonly logger = new Logger(GmailWatchService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('gmail.clientId', '');
    this.clientSecret = this.config.get<string>('gmail.clientSecret', '');
  }

  /** Start a Gmail push-notification watch on the authenticated account. */
  async startWatch(params: GmailWatchParams): Promise<GmailWatchResult> {
    const gmail = this.buildGmailClient(params.refreshToken);

    const requestBody: gmail_v1.Schema$WatchRequest = {
      topicName: params.topicName,
      labelIds: params.labelIds ?? ['INBOX'],
      labelFilterAction: params.labelFilterAction ?? 'include',
    };

    this.logger.log(
      `Starting Gmail watch — topic: ${params.topicName}, labels: ${(params.labelIds ?? ['INBOX']).join(',')}`,
    );

    let res;
    try {
      res = await gmail.users.watch({ userId: 'me', requestBody });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes('User not authorized to perform this action')
      ) {
        throw new Error(
          `Gmail is not authorized to publish to the topic: ${params.topicName}. ` +
            'You must grant "gmail-api-push@system.gserviceaccount.com" the "Pub/Sub Publisher" role on this topic.',
        );
      }
      throw error;
    }

    if (!res.data.historyId || !res.data.expiration) {
      throw new Error('Gmail watch response is missing historyId or expiration');
    }

    this.logger.log(
      `Gmail watch active — historyId: ${res.data.historyId}, expires: ${new Date(Number(res.data.expiration)).toISOString()}`,
    );

    return {
      historyId: res.data.historyId,
      expiration: res.data.expiration,
    };
  }

  /** Stop Gmail push-notification watch for the authenticated account. */
  async stopWatch(params: GmailStopWatchParams): Promise<void> {
    const gmail = this.buildGmailClient(params.refreshToken);
    this.logger.log('Stopping Gmail watch subscription');
    await gmail.users.stop({ userId: 'me' });
    this.logger.log('Gmail watch stopped');
  }

  private buildGmailClient(refreshToken: string): gmail_v1.Gmail {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set to use Gmail Watch.');
    }

    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }
}
