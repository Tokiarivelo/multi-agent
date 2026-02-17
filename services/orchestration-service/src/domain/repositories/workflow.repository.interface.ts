import { Workflow, WorkflowStatus } from '../entities/workflow.entity';

export interface IWorkflowRepository {
  findById(id: string): Promise<Workflow | null>;
  findByUserId(userId: string): Promise<Workflow[]>;
  findByStatus(status: WorkflowStatus): Promise<Workflow[]>;
  create(workflow: {
    name: string;
    description: string;
    definition: any;
    status: WorkflowStatus;
    userId: string;
  }): Promise<Workflow>;
  update(id: string, workflow: Partial<Workflow>): Promise<Workflow>;
  delete(id: string): Promise<void>;
  findAll(page?: number, limit?: number): Promise<{ workflows: Workflow[]; total: number }>;
}

export const WORKFLOW_REPOSITORY = Symbol('WORKFLOW_REPOSITORY');
