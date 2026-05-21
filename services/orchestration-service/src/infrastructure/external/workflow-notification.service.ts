import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface InvitationEmailParams {
  toEmail: string;
  inviterName: string;
  workflowName: string;
  role: string;
  acceptUrl: string;
  declineUrl: string;
  isNewUser: boolean;
  registrationUrl?: string;
}

interface AccessRequestEmailParams {
  toEmail: string;
  requesterName: string;
  workflowName: string;
  message?: string;
  approveUrl: string;
  denyUrl: string;
}

interface AccessResponseEmailParams {
  toEmail: string;
  workflowName: string;
  approved: boolean;
}

@Injectable()
export class WorkflowNotificationService {
  private readonly logger = new Logger(WorkflowNotificationService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private async callEmailTool(
    emailServiceUrl: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${emailServiceUrl}/api/mcp`, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'email_send',
          arguments: { to, subject, html },
        },
      }),
    );
  }

  async sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
    const emailServiceUrl = this.config.get<string>(
      'EMAIL_MCP_SERVICE_URL',
      'http://localhost:3012',
    );
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    const html = params.isNewUser
      ? this.buildNewUserInviteBody(params, appUrl)
      : this.buildExistingUserInviteBody(params);

    try {
      await this.callEmailTool(
        emailServiceUrl,
        params.toEmail,
        `You have been invited to collaborate on "${params.workflowName}"`,
        html,
      );
    } catch (err) {
      this.logger.warn(`Failed to send invitation email to ${params.toEmail}: ${err}`);
    }
  }

  async sendAccessRequestEmail(params: AccessRequestEmailParams): Promise<void> {
    const emailServiceUrl = this.config.get<string>(
      'EMAIL_MCP_SERVICE_URL',
      'http://localhost:3012',
    );

    const html = `
      <h2>New Access Request for "${params.workflowName}"</h2>
      <p><strong>${params.requesterName}</strong> has requested access to your workflow.</p>
      ${params.message ? `<p>Message: "${params.message}"</p>` : ''}
      <p>
        <a href="${params.approveUrl}" style="background:#22c55e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px">Approve</a>
        <a href="${params.denyUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Deny</a>
      </p>
    `;

    try {
      await this.callEmailTool(
        emailServiceUrl,
        params.toEmail,
        `Access request for "${params.workflowName}"`,
        html,
      );
    } catch (err) {
      this.logger.warn(`Failed to send access request email: ${err}`);
    }
  }

  async sendAccessResponseEmail(params: AccessResponseEmailParams): Promise<void> {
    const emailServiceUrl = this.config.get<string>(
      'EMAIL_MCP_SERVICE_URL',
      'http://localhost:3012',
    );
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    const html = params.approved
      ? `<h2>Access Approved ✓</h2><p>Your request to access "<strong>${params.workflowName}</strong>" has been approved.</p>
         <p><a href="${appUrl}/workflows/public">View workflow</a></p>`
      : `<h2>Access Request Declined</h2><p>Your request to access "<strong>${params.workflowName}</strong>" has been declined.</p>`;

    try {
      await this.callEmailTool(
        emailServiceUrl,
        params.toEmail,
        `Access request ${params.approved ? 'approved' : 'declined'} for "${params.workflowName}"`,
        html,
      );
    } catch (err) {
      this.logger.warn(`Failed to send access response email: ${err}`);
    }
  }

  private buildExistingUserInviteBody(params: InvitationEmailParams): string {
    return `
      <h2>Workflow Collaboration Invitation</h2>
      <p><strong>${params.inviterName}</strong> has invited you to collaborate on "<strong>${params.workflowName}</strong>" as a <strong>${params.role}</strong>.</p>
      <p>
        <a href="${params.acceptUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px">Accept Invitation</a>
        <a href="${params.declineUrl}" style="background:#6b7280;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Decline</a>
      </p>
      <p style="color:#6b7280;font-size:12px">This invitation expires in 7 days.</p>
    `;
  }

  private buildNewUserInviteBody(params: InvitationEmailParams, _appUrl: string): string {
    return `
      <h2>You've been invited to join the platform!</h2>
      <p><strong>${params.inviterName}</strong> has invited you to collaborate on "<strong>${params.workflowName}</strong>" as a <strong>${params.role}</strong>.</p>
      <p>Create your account to accept the invitation:</p>
      <p>
        <a href="${params.registrationUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Create Account & Accept</a>
      </p>
      <p style="color:#6b7280;font-size:12px">This invitation expires in 7 days.</p>
    `;
  }
}
