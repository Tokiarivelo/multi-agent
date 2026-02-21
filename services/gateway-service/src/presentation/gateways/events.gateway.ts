import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { NatsClient } from '@multi-agent/nats-client';

@WebSocketGateway({
  path: '/ws',
  transports: ['websocket'],
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly natsClient: NatsClient) {}

  async afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    await this.waitForNatsConnection();
    this.subscribeToNatsEvents();
  }

  private async waitForNatsConnection() {
    let attempts = 0;
    while (!this.natsClient.isConnected && attempts < 20) {
      this.logger.log('Waiting for NATS connection...');
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    if (!this.natsClient.isConnected) {
      this.logger.error('NATS not connected after varying attempts. Subscription might fail.');
    } else {
      this.logger.log('NATS connected, proceeding to subscribe.');
    }
  }

  handleConnection(client: WebSocket) {
    this.logger.log('Client connected');
    client.send(JSON.stringify({ event: 'connected', data: 'Gateway Connected' }));
  }

  handleDisconnect() {
    this.logger.log('Client disconnected');
  }

  private subscribeToNatsEvents() {
    this.natsClient
      .subscribe('*', async (event: any) => {
        this.server.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              let messageStr: string;

              if (event && event.eventType) {
                // Standard DomainEvent
                const message = {
                  event: event.eventType,
                  data: event.data || event,
                };
                messageStr = JSON.stringify(message);
              } else {
                // Unknown structure, wrap it as general event
                const message = {
                  event: 'nats.message',
                  data: event,
                };
                messageStr = JSON.stringify(message);
              }

              client.send(messageStr);
            } catch (error) {
              this.logger.error('Error broadcasting event', error);
            }
          }
        });
      })
      .then(() => {
        this.logger.log('Subscribed to NATS wildcard events');
      })
      .catch((error) => {
        this.logger.error('Failed to subscribe to NATS events', error);
      });
  }
}
