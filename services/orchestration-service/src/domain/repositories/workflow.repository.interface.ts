import { Workflow, WorkflowStatus } from '../entities/workflow.entity';

export interface PaginatedWorkflows {
  data: Workflow[];
  total: number;
  page: number;
  limit: number;
}

export interface IWorkflowRepository {
  findById(id: string): Promise<Workflow | null>;
  findByUserId(userId: string, page?: number, limit?: number): Promise<PaginatedWorkflows>;
  findByStatus(status: WorkflowStatus, page?: number, limit?: number): Promise<PaginatedWorkflows>;
  create(workflow: {
    name: string;
    description: string;
    definition: any;
    status: WorkflowStatus;
    userId: string;
  }): Promise<Workflow>;
  update(id: string, workflow: Partial<Workflow>): Promise<Workflow>;
  delete(id: string): Promise<void>;
  findAll(page?: number, limit?: number): Promise<PaginatedWorkflows>;
}

export const WORKFLOW_REPOSITORY = Symbol('WORKFLOW_REPOSITORY');
