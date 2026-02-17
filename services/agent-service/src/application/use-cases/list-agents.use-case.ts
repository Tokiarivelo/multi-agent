import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IAgentRepository, AGENT_REPOSITORY } from '../../domain/repositories/agent.repository.interface';
import { Agent } from '../../domain/entities/agent.entity';

export interface ListAgentsFilters {
  name?: string;
  modelId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ListAgentsUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
  ) {}

  async execute(filters?: ListAgentsFilters): Promise<Agent[]> {
    const agents = await this.agentRepository.findAll(filters);
    return agents;
  }

  async getById(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    return agent;
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    return this.agentRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    const agent = await this.agentRepository.findById(id);
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    
    await this.agentRepository.delete(id);
  }
}
