import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@multi-agent/database';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface RegisterWatchDto {
  workflowId: string;
  userId: string;
  gmailUser: string;
  topicName: string;
  labelIds?: string[];
  historyId?: string;
  expiration?: string;
  refreshToken?: string;
  conditions?: Record<string, unknown>;
}

export interface GmailWatchSubscription {
  id: string;
  workflowId: string;
  userId: string;
  gmailUser: string;
  topicName: string;
  labelIds: string[];
  historyId: string | null;
  expiration: string | null;
  isActive: boolean;
  refreshToken: string | null;
  conditions: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GmailTriggerService {
  private readonly logger = new Logger(GmailTriggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register (or upsert) a Gmail watch subscription.
   * Called after the workflow creator successfully invokes gmail_watch on the email-mcp-service.
   */
  async register(dto: RegisterWatchDto): Promise<GmailWatchSubscription> {
    this.logger.log(
      `Registering Gmail watch — workflow: ${dto.workflowId}, gmailUser: ${dto.gmailUser}`,
    );

    const raw = await this.prisma.gmailWatchSubscription.upsert({
      where: {
        workflowId_gmailUser: {
          workflowId: dto.workflowId,
          gmailUser: dto.gmailUser,
        },
      },
      create: {
        workflowId: dto.workflowId,
        userId: dto.userId,
        gmailUser: dto.gmailUser,
        topicName: dto.topicName,
        labelIds: dto.labelIds ?? ['INBOX'],
        historyId: dto.historyId ?? null,
        expiration: dto.expiration ?? null,
        refreshToken: dto.refreshToken ?? null,
        conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
        isActive: true,
      },
      update: {
        topicName: dto.topicName,
        labelIds: dto.labelIds ?? ['INBOX'],
        historyId: dto.historyId ?? null,
        expiration: dto.expiration ?? null,
        refreshToken: dto.refreshToken ?? null,
        conditions: (dto.conditions ?? {}) as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    return this.toSubscription(raw);
  }

  /**
   * Deactivate a watch subscription (does not call Gmail API — caller must do that).
   */
  async unregister(workflowId: string, gmailUser: string): Promise<void> {
    const existing = await this.prisma.gmailWatchSubscription.findUnique({
      where: { workflowId_gmailUser: { workflowId, gmailUser } },
    });

    if (!existing) {
      throw new NotFoundException(
        `No watch subscription found for workflow ${workflowId} / ${gmailUser}`,
      );
    }

    await this.prisma.gmailWatchSubscription.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    this.logger.log(`Unregistered Gmail watch — workflow: ${workflowId}, gmailUser: ${gmailUser}`);
  }

  /**
   * Reactivate a watch subscription.
   */
  async resume(workflowId: string, gmailUser: string): Promise<void> {
    const existing = await this.prisma.gmailWatchSubscription.findUnique({
      where: { workflowId_gmailUser: { workflowId, gmailUser } },
    });

    if (!existing) {
      throw new NotFoundException(
        `No watch subscription found for workflow ${workflowId} / ${gmailUser}`,
      );
    }

    await this.prisma.gmailWatchSubscription.update({
      where: { id: existing.id },
      data: { isActive: true },
    });

    this.logger.log(`Resumed Gmail watch — workflow: ${workflowId}, gmailUser: ${gmailUser}`);
  }

  /**
   * Find all active subscriptions for a given Gmail account.
   * Used by the webhook handler to determine which workflows to trigger.
   */
  async findActiveByGmailUser(gmailUser: string): Promise<GmailWatchSubscription[]> {
    const rows = await this.prisma.gmailWatchSubscription.findMany({
      where: {
        gmailUser,
        isActive: true,
        workflow: {
          status: 'ACTIVE',
        },
      },
    });
    return rows.map((r) => this.toSubscription(r));
  }

  /**
   * List all subscriptions for a given workflow.
   */
  async findByWorkflow(workflowId: string): Promise<GmailWatchSubscription[]> {
    const rows = await this.prisma.gmailWatchSubscription.findMany({
      where: { workflowId },
    });
    return rows.map((r) => this.toSubscription(r));
  }

  /**
   * Update the historyId after processing a batch of notifications.
   * This ensures the next push only fetches *new* messages since the last processed point.
   */
  async updateHistoryId(id: string, historyId: string): Promise<void> {
    await this.prisma.gmailWatchSubscription.update({
      where: { id },
      data: { historyId },
    });
  }

  private toSubscription(raw: {
    id: string;
    workflowId: string;
    userId: string;
    gmailUser: string;
    topicName: string;
    labelIds: unknown;
    historyId: string | null;
    expiration: string | null;
    isActive: boolean;
    refreshToken: string | null;
    conditions: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): GmailWatchSubscription {
    return {
      ...raw,
      labelIds: Array.isArray(raw.labelIds) ? (raw.labelIds as string[]) : ['INBOX'],
      conditions:
        raw.conditions && typeof raw.conditions === 'object' && !Array.isArray(raw.conditions)
          ? (raw.conditions as Record<string, unknown>)
          : {},
    };
  }
}
