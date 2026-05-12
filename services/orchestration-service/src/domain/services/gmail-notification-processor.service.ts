import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GmailTriggerService, GmailWatchSubscription } from './gmail-trigger.service';
import { ExecuteWorkflowUseCase } from '../../application/use-cases/execute-workflow.use-case';

export interface GmailTriggerConditions {
  fromContains?: string;
  subjectContains?: string;
  bodyContains?: string;
  hasAttachment?: boolean;
}

interface HistoryMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  hasAttachment: boolean;
  labelIds: string[];
  internalDate: string;
}

interface ProcessResult {
  workflowsTriggered: number;
  skippedByConditions: number;
}

@Injectable()
export class GmailNotificationProcessorService {
  private readonly logger = new Logger(GmailNotificationProcessorService.name);
  private readonly emailMcpUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailTriggerService: GmailTriggerService,
    private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase,
  ) {
    this.emailMcpUrl = this.configService.get<string>('EMAIL_MCP_URL', 'http://localhost:3012');
  }

  async process(emailAddress: string, historyId: string): Promise<ProcessResult> {
    const subscriptions = await this.gmailTriggerService.findActiveByGmailUser(emailAddress);

    if (subscriptions.length === 0) {
      this.logger.debug(`No active subscriptions for ${emailAddress}`);
      return { workflowsTriggered: 0, skippedByConditions: 0 };
    }

    this.logger.log(
      `Processing notification for ${emailAddress} — ${subscriptions.length} subscription(s)`,
    );

    let triggered = 0;
    let skipped = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const result = await this.processSubscription(sub, emailAddress, historyId);
          triggered += result.triggered;
          skipped += result.skipped;
        } catch (error: unknown) {
          this.logger.error(
            `Failed to process subscription ${sub.id} for ${emailAddress}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );

    return { workflowsTriggered: triggered, skippedByConditions: skipped };
  }

  private async processSubscription(
    sub: GmailWatchSubscription,
    emailAddress: string,
    historyId: string,
  ): Promise<{ triggered: number; skipped: number }> {
    // No refresh token — trigger once without email details (no History API access)
    if (!sub.refreshToken) {
      this.logger.debug(
        `Subscription ${sub.id} has no refreshToken — triggering without email details`,
      );
      await this.triggerWorkflow(sub, emailAddress, historyId, null);
      await this.gmailTriggerService.updateHistoryId(sub.id, historyId);
      return { triggered: 1, skipped: 0 };
    }

    // Always fetch actual messages via History API when a refreshToken is available.
    // This gives every workflow run full email context (subject, from, snippet, etc.).
    const previousHistoryId = sub.historyId ?? historyId;
    const messages = await this.fetchHistory(sub.refreshToken, previousHistoryId);

    if (messages.length === 0) {
      this.logger.debug(`No new messages for subscription ${sub.id}`);
      await this.gmailTriggerService.updateHistoryId(sub.id, historyId);
      return { triggered: 0, skipped: 0 };
    }

    // Apply conditions filter if any are set, otherwise all messages pass through
    const conditions = sub.conditions as GmailTriggerConditions;
    const hasConditions = Object.keys(conditions).length > 0;
    const matching = hasConditions
      ? messages.filter((msg) => this.matchesConditions(msg, conditions))
      : messages;

    if (hasConditions) {
      this.logger.log(
        `Subscription ${sub.id}: ${matching.length}/${messages.length} messages match conditions`,
      );
    } else {
      this.logger.log(`Subscription ${sub.id}: ${messages.length} new message(s) — no conditions`);
    }

    await Promise.allSettled(
      matching.map((msg) => this.triggerWorkflow(sub, emailAddress, historyId, msg)),
    );

    await this.gmailTriggerService.updateHistoryId(sub.id, historyId);
    return { triggered: matching.length, skipped: messages.length - matching.length };
  }

  private async fetchHistory(
    refreshToken: string,
    startHistoryId: string,
  ): Promise<HistoryMessage[]> {
    try {
      const url = `${this.emailMcpUrl}/api/tools/gmail/fetch-history`;
      const res = await axios.post<{ content: Array<{ text: string }> }>(
        url,
        { refreshToken, startHistoryId },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } },
      );
      const text = res.data?.content?.[0]?.text;
      if (!text) return [];
      const parsed = JSON.parse(text) as { messages: HistoryMessage[] };
      return parsed.messages ?? [];
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to fetch history: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private matchesConditions(msg: HistoryMessage, conditions: GmailTriggerConditions): boolean {
    if (
      conditions.fromContains &&
      !msg.from.toLowerCase().includes(conditions.fromContains.toLowerCase())
    ) {
      return false;
    }
    if (
      conditions.subjectContains &&
      !msg.subject.toLowerCase().includes(conditions.subjectContains.toLowerCase())
    ) {
      return false;
    }
    if (
      conditions.bodyContains &&
      !msg.snippet.toLowerCase().includes(conditions.bodyContains.toLowerCase())
    ) {
      return false;
    }
    if (conditions.hasAttachment !== undefined && msg.hasAttachment !== conditions.hasAttachment) {
      return false;
    }
    return true;
  }

  private async triggerWorkflow(
    sub: GmailWatchSubscription,
    emailAddress: string,
    historyId: string,
    message: HistoryMessage | null,
  ): Promise<void> {
    await this.executeWorkflowUseCase.execute(
      {
        workflowId: sub.workflowId,
        input: {
          trigger: 'gmail_watch',
          gmailUser: emailAddress,
          historyId,
          previousHistoryId: sub.historyId ?? null,
          labelIds: sub.labelIds,
          ...(message && {
            email: {
              id: message.id,
              subject: message.subject,
              from: message.from,
              to: message.to,
              snippet: message.snippet,
              hasAttachment: message.hasAttachment,
              labelIds: message.labelIds,
              internalDate: message.internalDate,
            },
          }),
        },
      },
      sub.userId,
    );

    this.logger.log(
      `Triggered workflow ${sub.workflowId} for ${emailAddress}${message ? ` (message: ${message.subject})` : ''}`,
    );
  }
}
