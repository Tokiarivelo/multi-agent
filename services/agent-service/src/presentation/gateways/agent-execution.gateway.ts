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
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { ExecuteAgentDto } from '../../application/dto/execute-agent.dto';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/agent-execution',
})
export class AgentExecutionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentExecutionGateway.name);

  constructor(private readonly executeAgentUseCase: ExecuteAgentUseCase) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('execute')
  async handleExecute(
    @MessageBody() data: { agentId: string; dto: ExecuteAgentDto },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Executing agent ${data.agentId} for client ${client.id}`);

    try {
      await this.executeAgentUseCase.executeStream(data.agentId, data.dto, {
        onToken: (token: string) => {
          client.emit('token', { token });
        },
        onComplete: (result) => {
          client.emit('complete', result);
        },
        onError: (error: Error) => {
          client.emit('error', { message: error.message });
        },
      });
    } catch (error) {
      this.logger.error(`Execution error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() });
  }
}
