import { Injectable } from '@nestjs/common';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class VerifySmtpTool implements McpToolHandler {
  constructor(private readonly email: EmailApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'email_verify_smtp',
      description: 'Verify SMTP connection is working before sending emails.',
      inputSchema: {
        type: 'object',
        properties: {
          smtpHost: { type: 'string', description: 'SMTP host to test' },
          smtpPort: { type: 'string', description: 'SMTP port to test' },
          smtpUser: { type: 'string', description: 'SMTP user to test' },
          smtpPass: { type: 'string', description: 'SMTP password to test' },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const ok = await this.email.verifyConnection({
      smtpHost: args['smtpHost'] as string | undefined,
      smtpPort: args['smtpPort'] ? Number(args['smtpPort']) : undefined,
      smtpUser: args['smtpUser'] as string | undefined,
      smtpPass: args['smtpPass'] as string | undefined,
    });
    return textResult({ connected: ok });
  }
}
