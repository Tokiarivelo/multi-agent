import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  IAgentRepository,
  AGENT_REPOSITORY,
  PaginatedAgents,
} from '../../domain/repositories/agent.repository.interface';
import { Agent } from '../../domain/entities/agent.entity';

export interface ListAgentsFilters {
  userId?: string;
  name?: string;
  modelId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListAgentsUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
  ) {}

  async execute(filters?: ListAgentsFilters): Promise<PaginatedAgents> {
    return this.agentRepository.findAll(filters);
  }

  async getById(id: string, userId: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    if (agent.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to access this agent');
    }

    return agent;
  }

  async update(id: string, data: Partial<Agent>, userId: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    if (agent.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to update this agent');
    }

    return this.agentRepository.update(id, data);
  }

  async delete(id: string, userId: string): Promise<void> {
    const agent = await this.agentRepository.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    if (agent.userId !== userId) {
      throw new UnauthorizedException('You do not have permission to delete this agent');
    }

    await this.agentRepository.delete(id);
  }
}
