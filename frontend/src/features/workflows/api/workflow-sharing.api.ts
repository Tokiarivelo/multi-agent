import { apiClient } from '@/lib/api-client';
import type {
  Workflow,
  WorkflowCollaborator,
  WorkflowInvitation,
  WorkflowAccessRequest,
  WorkflowChangeLog,
  WorkflowForkRequest,
  CollaboratorRole,
  WorkflowVisibility,
} from '@/types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Public workflows ─────────────────────────────────────────────────────────

export const listPublicWorkflows = async (page = 1, limit = 20): Promise<PaginatedResponse<Workflow>> => {
  const { data } = await apiClient.get<PaginatedResponse<Workflow>>(`/api/workflows/public?page=${page}&limit=${limit}`);
  return data;
};

export const listSharedWithMe = async (userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Workflow>> => {
  const { data } = await apiClient.get<PaginatedResponse<Workflow>>(
    `/api/workflows/shared-with-me?userId=${userId}&page=${page}&limit=${limit}`,
  );
  return data;
};

// ─── Visibility ───────────────────────────────────────────────────────────────

export const setWorkflowVisibility = async (
  workflowId: string,
  userId: string,
  visibility: WorkflowVisibility,
): Promise<void> => {
  await apiClient.put(`/api/workflows/${workflowId}/visibility?userId=${userId}`, { visibility });
};

// ─── Collaborators ────────────────────────────────────────────────────────────

export const listCollaborators = async (workflowId: string, userId: string): Promise<WorkflowCollaborator[]> => {
  const { data } = await apiClient.get<WorkflowCollaborator[]>(
    `/api/workflows/${workflowId}/collaborators?userId=${userId}`,
  );
  return data;
};

export const inviteCollaborator = async (
  workflowId: string,
  userId: string,
  email: string,
  role: CollaboratorRole,
): Promise<{ invitationId: string; isNewUser: boolean }> => {
  const { data } = await apiClient.post<{ invitationId: string; isNewUser: boolean }>(
    `/api/workflows/${workflowId}/collaborators/invite?userId=${userId}`,
    { email, role },
  );
  return data;
};

export const updateCollaboratorRole = async (
  workflowId: string,
  collaboratorId: string,
  userId: string,
  role: CollaboratorRole,
): Promise<WorkflowCollaborator> => {
  const { data } = await apiClient.put<WorkflowCollaborator>(
    `/api/workflows/${workflowId}/collaborators/${collaboratorId}?userId=${userId}`,
    { role },
  );
  return data;
};

export const removeCollaborator = async (
  workflowId: string,
  collaboratorId: string,
  userId: string,
): Promise<void> => {
  await apiClient.delete(`/api/workflows/${workflowId}/collaborators/${collaboratorId}?userId=${userId}`);
};

// ─── Invitations ──────────────────────────────────────────────────────────────

export const listPendingInvitations = async (userId: string): Promise<WorkflowInvitation[]> => {
  const { data } = await apiClient.get<WorkflowInvitation[]>(`/api/workflows/invitations/pending?userId=${userId}`);
  return data;
};

export const getInvitationByToken = async (token: string): Promise<WorkflowInvitation> => {
  const { data } = await apiClient.get<WorkflowInvitation>(`/api/workflows/invitations/by-token?token=${token}`);
  return data;
};

export const acceptInvitation = async (token: string, userId: string): Promise<void> => {
  await apiClient.post(`/api/workflows/invitations/accept?userId=${userId}`, { token });
};

export const declineInvitation = async (token: string, userEmail: string): Promise<void> => {
  await apiClient.post(`/api/workflows/invitations/decline?userEmail=${encodeURIComponent(userEmail)}`, {
    token,
  });
};

// ─── Access requests ──────────────────────────────────────────────────────────

export const listAccessRequests = async (workflowId: string, userId: string): Promise<WorkflowAccessRequest[]> => {
  const { data } = await apiClient.get<WorkflowAccessRequest[]>(
    `/api/workflows/${workflowId}/access-requests?userId=${userId}`,
  );
  return data;
};

export const requestAccess = async (workflowId: string, userId: string, message?: string): Promise<WorkflowAccessRequest> => {
  const { data } = await apiClient.post<WorkflowAccessRequest>(
    `/api/workflows/${workflowId}/access-requests?userId=${userId}`,
    { message },
  );
  return data;
};

export const respondToAccessRequest = async (
  workflowId: string,
  requestId: string,
  userId: string,
  decision: 'APPROVED' | 'DENIED',
): Promise<void> => {
  await apiClient.put(
    `/api/workflows/${workflowId}/access-requests/${requestId}/respond?userId=${userId}`,
    { decision },
  );
};

// ─── Forking ──────────────────────────────────────────────────────────────────

export const forkWorkflow = async (workflowId: string, userId: string, name?: string): Promise<Workflow> => {
  const { data } = await apiClient.post<Workflow>(`/api/workflows/${workflowId}/fork?userId=${userId}`, { name });
  return data;
};

export const checkUpstreamChanges = async (forkId: string, userId: string): Promise<{ hasChanges: boolean; upstreamUpdatedAt?: string }> => {
  const { data } = await apiClient.get<{ hasChanges: boolean; upstreamUpdatedAt?: string }>(
    `/api/workflows/${forkId}/fork/upstream-changes?userId=${userId}`,
  );
  return data;
};

export const pullUpstreamChanges = async (forkId: string, userId: string): Promise<Workflow> => {
  const { data } = await apiClient.post<Workflow>(`/api/workflows/${forkId}/fork/pull?userId=${userId}`, {});
  return data;
};

// ─── Fork requests ────────────────────────────────────────────────────────────

export const listIncomingForkRequests = async (userId: string): Promise<WorkflowForkRequest[]> => {
  const { data } = await apiClient.get<WorkflowForkRequest[]>(
    `/api/workflows/fork-requests/incoming?userId=${userId}`,
  );
  return data;
};

export const requestFork = async (workflowId: string, userId: string, message?: string): Promise<WorkflowForkRequest> => {
  const { data } = await apiClient.post<WorkflowForkRequest>(
    `/api/workflows/${workflowId}/fork-requests?userId=${userId}`,
    { message },
  );
  return data;
};

export const listForkRequests = async (workflowId: string, userId: string): Promise<WorkflowForkRequest[]> => {
  const { data } = await apiClient.get<WorkflowForkRequest[]>(
    `/api/workflows/${workflowId}/fork-requests?userId=${userId}`,
  );
  return data;
};

export const respondToForkRequest = async (
  workflowId: string,
  requestId: string,
  userId: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<void> => {
  await apiClient.put(
    `/api/workflows/${workflowId}/fork-requests/${requestId}/respond?userId=${userId}`,
    { decision },
  );
};

// ─── Change history ───────────────────────────────────────────────────────────

export const getWorkflowHistory = async (workflowId: string, userId: string, page = 1, limit = 30): Promise<PaginatedResponse<WorkflowChangeLog>> => {
  const { data } = await apiClient.get<PaginatedResponse<WorkflowChangeLog>>(
    `/api/workflows/${workflowId}/history?userId=${userId}&page=${page}&limit=${limit}`,
  );
  return data;
};
