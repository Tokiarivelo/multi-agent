import { Agent, AgentExecution } from '../entities/agent.entity';

export interface PaginatedAgents {
  data: Agent[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedAgentExecutions {
  data: AgentExecution[];
  total: number;
  page: number;
  limit: number;
}

export interface IAgentRepository {
  create(data: Partial<Agent>): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findAll(filters?: AgentFilters): Promise<PaginatedAgents>;
  update(id: string, data: Partial<Agent>): Promise<Agent>;
  delete(id: string): Promise<void>;

  createExecution(data: Partial<AgentExecution>): Promise<AgentExecution>;
  findExecutionById(id: string): Promise<AgentExecution | null>;
  findExecutionsByAgentId(
    agentId: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedAgentExecutions>;
  updateExecution(id: string, data: Partial<AgentExecution>): Promise<AgentExecution>;
}

export interface AgentFilters {
  userId?: string;
  name?: string;
  modelId?: string;
  page?: number;
  limit?: number;
}

export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
