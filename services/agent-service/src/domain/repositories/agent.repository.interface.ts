import { Agent, AgentExecution } from '../entities/agent.entity';

export interface IAgentRepository {
  create(data: Partial<Agent>): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findAll(filters?: AgentFilters): Promise<Agent[]>;
  update(id: string, data: Partial<Agent>): Promise<Agent>;
  delete(id: string): Promise<void>;
  
  createExecution(data: Partial<AgentExecution>): Promise<AgentExecution>;
  findExecutionById(id: string): Promise<AgentExecution | null>;
  findExecutionsByAgentId(agentId: string): Promise<AgentExecution[]>;
  updateExecution(id: string, data: Partial<AgentExecution>): Promise<AgentExecution>;
}

export interface AgentFilters {
  name?: string;
  modelId?: string;
  limit?: number;
  offset?: number;
}

export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
