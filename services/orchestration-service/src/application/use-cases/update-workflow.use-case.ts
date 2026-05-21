import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import {
  IWorkflowChangeLogRepository,
  WORKFLOW_CHANGE_LOG_REPOSITORY,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import { Workflow, WorkflowNode, WorkflowEdge } from '../../domain/entities/workflow.entity';
import { ChangeAction } from '../../domain/entities/workflow-collaboration.entity';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { AddNodeDto, UpdateNodeDto, AddEdgeDto } from '../dto/node-operation.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UpdateWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
    @Optional()
    @Inject(WORKFLOW_CHANGE_LOG_REPOSITORY)
    private readonly changeLogRepo?: IWorkflowChangeLogRepository,
  ) {}

  private async log(
    workflowId: string,
    userId: string | undefined,
    action: ChangeAction,
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!this.changeLogRepo || !userId) return;
    await this.changeLogRepo.create({ workflowId, userId, action, details }).catch(() => {});
  }

  // ─── Workflow-level update ────────────────────────────────────────────────

  async execute(id: string, dto: UpdateWorkflowDto, userId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    let updatedDefinition = dto.definition ?? workflow.definition;

    if (updatedDefinition && updatedDefinition.nodes && updatedDefinition.edges) {
      const nodeIds = new Set(updatedDefinition.nodes.map((n) => n.id));
      updatedDefinition = {
        ...updatedDefinition,
        edges: updatedDefinition.edges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
        ),
      };
    }

    const updated = await this.workflowRepository.update(id, {
      name: dto.name ?? workflow.name,
      description: dto.description ?? workflow.description,
      definition: updatedDefinition,
      status: dto.status ?? workflow.status,
    });

    await this.log(id, userId, ChangeAction.SETTINGS_UPDATED, { fields: Object.keys(dto) });
    return updated;
  }

  // ─── Node operations ─────────────────────────────────────────────────────

  async addNode(workflowId: string, dto: AddNodeDto, userId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const node: WorkflowNode = {
      id: dto.id || uuidv4(),
      type: dto.type,
      customName: dto.customName,
      description: dto.description,
      config: dto.config ?? {},
      position: dto.position ?? { x: 0, y: 0 },
    };

    const definition = {
      ...workflow.definition,
      nodes: [...workflow.definition.nodes, node],
    };

    const updated = await this.workflowRepository.update(workflowId, { definition });
    await this.log(workflowId, userId, ChangeAction.NODE_ADDED, {
      nodeId: node.id,
      type: node.type,
    });
    return updated;
  }

  async updateNode(
    workflowId: string,
    nodeId: string,
    dto: UpdateNodeDto,
    userId?: string,
  ): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const nodes = workflow.definition.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            type: dto.type ?? n.type,
            customName: dto.customName !== undefined ? dto.customName : n.customName,
            description: dto.description !== undefined ? dto.description : n.description,
            config: dto.config ?? n.config,
            position: dto.position ?? n.position,
          }
        : n,
    );

    const updated = await this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, nodes },
    });
    await this.log(workflowId, userId, ChangeAction.NODE_UPDATED, { nodeId });
    return updated;
  }

  async removeNode(workflowId: string, nodeId: string, userId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const nodes = workflow.definition.nodes.filter((n) => n.id !== nodeId);
    const edges = workflow.definition.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );

    const updated = await this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, nodes, edges },
    });
    await this.log(workflowId, userId, ChangeAction.NODE_REMOVED, { nodeId });
    return updated;
  }

  // ─── Edge operations ─────────────────────────────────────────────────────

  async addEdge(workflowId: string, dto: AddEdgeDto, userId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const edge: WorkflowEdge = {
      id: dto.id || uuidv4(),
      source: dto.source,
      target: dto.target,
      condition: dto.condition,
      sourceHandle: dto.sourceHandle,
    };

    const definition = {
      ...workflow.definition,
      edges: [...workflow.definition.edges, edge],
    };

    const updated = await this.workflowRepository.update(workflowId, { definition });
    await this.log(workflowId, userId, ChangeAction.EDGE_ADDED, {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
    });
    return updated;
  }

  async removeEdge(workflowId: string, edgeId: string, userId?: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const edges = workflow.definition.edges.filter((e) => e.id !== edgeId);

    const updated = await this.workflowRepository.update(workflowId, {
      definition: { ...workflow.definition, edges },
    });
    await this.log(workflowId, userId, ChangeAction.EDGE_REMOVED, { edgeId });
    return updated;
  }
}
