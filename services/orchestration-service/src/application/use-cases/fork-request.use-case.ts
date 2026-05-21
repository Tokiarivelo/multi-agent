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

  async requestFork(workflowId: string, requesterId: string, message?: string) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.visibility !== 'PUBLIC') {
      throw new ForbiddenException('Fork requests are only available for public workflows');
    }
    if (workflow.userId === requesterId) {
      throw new ConflictException('You cannot request to fork your own workflow');
    }

    const existing = await this.prisma.workflowForkRequest.findUnique({
      where: { workflowId_requesterId: { workflowId, requesterId } },
    });
    if (existing && existing.status === 'PENDING') {
      throw new ConflictException('A pending fork request already exists');
    }

    if (existing) {
      return this.prisma.workflowForkRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING', message: message ?? null, respondedAt: null },
      });
    }

    return this.prisma.workflowForkRequest.create({
      data: { workflowId, requesterId, message: message ?? null },
    });
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
      const fork = await this.forkWorkflowUseCase.executeApproved(workflowId, request.requesterId);
      return { status, fork };
    }

    return { status };
  }
}
