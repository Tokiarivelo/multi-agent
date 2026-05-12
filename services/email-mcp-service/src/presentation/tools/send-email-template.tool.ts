import { Injectable } from '@nestjs/common';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/email-tool.interface';

@Injectable()
export class SendEmailTemplateTool implements McpToolHandler {
  constructor(private readonly email: EmailApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'email_send_template',
      description:
        'Send an email using a template with {{variable}} placeholders auto-replaced from variables.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address(es), comma-separated' },
          subject: { type: 'string', description: 'Subject — supports {{variable}} placeholders' },
          template: {
            type: 'string',
            description: 'HTML or plain-text template body — supports {{variable}} placeholders',
          },
          variables: {
            type: 'object',
            description: 'Key-value pairs for placeholder substitution',
          },
          from: { type: 'string', description: 'Sender address (uses SMTP_FROM env if omitted)' },
        },
        required: ['to', 'subject', 'template'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const to = args['to'] as string | undefined;
    const subjectRaw = args['subject'] as string | undefined;
    const templateRaw = args['template'] as string | undefined;

    if (!to) throw new Error('email_send_template: missing required argument "to"');
    if (!subjectRaw) throw new Error('email_send_template: missing required argument "subject"');
    if (!templateRaw) throw new Error('email_send_template: missing required argument "template"');

    const variables = (args['variables'] as Record<string, string>) ?? {};
    const replace = (str: string): string =>
      str.replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key.trim()] ?? '');

    const subject = replace(subjectRaw);
    const body = replace(templateRaw);
    const isHtml = body.trimStart().startsWith('<');

    const result = await this.email.sendEmail({
      to: args['to'] as string,
      subject,
      ...(isHtml ? { html: body } : { body }),
      from: args['from'] as string | undefined,
    });

    return textResult({ success: true, ...result });
  }
}
