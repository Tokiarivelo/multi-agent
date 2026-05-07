import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string;
  contentType?: string;
}

export interface SendEmailParams {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SentEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

@Injectable()
export class EmailApiService {
  private readonly logger = new Logger(EmailApiService.name);
  private readonly defaultSmtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };

  constructor(private readonly config: ConfigService) {
    this.defaultSmtp = {
      host: this.config.get<string>('smtp.host', 'smtp.gmail.com'),
      port: this.config.get<number>('smtp.port', 587),
      user: this.config.get<string>('smtp.user', ''),
      pass: this.config.get<string>('smtp.pass', ''),
      from: this.config.get<string>('smtp.from', ''),
    };
    this.logger.log(
      `SMTP config loaded — host: ${this.defaultSmtp.host}, port: ${this.defaultSmtp.port}, user: "${this.defaultSmtp.user || '(none)'}", from: "${this.defaultSmtp.from || '(none)'}", pass: ${this.defaultSmtp.pass ? '(set)' : '(not set)'}`,
    );
  }

  private buildTransporter(params: Partial<SendEmailParams>): Transporter {
    const host = params.smtpHost ?? this.defaultSmtp.host;
    const port = params.smtpPort ?? this.defaultSmtp.port;
    const user = params.smtpUser ?? this.defaultSmtp.user;
    const pass = params.smtpPass ?? this.defaultSmtp.pass;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendEmail(params: SendEmailParams): Promise<SentEmailResult> {
    const host = params.smtpHost ?? this.defaultSmtp.host;
    const port = params.smtpPort ?? this.defaultSmtp.port;
    const user = params.smtpUser ?? this.defaultSmtp.user;
    const from = params.from ?? this.defaultSmtp.from;

    this.logger.log(
      `Sending email — to: ${JSON.stringify(params.to)}, subject: "${params.subject}", from: "${from}", smtp: ${host}:${port}, user: "${user || '(none)'}", auth: ${user ? 'yes' : 'no'}`,
    );

    const transporter = this.buildTransporter(params);

    try {
      const info = await transporter.sendMail({
        from,
        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
        subject: params.subject,
        text: params.body,
        html: params.html,
        attachments: params.attachments,
      });

      this.logger.log(
        `Email sent — messageId: ${info.messageId}, accepted: ${JSON.stringify(info.accepted)}, rejected: ${JSON.stringify(info.rejected)}`,
      );

      return {
        messageId: info.messageId as string,
        accepted: (info.accepted as string[]) ?? [],
        rejected: (info.rejected as string[]) ?? [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Failed to send email — smtp: ${host}:${port}, user: "${user || '(none)'}", from: "${from}", to: ${JSON.stringify(params.to)}, error: ${message}`,
        stack,
      );
      throw err;
    }
  }

  async verifyConnection(params: Partial<SendEmailParams> = {}): Promise<boolean> {
    try {
      const transporter = this.buildTransporter(params);
      await transporter.verify();
      return true;
    } catch (err) {
      this.logger.warn(
        `SMTP connection verify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
