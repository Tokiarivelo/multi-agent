import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import {
  IWorkflowCollaboratorRepository,
  IWorkflowInvitationRepository,
  WORKFLOW_COLLABORATOR_REPOSITORY,
  WORKFLOW_INVITATION_REPOSITORY,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import { WorkflowNotificationService } from '../../infrastructure/external/workflow-notification.service';
import { InviteCollaboratorDto } from '../dto/workflow-sharing.dto';
import { InvitationStatus } from '../../domain/entities/workflow-collaboration.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InviteCollaboratorUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepo: IWorkflowRepository,
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    @Inject(WORKFLOW_INVITATION_REPOSITORY)
    private readonly invitationRepo: IWorkflowInvitationRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: WorkflowNotificationService,
    private readonly config: ConfigService,
  ) {}

  async execute(
    workflowId: string,
    ownerId: string,
    dto: InviteCollaboratorDto,
  ): Promise<{ invitationId: string; isNewUser: boolean }> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ConflictException('Only the owner can invite collaborators');

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (targetUser) {
      const existing = await this.collaboratorRepo.findOne(workflowId, targetUser.id);
      if (existing && existing.status === InvitationStatus.ACCEPTED) {
        throw new ConflictException('User is already a collaborator');
      }

      // Existing user: add directly as accepted collaborator — no email
      let collaboratorId: string;
      if (existing) {
        await this.collaboratorRepo.updateRole(existing.id, dto.role);
        await this.collaboratorRepo.updateStatus(
          existing.id,
          InvitationStatus.ACCEPTED,
          new Date(),
        );
        collaboratorId = existing.id;
      } else {
        const collab = await this.collaboratorRepo.create({
          workflowId,
          userId: targetUser.id,
          role: dto.role,
          invitedBy: ownerId,
          status: InvitationStatus.ACCEPTED,
        });
        collaboratorId = collab.id;
      }

      // Create in-app notification for the added user
      const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
      await this.prisma.notification.create({
        data: {
          userId: targetUser.id,
          type: 'collaborator_added',
          payload: {
            workflowId,
            workflowName: workflow.name,
            inviterName: `${owner?.firstName ?? ''} ${owner?.lastName ?? ''}`.trim(),
            role: dto.role,
          },
        },
      });

      return { invitationId: collaboratorId, isNewUser: false };
    }

    // New user: check for duplicate pending invite then send email
    const existingInvite = await this.invitationRepo
      .findPendingByEmail(dto.email)
      .then((invs) => invs.find((i) => i.workflowId === workflowId));
    if (existingInvite) throw new ConflictException('Invitation already pending for this email');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.invitationRepo.create({
      workflowId,
      email: dto.email,
      invitedBy: ownerId,
      role: dto.role,
      expiresAt,
    });

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    await this.notifications.sendInvitationEmail({
      toEmail: dto.email,
      inviterName: `${owner?.firstName ?? ''} ${owner?.lastName ?? ''}`.trim(),
      workflowName: workflow.name,
      role: dto.role,
      acceptUrl: `${appUrl}/invitations/accept?token=${invitation.token}`,
      declineUrl: `${appUrl}/invitations/decline?token=${invitation.token}`,
      isNewUser: true,
      registrationUrl: `${appUrl}/register?invitationToken=${invitation.token}`,
    });

    return { invitationId: invitation.id, isNewUser: true };
  }
}
