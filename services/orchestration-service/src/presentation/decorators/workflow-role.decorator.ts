import { SetMetadata } from '@nestjs/common';

export type WorkflowRoleLevel = 'VIEWER' | 'EXECUTOR' | 'EDITOR' | 'OWNER';

export const WORKFLOW_ROLE_KEY = 'workflowRole';

export const RequireWorkflowRole = (role: WorkflowRoleLevel) =>
  SetMetadata(WORKFLOW_ROLE_KEY, role);
