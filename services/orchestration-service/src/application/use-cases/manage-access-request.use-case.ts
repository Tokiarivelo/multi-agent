import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import {
  IWorkflowAccessRequestRepository,
  IWorkflowCollaboratorRepository,
  WORKFLOW_ACCESS_REQUEST_REPOSITORY,
  WORKFLOW_COLLABORATOR_REPOSITORY,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import { WorkflowNotificationService } from '../../infrastructure/external/workflow-notification.service';
import {
  AccessRequestStatus,
  WorkflowAccessRequest,
  CollaboratorRole,
  InvitationStatus,
} from '../../domain/entities/workflow-collaboration.entity';
import { WorkflowVisibility } from '../../domain/entities/workflow.entity';

@Injectable()
export class ManageAccessRequestUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepo: IWorkflowRepository,
    @Inject(WORKFLOW_ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepo: IWorkflowAccessRequestRepository,
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    private readonly prisma: PrismaService,
    private readonly notifications: WorkflowNotificationService,
  ) {}

  async requestAccess(
    workflowId: string,
    requesterId: string,
    message?: string,
  ): Promise<WorkflowAccessRequest> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.visibility !== WorkflowVisibility.PUBLIC) {
      throw new ForbiddenException('Access requests are only for public workflows');
    }
    if (workflow.userId === requesterId) {
      throw new ConflictException('You are the owner of this workflow');
    }

    const existing = await this.accessRequestRepo.findOne(workflowId, requesterId);
    if (existing && existing.status === AccessRequestStatus.PENDING) {
      throw new ConflictException('You already have a pending access request for this workflow');
    }

    const existingCollaborator = await this.collaboratorRepo.findOne(workflowId, requesterId);
    if (existingCollaborator && existingCollaborator.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('You already have access to this workflow');
    }

    const request = await this.accessRequestRepo.create({ workflowId, requesterId, message });

    const [owner, requester] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: workflow.userId },
        select: { email: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { firstName: true, lastName: true },
      }),
    ]);

    if (owner) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      await this.notifications.sendAccessRequestEmail({
        toEmail: owner.email,
        requesterName: `${requester?.firstName ?? ''} ${requester?.lastName ?? ''}`.trim(),
        workflowName: workflow.name,
        message,
        approveUrl: `${appUrl}/api/workflows/${workflowId}/access-requests/${request.id}/respond?decision=APPROVED`,
        denyUrl: `${appUrl}/api/workflows/${workflowId}/access-requests/${request.id}/respond?decision=DENIED`,
      });
    }

    return request;
  }

  async respond(
    workflowId: string,
    requestId: string,
    ownerId: string,
    decision: 'APPROVED' | 'DENIED',
  ): Promise<WorkflowAccessRequest> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can respond to access requests');

    const requests = await this.accessRequestRepo.findByWorkflowId(workflowId);
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new NotFoundException('Access request not found');
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new ConflictException('This request has already been responded to');
    }

    const status =
      decision === 'APPROVED' ? AccessRequestStatus.APPROVED : AccessRequestStatus.DENIED;
    const updated = await this.accessRequestRepo.updateStatus(requestId, status);

    if (decision === 'APPROVED') {
      const existing = await this.collaboratorRepo.findOne(workflowId, request.requesterId);
      if (!existing) {
        await this.collaboratorRepo.create({
          workflowId,
          userId: request.requesterId,
          role: CollaboratorRole.EXECUTOR,
          invitedBy: ownerId,
          status: InvitationStatus.ACCEPTED,
        });
      }
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: request.requesterId },
      select: { email: true },
    });
    if (requester) {
      await this.notifications.sendAccessResponseEmail({
        toEmail: requester.email,
        workflowName: workflow.name,
        approved: decision === 'APPROVED',
      });
    }

    return updated;
  }

  async listForWorkflow(workflowId: string, ownerId: string): Promise<WorkflowAccessRequest[]> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can view access requests');
    return this.accessRequestRepo.findByWorkflowId(workflowId);
  }
}
