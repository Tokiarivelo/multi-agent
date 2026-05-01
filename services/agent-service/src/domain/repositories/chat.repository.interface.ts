import { ChatMessage, ChatSession } from '../entities/chat.entity';

export const CHAT_REPOSITORY = Symbol('CHAT_REPOSITORY');

export interface IChatRepository {
  createSession(data: Partial<ChatSession>): Promise<ChatSession>;
  findSessionById(id: string, userId: string): Promise<ChatSession | null>;
  findSessionsByUserId(userId: string): Promise<ChatSession[]>;
  updateSession(id: string, data: Partial<ChatSession>): Promise<ChatSession>;
  deleteSession(id: string, userId: string): Promise<void>;

  addMessage(data: Partial<ChatMessage>): Promise<ChatMessage>;
  findMessagesBySessionId(sessionId: string): Promise<ChatMessage[]>;
  updateMessage(id: string, data: Partial<ChatMessage>): Promise<ChatMessage>;
}
