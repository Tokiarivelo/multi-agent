import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatMessageUseCase } from '../../application/use-cases/chat-message.use-case';
import { SendChatMessageDto } from '../../application/dto/chat.dto';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** nodeId → resolve fn waiting for user's workflow answer */
  private readonly pendingChoices = new Map<string, (answer: string) => void>();

  /** requestId → resolve fn waiting for user's tool selection */
  private readonly pendingToolRequests = new Map<string, (ids: string[]) => void>();

  constructor(private readonly chatMessageUseCase: ChatMessageUseCase) {}

  handleConnection(client: Socket) {
    this.logger.log(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { sessionId: string; userId: string; dto: SendChatMessageDto },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Chat message in session ${data.sessionId} from user ${data.userId}`);

    try {
      await this.chatMessageUseCase.sendMessage(data.sessionId, data.userId, data.dto, {
        onToken: (token: string) => client.emit('token', { token }),
        onThinking: (step) => client.emit('thinking', step),
        onWorkflowChoice: (payload) => {
          client.emit('workflow_choice', payload);
          return new Promise<string>((resolve) => {
            const key = `${payload.nodeId}`;
            this.pendingChoices.set(key, resolve);
          });
        },
        onToolRequest: (payload) => {
          client.emit('tool_request', payload);
          return new Promise<string[]>((resolve) => {
            this.pendingToolRequests.set(payload.requestId, resolve);
          });
        },
        onComplete: (message) => client.emit('complete', message),
        onError: (error: Error) => client.emit('error', { message: error.message }),
      });
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('workflow_choice_response')
  handleWorkflowChoiceResponse(
    @MessageBody() data: { nodeId: string; answer: string },
  ) {
    const key = data.nodeId;
    const resolve = this.pendingChoices.get(key);
    if (resolve) {
      this.pendingChoices.delete(key);
      resolve(data.answer);
    }
  }

  @SubscribeMessage('tool_request_response')
  handleToolRequestResponse(
    @MessageBody() data: { requestId: string; selectedToolIds: string[] },
  ) {
    const resolve = this.pendingToolRequests.get(data.requestId);
    if (resolve) {
      this.pendingToolRequests.delete(data.requestId);
      resolve(data.selectedToolIds);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
