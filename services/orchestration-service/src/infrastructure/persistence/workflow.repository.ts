import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IWorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import {
  Workflow,
  WorkflowStatus as DomainWorkflowStatus,
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

  async findByUserId(userId: string): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map((w: any) => this.toDomain(w));
  }

  async findByStatus(status: DomainWorkflowStatus): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { status: status as unknown as PrismaWorkflowStatus },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map((w: any) => this.toDomain(w));
  }

  async create(data: {
    name: string;
    description: string;
    definition: any;
    status: DomainWorkflowStatus;
    userId: string;
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

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ workflows: Workflow[]; total: number }> {
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
      workflows: workflows.map((w) => this.toDomain(w)),
      total,
    };
  }

  private toDomain(workflow: any): Workflow {
    return new Workflow({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? '',
      definition: (workflow.definition as any) || {
        nodes: workflow.nodes,
        edges: workflow.edges,
        version: 1,
      },
      status: workflow.status as unknown as DomainWorkflowStatus,
      userId: workflow.userId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  }
}
