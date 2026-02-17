import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsClient } from '@multi-agent/nats-client';
import { Logger } from '@multi-agent/common';
import { IEventPublisher } from '../../application/interfaces/event-publisher.interface';
import { ExecutionStartedHandler } from './event-handlers/execution-started.handler';
import { ExecutionNodeStartedHandler } from './event-handlers/execution-node-started.handler';
import { ExecutionNodeCompletedHandler } from './event-handlers/execution-node-completed.handler';
import { ExecutionNodeFailedHandler } from './event-handlers/execution-node-failed.handler';

export class NatsEventPublisher implements IEventPublisher {
  constructor(private readonly natsClient: NatsClient) {}

  async publish<T = any>(subject: string, data: T): Promise<void> {
    // Create a proper event structure
    const event = {
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: subject,
      timestamp: new Date(),
      version: '1.0',
      data,
    };
    await this.natsClient.publish(event as any);
  }
}

@Module({
  providers: [
    {
      provide: NatsClient,
      useFactory: (configService: ConfigService) => {
        return new NatsClient(
          {
            servers: [configService.get<string>('NATS_URL', 'nats://localhost:4222')],
            maxReconnectAttempts: -1,
            reconnectTimeWait: 1000,
            maxDeliverAttempts: 3,
          },
          'execution-service',
        );
      },
      inject: [ConfigService],
    },
    {
      provide: IEventPublisher,
      useFactory: (natsClient: NatsClient) => {
        return new NatsEventPublisher(natsClient);
      },
      inject: [NatsClient],
    },
    ExecutionStartedHandler,
    ExecutionNodeStartedHandler,
    ExecutionNodeCompletedHandler,
    ExecutionNodeFailedHandler,
  ],
  exports: [NatsClient, IEventPublisher],
})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsModule.name);

  constructor(
    private readonly natsClient: NatsClient,
    private readonly executionStartedHandler: ExecutionStartedHandler,
    private readonly executionNodeStartedHandler: ExecutionNodeStartedHandler,
    private readonly executionNodeCompletedHandler: ExecutionNodeCompletedHandler,
    private readonly executionNodeFailedHandler: ExecutionNodeFailedHandler,
  ) {}

  async onModuleInit() {
    try {
      await this.natsClient.connect();
      this.logger.info('Connected to NATS');

      // Subscribe to execution events
      await this.subscribeToEvents();
      this.logger.info('Subscribed to execution events');
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.natsClient.close();
      this.logger.info('Disconnected from NATS');
    } catch (error) {
      this.logger.error('Error disconnecting from NATS', error);
    }
  }

  private async subscribeToEvents() {
    // Create consumers for each event type
    const eventSubscriptions = [
      { subject: 'execution.started', handler: this.executionStartedHandler.handle.bind(this.executionStartedHandler) },
      { subject: 'execution.node.started', handler: this.executionNodeStartedHandler.handle.bind(this.executionNodeStartedHandler) },
      { subject: 'execution.node.completed', handler: this.executionNodeCompletedHandler.handle.bind(this.executionNodeCompletedHandler) },
      { subject: 'execution.node.failed', handler: this.executionNodeFailedHandler.handle.bind(this.executionNodeFailedHandler) },
      { 
        subject: 'execution.completed', 
        handler: async (event: any) => {
          this.logger.info(`Execution completed: ${event.data?.executionId || event.executionId}`);
          await this.executionStartedHandler.handleCompleted(event);
        }
      },
      { 
        subject: 'execution.failed', 
        handler: async (event: any) => {
          this.logger.info(`Execution failed: ${event.data?.executionId || event.executionId}`);
          await this.executionStartedHandler.handleFailed(event);
        }
      },
    ];

    // Subscribe to all events
    for (const { subject, handler } of eventSubscriptions) {
      await this.natsClient.subscribe(subject, handler);
      this.logger.info(`Subscribed to ${subject}`);
    }
  }
}
