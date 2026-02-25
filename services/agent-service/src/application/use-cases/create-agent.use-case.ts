import { Injectable, Inject } from '@nestjs/common';
import {
  IAgentRepository,
  AGENT_REPOSITORY,
} from '../../domain/repositories/agent.repository.interface';
import { CreateAgentDto } from '../dto/create-agent.dto';
import { Agent } from '../../domain/entities/agent.entity';
import { AgentExecutionService } from '../../domain/services/agent-execution.service';

@Injectable()
export class CreateAgentUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
    private readonly agentExecutionService: AgentExecutionService,
  ) {}

  async execute(dto: CreateAgentDto): Promise<Agent> {
    const agentData: Partial<Agent> = {
      userId: dto.userId,
      name: dto.name,
      description: dto.description,
      modelId: dto.modelId,
      systemPrompt: dto.systemPrompt,
      temperature: dto.temperature ?? 0.7,
      maxTokens: dto.maxTokens ?? 2000,
      tools: dto.tools ?? [],
      metadata: dto.metadata ?? {},
    };

    this.agentExecutionService.validateAgent(agentData as Agent);

    const agent = await this.agentRepository.create(agentData);
    return agent;
  }
}
