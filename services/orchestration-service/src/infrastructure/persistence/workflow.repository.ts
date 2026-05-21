import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IWorkflowRepository,
  PaginatedWorkflows,
} from '../../domain/repositories/workflow.repository.interface';
import {
  Workflow,
  WorkflowStatus as DomainWorkflowStatus,
  WorkflowVisibility,
} from '../../domain/entities/workflow.entity';
import { WorkflowStatus as PrismaWorkflowStatus } from '@prisma/client';

@Injectable()
export class WorkflowRepository implements IWorkflowRepository {
  private readonly logger = new Logger(WorkflowRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    return workflow ? this.toDomain(workflow) : null;
  }

  async findByUserId(
    userId: string,
    pageParam: number = 1,
    limitParam: number = 20,
  ): Promise<PaginatedWorkflows> {
    const page = pageParam || 1;
    const limit = limitParam || 20;
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ userId }, { collaborators: { some: { userId, status: 'ACCEPTED' as any } } }],
    };

    const [total, workflows] = await Promise.all([
      this.prisma.workflow.count({ where }),
      this.prisma.workflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          collaborators: {
            where: { status: 'ACCEPTED' as any },
            include: { user: true },
          },
        },
      }),
    ]);

    return {
      data: workflows.map((w: any) => this.toDomain(w)),
      total,
      page,
      limit,
    };
  }

  async findByStatus(
    status: DomainWorkflowStatus,
    pageParam: number = 1,
    limitParam: number = 20,
  ): Promise<PaginatedWorkflows> {
    const page = pageParam || 1;
    const limit = limitParam || 20;
    const skip = (page - 1) * limit;

    const [total, workflows] = await Promise.all([
      this.prisma.workflow.count({ where: { status: status as unknown as PrismaWorkflowStatus } }),
      this.prisma.workflow.findMany({
        where: { status: status as unknown as PrismaWorkflowStatus },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: workflows.map((w: any) => this.toDomain(w)),
      total,
      page,
      limit,
    };
  }

  async findPublic(page = 1, limit = 20): Promise<PaginatedWorkflows> {
    const skip = (page - 1) * limit;
    const [total, workflows] = await Promise.all([
      this.prisma.workflow.count({ where: { visibility: 'PUBLIC' as any } }),
      this.prisma.workflow.findMany({
        where: { visibility: 'PUBLIC' as any },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { data: workflows.map((w) => this.toDomain(w)), total, page, limit };
  }

  async findSharedWithUser(userId: string, page = 1, limit = 20): Promise<PaginatedWorkflows> {
    const skip = (page - 1) * limit;
    const [total, collaborators] = await Promise.all([
      this.prisma.workflowCollaborator.count({
        where: { userId, status: 'ACCEPTED' as any },
      }),
      this.prisma.workflowCollaborator.findMany({
        where: { userId, status: 'ACCEPTED' as any },
        include: { workflow: true },
        skip,
        take: limit,
        orderBy: { acceptedAt: 'desc' },
      }),
    ]);
    return {
      data: collaborators.map((c: any) => this.toDomain(c.workflow)),
      total,
      page,
      limit,
    };
  }

  async create(data: {
    name: string;
    description: string;
    definition: any;
    status: DomainWorkflowStatus;
    userId: string;
    visibility?: WorkflowVisibility;
    forkedFromId?: string;
  }): Promise<Workflow> {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        nodes: data.definition.nodes,
        edges: data.definition.edges,
        definition: data.definition,
        status: data.status as unknown as PrismaWorkflowStatus,
        userId: data.userId,
        visibility: (data.visibility ?? WorkflowVisibility.PRIVATE) as any,
        ...(data.forkedFromId && { forkedFromId: data.forkedFromId }),
      },
    });

    this.logger.log(`Created workflow ${workflow.id} for user ${data.userId}`);
    return this.toDomain(workflow);
  }

  async update(id: string, data: Partial<Workflow>): Promise<Workflow> {
    const updateData: any = {
      ...(data.name && { name: data.name }),
      ...(data.description && { description: data.description }),
      ...(data.status && { status: data.status as unknown as PrismaWorkflowStatus }),
      ...(data.visibility && { visibility: data.visibility as any }),
    };

    if (data.definition) {
      updateData.nodes = data.definition.nodes;
      updateData.edges = data.definition.edges;
      updateData.definition = data.definition as any;
    }

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Updated workflow ${id}`);
    return this.toDomain(workflow);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: { id },
    });

    this.logger.log(`Deleted workflow ${id}`);
  }

  async findAll(pageParam: number = 1, limitParam: number = 10): Promise<PaginatedWorkflows> {
    const page = pageParam || 1;
    const limit = limitParam || 10;
    const skip = (page - 1) * limit;

    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count(),
    ]);

    return {
      data: workflows.map((w) => this.toDomain(w)),
      total,
      page,
      limit,
    };
  }

  /**
   * Nodes generated by the AI use ReactFlow format: { id, type, data: { customName, config }, position }
   * The executor expects domain format: { id, type, customName, config, position }
   * Normalize whichever format is stored so the executor always gets a flat node.
   */
  private normalizeNode(node: any): any {
    if (node.config !== undefined) {
      // Already domain format
      return node;
    }
    const data = node.data ?? {};
    return {
      id: node.id,
      type: node.type,
      customName: node.customName ?? data.customName,
      config: data.config ?? {},
      position: node.position,
    };
  }

  private toDomain(workflow: any): Workflow {
    const rawDefinition = (workflow.definition as any) || {
      nodes: workflow.nodes ?? [],
      edges: workflow.edges ?? [],
      version: 1,
    };

    const definition = {
      ...rawDefinition,
      nodes: (rawDefinition.nodes ?? []).map((n: any) => this.normalizeNode(n)),
    };

    return new Workflow({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? '',
      definition,
      status: workflow.status as unknown as DomainWorkflowStatus,
      visibility:
        (workflow.visibility as unknown as WorkflowVisibility) ?? WorkflowVisibility.PRIVATE,
      userId: workflow.userId,
      forkedFromId: workflow.forkedFromId ?? undefined,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      owner: workflow.user
        ? {
            id: workflow.user.id,
            firstName: workflow.user.firstName,
            lastName: workflow.user.lastName,
            email: workflow.user.email,
          }
        : undefined,
      collaborators: workflow.collaborators
        ? workflow.collaborators.map((c: any) => ({
            userId: c.userId,
            firstName: c.user?.firstName ?? '',
            lastName: c.user?.lastName ?? '',
            email: c.user?.email ?? '',
            role: c.role,
          }))
        : undefined,
    });
  }
}
