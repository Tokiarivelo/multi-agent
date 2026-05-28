export enum WorkflowVisibility {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  PUBLIC = 'PUBLIC',
}

export enum CollaboratorRole {
  VIEWER = 'VIEWER',
  EXECUTOR = 'EXECUTOR',
  EDITOR = 'EDITOR',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum AccessRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export enum ChangeAction {
  CREATED = 'CREATED',
  NODE_ADDED = 'NODE_ADDED',
  NODE_UPDATED = 'NODE_UPDATED',
  NODE_REMOVED = 'NODE_REMOVED',
  EDGE_ADDED = 'EDGE_ADDED',
  EDGE_REMOVED = 'EDGE_REMOVED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  VISIBILITY_CHANGED = 'VISIBILITY_CHANGED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  FORKED = 'FORKED',
}

export class WorkflowCollaborator {
  id!: string;
  workflowId!: string;
  userId!: string;
  role!: CollaboratorRole;
  invitedBy!: string;
  invitedAt!: Date;
  acceptedAt?: Date;
  status!: InvitationStatus;
  firstName?: string;
  lastName?: string;
  email?: string;

  constructor(partial: Partial<WorkflowCollaborator>) {
    Object.assign(this, partial);
  }
}

export class WorkflowInvitation {
  id!: string;
  workflowId!: string;
  email!: string;
  invitedBy!: string;
  role!: CollaboratorRole;
  token!: string;
  status!: InvitationStatus;
  expiresAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<WorkflowInvitation>) {
    Object.assign(this, partial);
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}

export class WorkflowAccessRequest {
  id!: string;
  workflowId!: string;
  requesterId!: string;
  status!: AccessRequestStatus;
  message?: string;
  requestedAt!: Date;
  respondedAt?: Date;

  constructor(partial: Partial<WorkflowAccessRequest>) {
    Object.assign(this, partial);
  }
}

export class WorkflowChangeLog {
  id!: string;
  workflowId!: string;
  userId!: string;
  action!: ChangeAction;
  details!: Record<string, unknown>;
  createdAt!: Date;

  constructor(partial: Partial<WorkflowChangeLog>) {
    Object.assign(this, partial);
  }
}
