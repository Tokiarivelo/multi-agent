import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import { Workflow, WorkflowNode, WorkflowEdge } from '../../domain/entities/workflow.entity';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { AddNodeDto, UpdateNodeDto, AddEdgeDto } from '../dto/node-operation.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UpdateWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
  ) {}

  // ─── Workflow-level update ────────────────────────────────────────────────

  async execute(id: string, dto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    return this.workflowRepository.update(id, {
      name: dto.name ?? workflow.name,
      description: dto.description ?? workflow.description,
      definition: dto.definition ?? workflow.definition,
      status: dto.status ?? workflow.status,
    });
  }

  // ─── Node operations ─────────────────────────────────────────────────────

  async addNode(workflowId: string, dto: AddNodeDto): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const node: WorkflowNode = {
      id: dto.id || uuidv4(),
      type: dto.type,
      customName: dto.customName,
      config: dto.config ?? {},
      position: dto.position ?? { x: 0, y: 0 },
    };

    const definition = {
      ...workflow.definition,
      nodes: [...workflow.definition.nodes, node],
    };

    return this.workflowRepository.update(workflowId, { definition });
  }

  async updateNode(workflowId: string, nodeId: string, dto: UpdateNodeDto): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const nodes = workflow.definition.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            type: dto.type ?? n.type,
            customName: dto.customName !== undefined ? dto.customName : n.customName,
            config: dto.config ?? n.config,
            position: dto.position ?? n.position,
          }
        : n,
    );

    return this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, nodes },
    });
  }

  async removeNode(workflowId: string, nodeId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const nodes = workflow.definition.nodes.filter((n) => n.id !== nodeId);
    const edges = workflow.definition.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );

    return this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, nodes, edges },
    });
  }

  // ─── Edge operations ─────────────────────────────────────────────────────

  async addEdge(workflowId: string, dto: AddEdgeDto): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const edge: WorkflowEdge = {
      id: dto.id || uuidv4(),
      source: dto.source,
      target: dto.target,
      condition: dto.condition,
    };

    const definition = {
      ...workflow.definition,
      edges: [...workflow.definition.edges, edge],
    };

    return this.workflowRepository.update(workflowId, { definition });
  }

  async removeEdge(workflowId: string, edgeId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const edges = workflow.definition.edges.filter((e) => e.id !== edgeId);

    return this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, edges },
    });
  }
}
