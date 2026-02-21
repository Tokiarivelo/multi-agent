import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IAgentRepository,
  AgentFilters,
  PaginatedAgents,
  PaginatedAgentExecutions,
} from '../../domain/repositories/agent.repository.interface';
import { Agent, AgentExecution } from '../../domain/entities/agent.entity';

@Injectable()
export class AgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Partial<Agent>): Promise<Agent> {
    if (!data.name || !data.modelId || !data.userId) {
      throw new Error('Agent name, modelId, and userId are required');
    }

    const agent = await this.prisma.agent.create({
      data: {
        userId: data.userId,
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

  async findAll(filters?: AgentFilters): Promise<PaginatedAgents> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    if (filters?.modelId) {
      where.modelId = filters.modelId;
    }

    const [total, agents] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: agents.map((agent) => this.mapToEntity(agent)),
      total,
      page,
      limit,
    };
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
    if (!data.agentId || !data.input) {
      throw new Error('AgentId and input are required for execution');
    }

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

  async findExecutionsByAgentId(
    agentId: string,
    pageParam?: number,
    limitParam?: number,
  ): Promise<PaginatedAgentExecutions> {
    const page = pageParam || 1;
    const limit = limitParam || 20;
    const skip = (page - 1) * limit;

    const [total, executions] = await Promise.all([
      this.prisma.agentExecution.count({ where: { agentId } }),
      this.prisma.agentExecution.findMany({
        where: { agentId },
        take: limit,
        skip,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      data: executions.map((exec) => this.mapExecutionToEntity(exec)),
      total,
      page,
      limit,
    };
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
      userId: agent.userId,
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
