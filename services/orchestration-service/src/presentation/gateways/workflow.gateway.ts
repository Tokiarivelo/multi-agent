import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WorkflowExecution } from '../../domain/entities/workflow-execution.entity';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/workflows',
})
export class WorkflowGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WorkflowGateway.name);
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    for (const [executionId, clients] of this.subscriptions.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.subscriptions.delete(executionId);
      }
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() data: { executionId: string }, @ConnectedSocket() client: Socket) {
    const { executionId } = data;

    if (!this.subscriptions.has(executionId)) {
      this.subscriptions.set(executionId, new Set());
    }

    this.subscriptions.get(executionId)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to execution ${executionId}`);

    client.emit('subscribed', { executionId });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { executionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { executionId } = data;

    if (this.subscriptions.has(executionId)) {
      this.subscriptions.get(executionId)!.delete(client.id);
    }

    this.logger.log(`Client ${client.id} unsubscribed from execution ${executionId}`);

    client.emit('unsubscribed', { executionId });
  }

  sendExecutionUpdate(execution: WorkflowExecution) {
    const room = `execution:${execution.id}`;
    const currentNodeName = execution.currentNodeId
      ? execution.nodeExecutions?.find((n) => n.nodeId === execution.currentNodeId)?.nodeName
      : undefined;

    this.server.to(room).emit('execution:update', {
      executionId: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      currentNodeId: execution.currentNodeId,
      currentNodeName,
      nodeExecutions: execution.nodeExecutions,
      output: execution.output,
      error: execution.error,
      timestamp: new Date().toISOString(),
    });

    if (this.subscriptions.has(execution.id)) {
      const clients = this.subscriptions.get(execution.id)!;
      this.logger.log(`Sent update for execution ${execution.id} to ${clients.size} subscribers`);
    }
  }

  sendNodeUpdate(
    executionId: string,
    nodeId: string,
    nodeName: string,
    status: string,
    data?: any,
  ) {
    const room = `execution:${executionId}`;

    this.server.to(room).emit('node:update', {
      executionId,
      nodeId,
      nodeName,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  sendError(executionId: string, error: string) {
    const room = `execution:${executionId}`;

    this.server.to(room).emit('execution:error', {
      executionId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('join')
  async handleJoinRoom(
    @MessageBody() data: { executionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `execution:${data.executionId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    client.emit('joined', { executionId: data.executionId });

    try {
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { id: data.executionId },
      });

      if (execution) {
        const currentNodeName = execution.currentNodeId
          ? (execution.nodeExecutions as any[])?.find((n) => n.nodeId === execution.currentNodeId)
              ?.nodeName
          : undefined;

        client.emit('execution:update', {
          executionId: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          currentNodeId: execution.currentNodeId,
          currentNodeName,
          nodeExecutions: execution.nodeExecutions,
          output: execution.output,
          error: execution.error,
          timestamp: new Date().toISOString(),
        });

        if (Array.isArray(execution.nodeExecutions)) {
          for (const nodeExecution of execution.nodeExecutions as any[]) {
            client.emit('node:update', {
              executionId: execution.id,
              nodeId: nodeExecution.nodeId,
              nodeName: nodeExecution.nodeName,
              status: nodeExecution.status,
              data: nodeExecution.output || nodeExecution.input,
              timestamp: nodeExecution.updatedAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to fetch latest execution state for ${data.executionId}`, err);
    }
  }

  @SubscribeMessage('leave')
  handleLeaveRoom(@MessageBody() data: { executionId: string }, @ConnectedSocket() client: Socket) {
    const room = `execution:${data.executionId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    client.emit('left', { executionId: data.executionId });
  }
}
