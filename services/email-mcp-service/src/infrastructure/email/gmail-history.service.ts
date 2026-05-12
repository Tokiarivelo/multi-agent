import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

export interface FetchHistoryParams {
  refreshToken: string;
  startHistoryId: string;
  maxResults?: number;
}

export interface HistoryMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  hasAttachment: boolean;
  labelIds: string[];
  internalDate: string;
}

@Injectable()
export class GmailHistoryService {
  private readonly logger = new Logger(GmailHistoryService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('gmail.clientId', '');
    this.clientSecret = this.config.get<string>('gmail.clientSecret', '');
  }

  async fetchNewMessages(params: FetchHistoryParams): Promise<HistoryMessage[]> {
    const { refreshToken, startHistoryId, maxResults = 50 } = params;

    const auth = new google.auth.OAuth2(this.clientId, this.clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth });

    this.logger.log(`Fetching history since ${startHistoryId}`);

    let historyItems;
    try {
      const res = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        maxResults,
        historyTypes: ['messageAdded'],
      });
      historyItems = res.data.history ?? [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`History list failed (historyId may be expired): ${msg}`);
      return [];
    }

    const messageIds = new Set<string>();
    for (const item of historyItems) {
      for (const added of item.messagesAdded ?? []) {
        if (added.message?.id) messageIds.add(added.message.id);
      }
    }

    if (messageIds.size === 0) {
      this.logger.log('No new messages in history');
      return [];
    }

    const messages = await Promise.all([...messageIds].map((id) => this.fetchMessage(gmail, id)));

    return messages.filter((m): m is HistoryMessage => m !== null);
  }

  private async fetchMessage(
    gmail: ReturnType<typeof google.gmail>,
    messageId: string,
  ): Promise<HistoryMessage | null> {
    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To'],
      });

      const msg = res.data;
      const headers = msg.payload?.headers ?? [];

      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

      const hasAttachment = (msg.payload?.parts ?? []).some(
        (p) => p.filename && p.filename.length > 0,
      );

      return {
        id: msg.id ?? messageId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        snippet: msg.snippet ?? '',
        hasAttachment,
        labelIds: msg.labelIds ?? [],
        internalDate: msg.internalDate ?? '',
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to fetch message ${messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
