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
} from '../tools';
import { FetchEmailsDto } from '../dto/fetch-emails.dto';
import { SendEmailDto } from '../dto/send-email.dto';
import { SendEmailTemplateDto } from '../dto/send-email-template.dto';
import { VerifySmtpDto } from '../dto/verify-smtp.dto';
import { ManipulateEmailsDto } from '../dto/manipulate-emails.dto';
import { ListAttachmentsDto } from '../dto/list-attachments.dto';
import { DownloadAttachmentDto } from '../dto/download-attachment.dto';

@ApiTags('Gmail — IMAP')
@Controller('tools/gmail')
export class GmailToolsController {
  constructor(
    private readonly fetchTool: FetchEmailsTool,
    private readonly manipulateTool: ManipulateEmailsTool,
    private readonly listTool: ListAttachmentsTool,
    private readonly downloadTool: DownloadAttachmentTool,
  ) {}

  @Post('fetch-emails')
  @HttpCode(200)
  @ApiOperation({
    summary: 'gmail_fetch_emails — Fetch emails from Gmail via IMAP',
    description:
      'Returns subject, sender, date, snippet, and UID for each matched email. Supports search filters.',
  })
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
