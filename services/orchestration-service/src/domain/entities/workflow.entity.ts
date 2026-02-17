export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum NodeType {
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  CONDITIONAL = 'CONDITIONAL',
  TRANSFORM = 'TRANSFORM',
  START = 'START',
  END = 'END',
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  version: number;
}

export class Workflow {
  id!: string;
  name!: string;
  description!: string;
  definition!: WorkflowDefinition;
  status!: WorkflowStatus;
  userId!: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<Workflow>) {
    Object.assign(this, partial);
  }

  isActive(): boolean {
    return this.status === WorkflowStatus.ACTIVE;
  }

  activate(): void {
    this.status = WorkflowStatus.ACTIVE;
  }

  deactivate(): void {
    this.status = WorkflowStatus.INACTIVE;
  }

  archive(): void {
    this.status = WorkflowStatus.ARCHIVED;
  }

  updateDefinition(definition: WorkflowDefinition): void {
    this.definition = {
      ...definition,
      version: this.definition.version + 1,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.definition.nodes || this.definition.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    const startNodes = this.definition.nodes.filter((n) => n.type === NodeType.START);
    if (startNodes.length === 0) {
      errors.push('Workflow must have a START node');
    } else if (startNodes.length > 1) {
      errors.push('Workflow can only have one START node');
    }

    const endNodes = this.definition.nodes.filter((n) => n.type === NodeType.END);
    if (endNodes.length === 0) {
      errors.push('Workflow must have at least one END node');
    }

    const nodeIds = new Set(this.definition.nodes.map((n) => n.id));
    for (const edge of this.definition.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
