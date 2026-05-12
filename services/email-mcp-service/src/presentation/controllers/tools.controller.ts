import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  FetchEmailsTool,
  SendEmailTool,
  SendEmailTemplateTool,
  VerifySmtpTool,
  ManipulateEmailsTool,
  ListAttachmentsTool,
  DownloadAttachmentTool,
  GmailWatchTool,
  GmailStopWatchTool,
  GmailPullNotificationsTool,
  GmailFetchHistoryTool,
} from '../tools';
import { FetchEmailsDto } from '../dto/fetch-emails.dto';
import { SendEmailDto } from '../dto/send-email.dto';
import { SendEmailTemplateDto } from '../dto/send-email-template.dto';
import { VerifySmtpDto } from '../dto/verify-smtp.dto';
import { ManipulateEmailsDto } from '../dto/manipulate-emails.dto';
import { ListAttachmentsDto } from '../dto/list-attachments.dto';
import { DownloadAttachmentDto } from '../dto/download-attachment.dto';
import { GmailWatchDto } from '../dto/gmail-watch.dto';
import { GmailStopWatchDto } from '../dto/gmail-stop-watch.dto';
import { GmailPullNotificationsDto } from '../dto/gmail-pull-notifications.dto';
import { GmailFetchHistoryDto } from '../dto/gmail-fetch-history.dto';
import { FetchEmailsResultDto } from '../dto/results/fetch-emails-result.dto';
import { PullNotificationsResultDto } from '../dto/results/pull-notifications-result.dto';
import { GmailWatchResultDto } from '../dto/results/watch-result.dto';
import { SendEmailResultDto } from '../dto/results/send-email-result.dto';
import { ApiResponse } from '@nestjs/swagger';

@ApiTags('Gmail — IMAP')
@Controller('tools/gmail')
export class GmailToolsController {
  constructor(
    private readonly fetchTool: FetchEmailsTool,
    private readonly manipulateTool: ManipulateEmailsTool,
    private readonly listTool: ListAttachmentsTool,
    private readonly downloadTool: DownloadAttachmentTool,
    private readonly watchTool: GmailWatchTool,
    private readonly stopWatchTool: GmailStopWatchTool,
    private readonly pullNotificationsTool: GmailPullNotificationsTool,
    private readonly fetchHistoryTool: GmailFetchHistoryTool,
  ) {}

  @Post('fetch-emails')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_fetch_emails — Fetch emails from Gmail via IMAP',
    description:
      'Returns subject, sender, date, snippet, and UID for each matched email. Supports search filters.',
  })
  @ApiResponse({ status: 200, type: FetchEmailsResultDto })
  fetchEmails(@Body() dto: FetchEmailsDto) {
    return this.fetchTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('manipulate-emails')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_manipulate_emails — Mark read/unread, move, or delete emails by UID',
  })
  manipulateEmails(@Body() dto: ManipulateEmailsDto) {
    return this.manipulateTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('list-attachments')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_list_attachments — List all attachments for a specific email UID',
  })
  listAttachments(@Body() dto: ListAttachmentsDto) {
    return this.listTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('download-attachment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_download_attachment — Download an attachment as base64 by UID + partId',
  })
  downloadAttachment(@Body() dto: DownloadAttachmentDto) {
    return this.downloadTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('watch')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_watch — Start Gmail push notifications via Pub/Sub',
    description:
      'Initiates a watch on a Gmail account. Requires Google OAuth2 refresh token and a Pub/Sub topic.',
  })
  @ApiResponse({ status: 200, type: GmailWatchResultDto })
  watch(@Body() dto: GmailWatchDto) {
    return this.watchTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('stop-watch')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_stop_watch — Terminate Gmail push notifications',
    description: 'Stops a previously initiated watch on a Gmail account.',
  })
  stopWatch(@Body() dto: GmailStopWatchDto) {
    return this.stopWatchTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('pull-notifications')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_pull_notifications — Pull Gmail push notifications from Pub/Sub',
    description:
      'Retrieves Gmail notifications from a Pub/Sub subscription. Returns historyId for each notification.',
  })
  @ApiResponse({ status: 200, type: PullNotificationsResultDto })
  pullNotifications(@Body() dto: GmailPullNotificationsDto) {
    return this.pullNotificationsTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('fetch-history')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_fetch_history — Fetch new messages via Gmail History API',
    description:
      'Returns subject, sender, snippet, and attachment info for messages added since the given historyId.',
  })
  fetchHistory(@Body() dto: GmailFetchHistoryDto) {
    return this.fetchHistoryTool.execute(dto as unknown as Record<string, unknown>);
  }
}

@ApiTags('Email — SMTP')
@Controller('tools/email')
export class SmtpToolsController {
  constructor(
    private readonly sendTool: SendEmailTool,
    private readonly sendTemplateTool: SendEmailTemplateTool,
    private readonly verifyTool: VerifySmtpTool,
  ) {}

  @Post('send')
  @HttpCode(200)
  @ApiOperation({ summary: 'email_send — Send an email via SMTP' })
  @ApiResponse({ status: 200, type: SendEmailResultDto })
  send(@Body() dto: SendEmailDto) {
    return this.sendTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('send-template')
  @HttpCode(200)
  @ApiOperation({
    summary: 'email_send_template — Send an email with {{variable}} placeholder substitution',
  })
  sendTemplate(@Body() dto: SendEmailTemplateDto) {
    return this.sendTemplateTool.execute(dto as unknown as Record<string, unknown>);
  }

  @Post('verify-smtp')
  @HttpCode(200)
  @ApiOperation({ summary: 'email_verify_smtp — Verify SMTP connection is reachable' })
  verifySmtp(@Body() dto: VerifySmtpDto) {
    return this.verifyTool.execute(dto as unknown as Record<string, unknown>);
  }
}
