import { Injectable } from '@nestjs/common';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class SendEmailTool implements McpToolHandler {
  constructor(private readonly email: EmailApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'email_send',
      description: 'Send an email via SMTP. Supports plain text and HTML bodies.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address(es), comma-separated' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Plain-text body' },
          html: { type: 'string', description: 'HTML body (overrides body if provided)' },
          from: { type: 'string', description: 'Sender address (uses SMTP_FROM env if omitted)' },
          smtpHost: { type: 'string', description: 'SMTP host (uses SMTP_HOST env if omitted)' },
          smtpPort: { type: 'string', description: 'SMTP port (uses SMTP_PORT env if omitted)' },
          smtpUser: { type: 'string', description: 'SMTP user (uses SMTP_USER env if omitted)' },
          smtpPass: {
            type: 'string',
            description: 'SMTP password (uses SMTP_PASS env if omitted)',
          },
        },
        required: ['to', 'subject'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.email.sendEmail({
      to: args['to'] as string,
      subject: args['subject'] as string,
      body: args['body'] as string | undefined,
      html: args['html'] as string | undefined,
      from: args['from'] as string | undefined,
      smtpHost: args['smtpHost'] as string | undefined,
      smtpPort: args['smtpPort'] ? Number(args['smtpPort']) : undefined,
      smtpUser: args['smtpUser'] as string | undefined,
      smtpPass: args['smtpPass'] as string | undefined,
    });
    return textResult({ success: true, ...result });
  }
}
