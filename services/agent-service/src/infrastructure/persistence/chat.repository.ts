import { Injectable } from '@nestjs/common';
import { ChatMessage, ChatSession } from '../../domain/entities/chat.entity';
import { IChatRepository } from '../../domain/repositories/chat.repository.interface';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ChatRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: Partial<ChatSession>): Promise<ChatSession> {
    const session = await this.prisma.chatSession.create({
      data: {
        userId: data.userId!,
        title: data.title ?? 'New Chat',
        modelId: data.modelId,
        agentId: data.agentId,
        workflowId: data.workflowId,
        tools: (data.tools ?? []) as any,
        systemPrompt: data.systemPrompt,
        memoryContext: data.memoryContext as any,
      },
    });
    return this.mapSession(session);
  }

  async findSessionById(id: string, userId: string): Promise<ChatSession | null> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId },
    });
    return session ? this.mapSession(session) : null;
  }

  async findSessionsByUserId(userId: string): Promise<ChatSession[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((s) => this.mapSession(s));
  }

  async updateSession(id: string, data: Partial<ChatSession>): Promise<ChatSession> {
    const session = await this.prisma.chatSession.update({
      where: { id },
      data: {
        title: data.title,
        modelId: data.modelId,
        agentId: data.agentId,
        workflowId: data.workflowId,
        tools: data.tools as any,
        systemPrompt: data.systemPrompt,
        memoryContext: data.memoryContext as any,
      },
    });
    return this.mapSession(session);
  }

  async deleteSession(id: string, userId: string): Promise<void> {
    await this.prisma.chatSession.deleteMany({ where: { id, userId } });
  }

  async addMessage(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.create({
      data: {
        sessionId: data.sessionId!,
        role: data.role!,
        content: data.content!,
        attachments: (data.attachments ?? null) as any,
        metadata: (data.metadata ?? null) as any,
        toolCalls: (data.toolCalls ?? null) as any,
        thinkingSteps: (data.thinkingSteps ?? null) as any,
        tokens: data.tokens,
      },
    });
    // Touch the session updatedAt so it floats to top
    await this.prisma.chatSession.update({
      where: { id: data.sessionId! },
      data: { updatedAt: new Date() },
    });
    return this.mapMessage(message);
  }

  async findMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => this.mapMessage(m));
  }

  async updateMessage(id: string, data: Partial<ChatMessage>): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.update({
      where: { id },
      data: {
        content: data.content,
        toolCalls: data.toolCalls as any,
        thinkingSteps: data.thinkingSteps as any,
        tokens: data.tokens,
        metadata: data.metadata as any,
      },
    });
    return this.mapMessage(message);
  }

  private mapSession(s: any): ChatSession {
    return {
      id: s.id,
      userId: s.userId,
      title: s.title,
      modelId: s.modelId ?? undefined,
      agentId: s.agentId ?? undefined,
      workflowId: s.workflowId ?? undefined,
      tools: Array.isArray(s.tools) ? s.tools : [],
      systemPrompt: s.systemPrompt ?? undefined,
      memoryContext: s.memoryContext ?? undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private mapMessage(m: any): ChatMessage {
    return {
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as ChatMessage['role'],
      content: m.content,
      attachments: m.attachments ?? undefined,
      metadata: m.metadata ?? undefined,
      toolCalls: m.toolCalls ?? undefined,
      thinkingSteps: m.thinkingSteps ?? undefined,
      tokens: m.tokens ?? undefined,
      createdAt: m.createdAt,
    };
  }
}
