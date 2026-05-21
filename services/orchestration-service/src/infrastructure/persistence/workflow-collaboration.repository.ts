import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IWorkflowCollaboratorRepository,
  IWorkflowInvitationRepository,
  IWorkflowAccessRequestRepository,
  IWorkflowChangeLogRepository,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import {
  WorkflowCollaborator,
  WorkflowInvitation,
  WorkflowAccessRequest,
  WorkflowChangeLog,
  CollaboratorRole,
  InvitationStatus,
  AccessRequestStatus,
  ChangeAction,
} from '../../domain/entities/workflow-collaboration.entity';

@Injectable()
export class WorkflowCollaboratorRepository implements IWorkflowCollaboratorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByWorkflowId(workflowId: string): Promise<WorkflowCollaborator[]> {
    const rows = await this.prisma.workflowCollaborator.findMany({
      where: { workflowId },
      include: { user: true },
    });
    return rows.map(this.toCollaboratorDomain);
  }

  async findByUserId(userId: string): Promise<WorkflowCollaborator[]> {
    const rows = await this.prisma.workflowCollaborator.findMany({ where: { userId } });
    return rows.map(this.toCollaboratorDomain);
  }

  async findOne(workflowId: string, userId: string): Promise<WorkflowCollaborator | null> {
    const row = await this.prisma.workflowCollaborator.findUnique({
      where: { workflowId_userId: { workflowId, userId } },
    });
    return row ? this.toCollaboratorDomain(row) : null;
  }

  async create(data: {
    workflowId: string;
    userId: string;
    role: CollaboratorRole;
    invitedBy: string;
    status?: InvitationStatus;
  }): Promise<WorkflowCollaborator> {
    const row = await this.prisma.workflowCollaborator.create({
      data: {
        workflowId: data.workflowId,
        userId: data.userId,
        role: data.role as any,
        invitedBy: data.invitedBy,
        status: (data.status ?? InvitationStatus.PENDING) as any,
      },
    });
    return this.toCollaboratorDomain(row);
  }

  async updateRole(id: string, role: CollaboratorRole): Promise<WorkflowCollaborator> {
    const row = await this.prisma.workflowCollaborator.update({
      where: { id },
      data: { role: role as any },
    });
    return this.toCollaboratorDomain(row);
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date,
  ): Promise<WorkflowCollaborator> {
    const row = await this.prisma.workflowCollaborator.update({
      where: { id },
      data: { status: status as any, ...(acceptedAt && { acceptedAt }) },
    });
    return this.toCollaboratorDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflowCollaborator.delete({ where: { id } });
  }

  private toCollaboratorDomain(row: any): WorkflowCollaborator {
    return new WorkflowCollaborator({
      id: row.id,
      workflowId: row.workflowId,
      userId: row.userId,
      role: row.role as CollaboratorRole,
      invitedBy: row.invitedBy,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt ?? undefined,
      status: row.status as InvitationStatus,
      firstName: row.user?.firstName ?? '',
      lastName: row.user?.lastName ?? '',
      email: row.user?.email ?? '',
    });
  }
}

@Injectable()
export class WorkflowInvitationRepository implements IWorkflowInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByToken(token: string): Promise<WorkflowInvitation | null> {
    const row = await this.prisma.workflowInvitation.findUnique({ where: { token } });
    return row ? this.toDomain(row) : null;
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowInvitation[]> {
    const rows = await this.prisma.workflowInvitation.findMany({ where: { workflowId } });
    return rows.map(this.toDomain);
  }

  async findByEmail(email: string): Promise<WorkflowInvitation[]> {
    const rows = await this.prisma.workflowInvitation.findMany({ where: { email } });
    return rows.map(this.toDomain);
  }

  async findPendingByEmail(email: string): Promise<WorkflowInvitation[]> {
    const rows = await this.prisma.workflowInvitation.findMany({
      where: { email, status: 'PENDING' as any, expiresAt: { gt: new Date() } },
    });
    return rows.map(this.toDomain);
  }

  async create(data: {
    workflowId: string;
    email: string;
    invitedBy: string;
    role: CollaboratorRole;
    expiresAt: Date;
  }): Promise<WorkflowInvitation> {
    const row = await this.prisma.workflowInvitation.create({
      data: {
        workflowId: data.workflowId,
        email: data.email,
        invitedBy: data.invitedBy,
        role: data.role as any,
        expiresAt: data.expiresAt,
        status: 'PENDING' as any,
      },
    });
    return this.toDomain(row);
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<WorkflowInvitation> {
    const row = await this.prisma.workflowInvitation.update({
      where: { id },
      data: { status: status as any },
    });
    return this.toDomain(row);
  }

  async expireStale(): Promise<void> {
    await this.prisma.workflowInvitation.updateMany({
      where: { status: 'PENDING' as any, expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' as any },
    });
  }

  private toDomain(row: any): WorkflowInvitation {
    return new WorkflowInvitation({
      id: row.id,
      workflowId: row.workflowId,
      email: row.email,
      invitedBy: row.invitedBy,
      role: row.role as CollaboratorRole,
      token: row.token,
      status: row.status as InvitationStatus,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

@Injectable()
export class WorkflowAccessRequestRepository implements IWorkflowAccessRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByWorkflowId(
    workflowId: string,
    status?: AccessRequestStatus,
  ): Promise<WorkflowAccessRequest[]> {
    const rows = await this.prisma.workflowAccessRequest.findMany({
      where: { workflowId, ...(status && { status: status as any }) },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map(this.toDomain);
  }

  async findByRequesterId(requesterId: string): Promise<WorkflowAccessRequest[]> {
    const rows = await this.prisma.workflowAccessRequest.findMany({
      where: { requesterId },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map(this.toDomain);
  }

  async findOne(workflowId: string, requesterId: string): Promise<WorkflowAccessRequest | null> {
    const row = await this.prisma.workflowAccessRequest.findUnique({
      where: { workflowId_requesterId: { workflowId, requesterId } },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: {
    workflowId: string;
    requesterId: string;
    message?: string;
  }): Promise<WorkflowAccessRequest> {
    const row = await this.prisma.workflowAccessRequest.create({
      data: {
        workflowId: data.workflowId,
        requesterId: data.requesterId,
        message: data.message,
        status: 'PENDING' as any,
      },
    });
    return this.toDomain(row);
  }

  async updateStatus(id: string, status: AccessRequestStatus): Promise<WorkflowAccessRequest> {
    const row = await this.prisma.workflowAccessRequest.update({
      where: { id },
      data: { status: status as any, respondedAt: new Date() },
    });
    return this.toDomain(row);
  }

  private toDomain(row: any): WorkflowAccessRequest {
    return new WorkflowAccessRequest({
      id: row.id,
      workflowId: row.workflowId,
      requesterId: row.requesterId,
      status: row.status as AccessRequestStatus,
      message: row.message ?? undefined,
      requestedAt: row.requestedAt,
      respondedAt: row.respondedAt ?? undefined,
    });
  }
}

@Injectable()
export class WorkflowChangeLogRepository implements IWorkflowChangeLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByWorkflowId(workflowId: string, limit = 50, offset = 0): Promise<WorkflowChangeLog[]> {
    const rows = await this.prisma.workflowChangeLog.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map(this.toDomain);
  }

  async countByWorkflowId(workflowId: string): Promise<number> {
    return this.prisma.workflowChangeLog.count({ where: { workflowId } });
  }

  async create(data: {
    workflowId: string;
    userId: string;
    action: ChangeAction;
    details: Record<string, unknown>;
  }): Promise<WorkflowChangeLog> {
    const row = await this.prisma.workflowChangeLog.create({
      data: {
        workflowId: data.workflowId,
        userId: data.userId,
        action: data.action as any,
        details: data.details as any,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: any): WorkflowChangeLog {
    return new WorkflowChangeLog({
      id: row.id,
      workflowId: row.workflowId,
      userId: row.userId,
      action: row.action as ChangeAction,
      details: row.details as Record<string, unknown>,
      createdAt: row.createdAt,
    });
  }
}
