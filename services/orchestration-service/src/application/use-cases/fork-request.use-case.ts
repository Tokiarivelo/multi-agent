import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ForkWorkflowUseCase } from './fork-workflow.use-case';

export type ForkRequestDecision = 'APPROVED' | 'REJECTED';

@Injectable()
export class ForkRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forkWorkflowUseCase: ForkWorkflowUseCase,
  ) {}

  async requestFork(
    workflowId: string,
    requesterId: string,
    message?: string,
    type: 'fork' | 'view' = 'fork',
  ) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.visibility !== 'PUBLIC') {
      throw new ForbiddenException('Fork requests are only available for public workflows');
    }
    if (workflow.userId === requesterId) {
      throw new ConflictException('You cannot request to access your own workflow');
    }

    const existing = await this.prisma.workflowForkRequest.findUnique({
      where: { workflowId_requesterId_type: { workflowId, requesterId, type } },
    });
    if (existing && existing.status === 'PENDING') {
      throw new ConflictException('A pending request of this type already exists');
    }

    if (existing) {
      return this.prisma.workflowForkRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING', message: message ?? null, respondedAt: null },
      });
    }

    const created = await this.prisma.workflowForkRequest.create({
      data: { workflowId, requesterId, type, message: message ?? null },
      include: { requester: { select: { firstName: true, lastName: true, email: true } } },
    });

    // Notify the workflow owner
    await this.prisma.notification.create({
      data: {
        userId: workflow.userId,
        type: 'workflow_request_received',
        payload: {
          requestId: created.id,
          workflowId,
          workflowName: workflow.name,
          requesterId,
          requesterName:
            `${created.requester.firstName} ${created.requester.lastName}`.trim() ||
            created.requester.email,
          requestType: type,
        },
      },
    });

    return created;
  }

  async listAllIncoming(ownerId: string) {
    return this.prisma.workflowForkRequest.findMany({
      where: { status: 'PENDING', workflow: { userId: ownerId } },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        workflow: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForWorkflow(workflowId: string, ownerId: string) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can view fork requests');

    return this.prisma.workflowForkRequest.findMany({
      where: { workflowId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(
    workflowId: string,
    requestId: string,
    ownerId: string,
    decision: ForkRequestDecision,
  ) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can respond to fork requests');

    const request = await this.prisma.workflowForkRequest.findUnique({ where: { id: requestId } });
    if (!request || request.workflowId !== workflowId)
      throw new NotFoundException('Fork request not found');
    if (request.status !== 'PENDING') throw new ConflictException('Request already responded to');

    const status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    await this.prisma.workflowForkRequest.update({
      where: { id: requestId },
      data: { status, respondedAt: new Date() },
    });

    // Notify the requester
    await this.prisma.notification.create({
      data: {
        userId: request.requesterId,
        type: decision === 'APPROVED' ? 'fork_request_approved' : 'fork_request_rejected',
        payload: { workflowId, workflowName: workflow.name },
      },
    });

    if (decision === 'APPROVED') {
      if (request.type === 'view') {
        // Add the requester as a VIEWER collaborator
        await this.prisma.workflowCollaborator.upsert({
          where: { workflowId_userId: { workflowId, userId: request.requesterId } },
          create: {
            workflowId,
            userId: request.requesterId,
            role: 'VIEWER',
            invitedBy: ownerId,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
          update: { role: 'VIEWER', status: 'ACCEPTED', acceptedAt: new Date() },
        });
        return { status };
      }

      const fork = await this.forkWorkflowUseCase.executeApproved(workflowId, request.requesterId);
      return { status, fork };
    }

    return { status };
  }
}
