import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GmailTriggerService } from '../../domain/services/gmail-trigger.service';
import { GmailPollerService } from '../../domain/services/gmail-poller.service';
import { GmailNotificationProcessorService } from '../../domain/services/gmail-notification-processor.service';
import { ExecuteWorkflowUseCase } from '../../application/use-cases/execute-workflow.use-case';
import {
  PubSubPushDto,
  GmailPushPayload,
  RegisterGmailWatchDto,
  UnregisterGmailWatchDto,
} from '../../application/dto/gmail-webhook.dto';

@ApiTags('Gmail Webhook')
@Controller('webhooks/gmail')
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);

  constructor(
    private readonly gmailTriggerService: GmailTriggerService,
    private readonly gmailPollerService: GmailPollerService,
    private readonly notificationProcessor: GmailNotificationProcessorService,
    private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase,
  ) {}

  // ─── Pub/Sub Push Receiver ────────────────────────────────────────────────

  /**
   * POST /api/webhooks/gmail/push
   *
   * Google Pub/Sub delivers push notifications here. The endpoint:
   *  1. Decodes the base64 Pub/Sub message to extract { emailAddress, historyId }
   *  2. Looks up all active GmailWatchSubscriptions for that emailAddress
   *  3. Fires each mapped workflow asynchronously with the email metadata as input
   *  4. Returns HTTP 204 so Google marks the message as acknowledged
   *
   * IMPORTANT: Google retries delivery until it receives 2xx. Always return 204
   * even when no subscriptions are found to avoid infinite retry loops.
   */
  @Post('push')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Receive Google Pub/Sub push notification from Gmail Watch',
    description:
      'Called by Google Cloud Pub/Sub when a new email arrives in a watched Gmail inbox. ' +
      'Automatically fires all active workflows registered for that Gmail account.',
  })
  @ApiResponse({ status: 204, description: 'Notification acknowledged' })
  @ApiResponse({ status: 400, description: 'Invalid Pub/Sub payload' })
  async handlePush(@Body() body: PubSubPushDto): Promise<void> {
    // ── 1. Decode Pub/Sub envelope ──────────────────────────────────────────
    let payload: GmailPushPayload;
    try {
      const jsonStr = Buffer.from(body.message.data, 'base64').toString('utf8');
      payload = JSON.parse(jsonStr) as GmailPushPayload;
    } catch (err) {
      this.logger.warn(
        `Gmail webhook: failed to decode Pub/Sub payload — ${err instanceof Error ? err.message : String(err)}`,
      );
      return; // Return 204 to prevent Google retrying a malformed message
    }

    const { emailAddress, historyId } = payload;
    this.logger.log(`Gmail push received — account: ${emailAddress}, historyId: ${historyId}`);

    // ── 2 & 3. Evaluate conditions + fire matching workflows (fire-and-forget) ──
    this.notificationProcessor.process(emailAddress, String(historyId)).catch((err: unknown) => {
      this.logger.error(
        `Gmail webhook: processing failed for ${emailAddress} — ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  // ─── Subscription Management ──────────────────────────────────────────────

  /**
   * POST /api/webhooks/gmail/subscriptions
   *
   * Register a Gmail watch subscription after successfully calling gmail_watch
   * on the email-mcp-service. This links the Gmail account to a workflow.
   */
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a Gmail watch subscription → workflow mapping',
    description:
      'Call this after gmail_watch returns historyId+expiration from email-mcp-service. ' +
      'Links a Gmail account to a workflow so push notifications trigger it.',
  })
  @ApiResponse({ status: 201, description: 'Subscription registered' })
  async register(@Body() dto: RegisterGmailWatchDto) {
    const subscription = await this.gmailTriggerService.register({
      workflowId: dto.workflowId,
      userId: dto.userId,
      gmailUser: dto.gmailUser,
      topicName: dto.topicName,
      labelIds: dto.labelIds,
      historyId: dto.historyId,
      expiration: dto.expiration,
      refreshToken: dto.refreshToken,
      conditions: dto.conditions,
    });

    this.logger.log(
      `Subscription registered — workflowId: ${dto.workflowId}, gmailUser: ${dto.gmailUser}`,
    );

    return subscription;
  }

  /**
   * DELETE /api/webhooks/gmail/subscriptions
   *
   * Unregister a Gmail watch subscription. Does NOT stop the Gmail watch itself —
   * call gmail_stop_watch on email-mcp-service first.
   */
  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unregister a Gmail watch subscription → workflow mapping',
    description:
      'Marks the subscription inactive so future pushes are ignored. ' +
      'Call gmail_stop_watch on email-mcp-service separately to cancel the Gmail API watch.',
  })
  @ApiResponse({ status: 204, description: 'Subscription unregistered' })
  async unregister(@Body() dto: UnregisterGmailWatchDto): Promise<void> {
    await this.gmailTriggerService.unregister(dto.workflowId, dto.gmailUser);
  }

  /**
   * POST /api/webhooks/gmail/subscriptions/resume
   *
   * Reactivate a Gmail watch subscription mapping.
   */
  @Post('subscriptions/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume a paused Gmail watch subscription mapping',
    description: 'Marks a previously paused subscription as active again.',
  })
  @ApiResponse({ status: 200, description: 'Subscription resumed' })
  async resume(@Body() dto: UnregisterGmailWatchDto): Promise<void> {
    // We reuse UnregisterGmailWatchDto as it has the same fields needed
    await this.gmailTriggerService.resume(dto.workflowId, dto.gmailUser);
  }

  /**
   * GET /api/webhooks/gmail/subscriptions/:workflowId
   *
   * List all watch subscriptions for a given workflow.
   */
  @Get('subscriptions/:workflowId')
  @ApiOperation({ summary: 'List Gmail watch subscriptions for a workflow' })
  @ApiParam({ name: 'workflowId', type: String })
  @ApiResponse({ status: 200, description: 'Subscriptions listed' })
  async list(@Param('workflowId') workflowId: string) {
    return this.gmailTriggerService.findByWorkflow(workflowId);
  }

  /**
   * POST /api/webhooks/gmail/pull-notifications
   *
   * Manually trigger a pull of Gmail notifications from Pub/Sub.
   * Useful for testing and immediate processing.
   */
  @Post('pull-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually pull Gmail notifications from Pub/Sub',
    description:
      'Calls email-mcp-service gmail_pull_notifications to retrieve pending notifications. ' +
      'Processes them immediately and triggers associated workflows.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pull completed',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', example: 3 },
        notifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              emailAddress: { type: 'string' },
              historyId: { type: 'string' },
              workflowsTriggered: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async pullNotifications() {
    const result = await this.gmailPollerService.pullAndProcess();
    this.logger.log(`Manual pull completed — processed: ${result.processed}`);
    return result;
  }
}
