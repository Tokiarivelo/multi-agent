import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IWorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { Workflow, WorkflowStatus } from '../../domain/entities/workflow.entity';

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

  async findByStatus(status: WorkflowStatus): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map((w: any) => this.toDomain(w));
  }

  async create(data: {
    name: string;
    description: string;
    definition: any;
    status: WorkflowStatus;
    userId: string;
  }): Promise<Workflow> {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        definition: data.definition,
        status: data.status,
        userId: data.userId,
      },
    });

    this.logger.log(`Created workflow ${workflow.id} for user ${data.userId}`);
    return this.toDomain(workflow);
  }

  async update(id: string, data: Partial<Workflow>): Promise<Workflow> {
    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        definition: data.definition,
        status: data.status,
      },
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
      workflows: workflows.map((w: any) => this.toDomain(w)),
      total,
    };
  }

  private toDomain(workflow: any): Workflow {
    return new Workflow({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      definition: workflow.definition,
      status: workflow.status as WorkflowStatus,
      userId: workflow.userId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  }
}
