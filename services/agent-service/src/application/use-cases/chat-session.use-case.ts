import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ChatSession } from '../../domain/entities/chat.entity';
import {
  CHAT_REPOSITORY,
  IChatRepository,
} from '../../domain/repositories/chat.repository.interface';
import { CreateChatSessionDto, UpdateChatSessionDto } from '../dto/chat.dto';

@Injectable()
export class ChatSessionUseCase {
  constructor(
    @Inject(CHAT_REPOSITORY)
    private readonly chatRepository: IChatRepository,
  ) {}

  async listSessions(userId: string): Promise<ChatSession[]> {
    return this.chatRepository.findSessionsByUserId(userId);
  }

  async createSession(userId: string, dto: CreateChatSessionDto): Promise<ChatSession> {
    return this.chatRepository.createSession({
      userId,
      title: dto.title ?? 'New Chat',
      modelId: dto.modelId,
      agentId: dto.agentId,
      workflowId: dto.workflowId,
      tools: dto.tools ?? [],
      systemPrompt: dto.systemPrompt,
    });
  }

  async getSession(id: string, userId: string): Promise<ChatSession> {
    const session = await this.chatRepository.findSessionById(id, userId);
    if (!session) throw new NotFoundException(`Chat session ${id} not found`);
    return session;
  }

  async updateSession(
    id: string,
    userId: string,
    dto: UpdateChatSessionDto,
  ): Promise<ChatSession> {
    await this.getSession(id, userId);
    return this.chatRepository.updateSession(id, dto);
  }

  async deleteSession(id: string, userId: string): Promise<void> {
    await this.getSession(id, userId);
    await this.chatRepository.deleteSession(id, userId);
  }
}
