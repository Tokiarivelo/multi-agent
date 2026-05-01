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
        onComplete: (message) => client.emit('complete', message),
        onError: (error: Error) => client.emit('error', { message: error.message }),
      });
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
