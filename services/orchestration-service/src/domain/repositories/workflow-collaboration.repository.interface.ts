import {
  WorkflowCollaborator,
  WorkflowInvitation,
  WorkflowAccessRequest,
  WorkflowChangeLog,
  CollaboratorRole,
  InvitationStatus,
  AccessRequestStatus,
  ChangeAction,
} from '../entities/workflow-collaboration.entity';

export interface IWorkflowCollaboratorRepository {
  findByWorkflowId(workflowId: string): Promise<WorkflowCollaborator[]>;
  findByUserId(userId: string): Promise<WorkflowCollaborator[]>;
  findOne(workflowId: string, userId: string): Promise<WorkflowCollaborator | null>;
  create(data: {
    workflowId: string;
    userId: string;
    role: CollaboratorRole;
    invitedBy: string;
    status?: InvitationStatus;
  }): Promise<WorkflowCollaborator>;
  updateRole(id: string, role: CollaboratorRole): Promise<WorkflowCollaborator>;
  updateStatus(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date,
  ): Promise<WorkflowCollaborator>;
  delete(id: string): Promise<void>;
}

export interface IWorkflowInvitationRepository {
  findByToken(token: string): Promise<WorkflowInvitation | null>;
  findByWorkflowId(workflowId: string): Promise<WorkflowInvitation[]>;
  findByEmail(email: string): Promise<WorkflowInvitation[]>;
  findPendingByEmail(email: string): Promise<WorkflowInvitation[]>;
  create(data: {
    workflowId: string;
    email: string;
    invitedBy: string;
    role: CollaboratorRole;
    expiresAt: Date;
  }): Promise<WorkflowInvitation>;
  updateStatus(id: string, status: InvitationStatus): Promise<WorkflowInvitation>;
  expireStale(): Promise<void>;
}

export interface IWorkflowAccessRequestRepository {
  findByWorkflowId(
    workflowId: string,
    status?: AccessRequestStatus,
  ): Promise<WorkflowAccessRequest[]>;
  findByRequesterId(requesterId: string): Promise<WorkflowAccessRequest[]>;
  findOne(workflowId: string, requesterId: string): Promise<WorkflowAccessRequest | null>;
  create(data: {
    workflowId: string;
    requesterId: string;
    message?: string;
  }): Promise<WorkflowAccessRequest>;
  updateStatus(id: string, status: AccessRequestStatus): Promise<WorkflowAccessRequest>;
}

export interface IWorkflowChangeLogRepository {
  findByWorkflowId(
    workflowId: string,
    limit?: number,
    offset?: number,
  ): Promise<WorkflowChangeLog[]>;
  countByWorkflowId(workflowId: string): Promise<number>;
  create(data: {
    workflowId: string;
    userId: string;
    action: ChangeAction;
    details: Record<string, unknown>;
  }): Promise<WorkflowChangeLog>;
}

export const WORKFLOW_COLLABORATOR_REPOSITORY = Symbol('WORKFLOW_COLLABORATOR_REPOSITORY');
export const WORKFLOW_INVITATION_REPOSITORY = Symbol('WORKFLOW_INVITATION_REPOSITORY');
export const WORKFLOW_ACCESS_REQUEST_REPOSITORY = Symbol('WORKFLOW_ACCESS_REQUEST_REPOSITORY');
export const WORKFLOW_CHANGE_LOG_REPOSITORY = Symbol('WORKFLOW_CHANGE_LOG_REPOSITORY');
