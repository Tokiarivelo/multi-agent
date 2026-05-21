import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IWorkflowCollaboratorRepository,
  IWorkflowInvitationRepository,
  WORKFLOW_COLLABORATOR_REPOSITORY,
  WORKFLOW_INVITATION_REPOSITORY,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import { InvitationStatus } from '../../domain/entities/workflow-collaboration.entity';

@Injectable()
export class ManageInvitationUseCase {
  constructor(
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    @Inject(WORKFLOW_INVITATION_REPOSITORY)
    private readonly invitationRepo: IWorkflowInvitationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async accept(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }
    if (invitation.isExpired()) {
      await this.invitationRepo.updateStatus(invitation.id, InvitationStatus.EXPIRED);
      throw new BadRequestException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new BadRequestException('This invitation was sent to a different email address');
    }

    const existing = await this.collaboratorRepo.findOne(invitation.workflowId, userId);
    if (existing) {
      await this.collaboratorRepo.updateStatus(existing.id, InvitationStatus.ACCEPTED, new Date());
    } else {
      await this.collaboratorRepo.create({
        workflowId: invitation.workflowId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        status: InvitationStatus.ACCEPTED,
      });
    }

    await this.invitationRepo.updateStatus(invitation.id, InvitationStatus.ACCEPTED);
  }

  async decline(token: string, userEmail: string): Promise<void> {
    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }
    if (invitation.email !== userEmail) {
      throw new BadRequestException('This invitation was sent to a different email address');
    }
    await this.invitationRepo.updateStatus(invitation.id, InvitationStatus.DECLINED);
  }

  async listPendingForUser(userId: string): Promise<any[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const invitations = await this.invitationRepo.findPendingByEmail(user.email);
    return invitations.map((inv) => ({
      id: inv.id,
      workflowId: inv.workflowId,
      role: inv.role,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt,
      token: inv.token,
    }));
  }

  async getByToken(token: string): Promise<any> {
    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) throw new NotFoundException('Invitation not found');

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: invitation.workflowId },
      select: { id: true, name: true, description: true },
    });
    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { firstName: true, lastName: true, email: true },
    });

    return {
      ...invitation,
      workflow,
      inviter,
    };
  }
}
