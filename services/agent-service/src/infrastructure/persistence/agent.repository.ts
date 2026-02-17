import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IAgentRepository, AgentFilters } from '../../domain/repositories/agent.repository.interface';
import { Agent, AgentExecution } from '../../domain/entities/agent.entity';

@Injectable()
export class AgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Partial<Agent>): Promise<Agent> {
    const agent = await this.prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        modelId: data.modelId,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        tools: data.tools || [],
        metadata: data.metadata || {},
      },
    });
    
    return this.mapToEntity(agent);
  }

  async findById(id: string): Promise<Agent | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });
    
    return agent ? this.mapToEntity(agent) : null;
  }

  async findAll(filters?: AgentFilters): Promise<Agent[]> {
    const where: any = {};
    
    if (filters?.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }
    
    if (filters?.modelId) {
      where.modelId = filters.modelId;
    }
    
    const agents = await this.prisma.agent.findMany({
      where,
      take: filters?.limit,
      skip: filters?.offset,
      orderBy: { createdAt: 'desc' },
    });
    
    return agents.map(agent => this.mapToEntity(agent));
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        modelId: data.modelId,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        tools: data.tools,
        metadata: data.metadata,
      },
    });
    
    return this.mapToEntity(agent);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agent.delete({
      where: { id },
    });
  }

  async createExecution(data: Partial<AgentExecution>): Promise<AgentExecution> {
    const execution = await this.prisma.agentExecution.create({
      data: {
        agentId: data.agentId,
        input: data.input,
        status: data.status,
        startedAt: data.startedAt,
      },
    });
    
    return this.mapExecutionToEntity(execution);
  }

  async findExecutionById(id: string): Promise<AgentExecution | null> {
    const execution = await this.prisma.agentExecution.findUnique({
      where: { id },
    });
    
    return execution ? this.mapExecutionToEntity(execution) : null;
  }

  async findExecutionsByAgentId(agentId: string): Promise<AgentExecution[]> {
    const executions = await this.prisma.agentExecution.findMany({
      where: { agentId },
      orderBy: { startedAt: 'desc' },
    });
    
    return executions.map(exec => this.mapExecutionToEntity(exec));
  }

  async updateExecution(id: string, data: Partial<AgentExecution>): Promise<AgentExecution> {
    const execution = await this.prisma.agentExecution.update({
      where: { id },
      data: {
        output: data.output,
        tokens: data.tokens,
        status: data.status,
        error: data.error,
        completedAt: data.completedAt,
      },
    });
    
    return this.mapExecutionToEntity(execution);
  }

  private mapToEntity(agent: any): Agent {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      modelId: agent.modelId,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      tools: agent.tools,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private mapExecutionToEntity(execution: any): AgentExecution {
    return {
      id: execution.id,
      agentId: execution.agentId,
      input: execution.input,
      output: execution.output,
      tokens: execution.tokens,
      status: execution.status,
      error: execution.error,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    };
  }
}
