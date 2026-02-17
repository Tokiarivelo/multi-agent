import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StreamConfig,
  ConsumerConfig,
  StringCodec,
  JsMsg,
  AckPolicy,
  DeliverPolicy,
  JSONCodec,
} from 'nats';
import { Logger } from '@multi-agent/common';
import { BaseEvent, DomainEvent, DeadLetterEvent } from '@multi-agent/events';
import { NatsConfig } from './nats-config';
import { EventHandler, EventHandlerRegistry } from './event-handler';
import { IdempotencyService } from './idempotency';

export class NatsClient {
  private connection: NatsConnection | null = null;
  private jetStream: JetStreamClient | null = null;
  private jetStreamManager: JetStreamManager | null = null;
  private logger: Logger;
  private eventHandlers: EventHandlerRegistry;
  private idempotencyService: IdempotencyService;
  private readonly jsonCodec = JSONCodec();

  constructor(
    private readonly config: NatsConfig,
    private readonly serviceName: string,
  ) {
    this.logger = new Logger({ service: `${serviceName}-nats-client` });
    this.eventHandlers = new Map();
    this.idempotencyService = new IdempotencyService();
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to NATS...', { servers: this.config.servers });

      this.connection = await connect({
        servers: this.config.servers,
        name: this.serviceName,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        reconnectTimeWait: this.config.reconnectTimeWait,
      });

      this.jetStream = this.connection.jetstream();
      this.jetStreamManager = await this.connection.jetstreamManager();

      this.logger.info('Connected to NATS successfully');

      // Setup streams
      await this.setupStreams();

      // Handle connection events
      this.handleConnectionEvents();
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error as Error);
      throw error;
    }
  }

  private async setupStreams(): Promise<void> {
    if (!this.jetStreamManager) {
      throw new Error('JetStream manager not initialized');
    }

    try {
      // Create main event stream
      const mainStreamConfig: Partial<StreamConfig> = {
        name: 'EVENTS',
        subjects: [
          'workflow.*',
          'execution.*',
          'execution.node.*',
          'agent.*',
          'agent.execution.*',
          'tool.*',
          'tool.execution.*',
          'model.*',
          'model.inference.*',
          'model.token.*',
          'vector.*',
        ],
        retention: 'limits',
        max_age: 7 * 24 * 60 * 60 * 1e9, // 7 days in nanoseconds
        max_msgs: 1000000,
        storage: 'file',
        duplicate_window: 2 * 60 * 1e9, // 2 minutes in nanoseconds
      };

      await this.jetStreamManager.streams.add(mainStreamConfig);
      this.logger.info('Created EVENTS stream');

      // Create dead letter queue stream
      const dlqStreamConfig: Partial<StreamConfig> = {
        name: 'DLQ',
        subjects: ['dlq.*'],
        retention: 'limits',
        max_age: 30 * 24 * 60 * 60 * 1e9, // 30 days
        storage: 'file',
      };

      await this.jetStreamManager.streams.add(dlqStreamConfig);
      this.logger.info('Created DLQ stream');
    } catch (error: any) {
      // Stream might already exist, which is fine
      if (error.message?.includes('stream name already in use')) {
        this.logger.info('Streams already exist, skipping creation');
      } else {
        throw error;
      }
    }
  }

  private handleConnectionEvents(): void {
    if (!this.connection) return;

    (async () => {
      for await (const status of this.connection!.status()) {
        this.logger.info('NATS connection status', { status: status.type });

        if (status.type === 'disconnect') {
          this.logger.warn('Disconnected from NATS');
        } else if (status.type === 'reconnect') {
          this.logger.info('Reconnected to NATS');
        }
      }
    })();
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.jetStream) {
      throw new Error('JetStream not initialized');
    }

    try {
      const data = this.jsonCodec.encode(event);

      await this.jetStream.publish(event.eventType, data, {
        msgID: event.eventId,
      });

      this.logger.debug('Published event', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to publish event', error as Error, {
        eventType: event.eventType,
        eventId: event.eventId,
      });
      throw error;
    }
  }

  async publishStream(subject: string, token: string, isComplete: boolean): Promise<void> {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }

    try {
      const data = this.jsonCodec.encode({ token, isComplete });
      this.connection.publish(subject, data);
    } catch (error) {
      this.logger.error('Failed to publish stream token', error as Error);
      throw error;
    }
  }

  async subscribe(
    subject: string,
    handler: EventHandler<DomainEvent>,
    consumerName?: string,
  ): Promise<void> {
    if (!this.jetStream) {
      throw new Error('JetStream not initialized');
    }

    try {
      const durableName = consumerName || `${this.serviceName}-${subject.replace(/\*/g, 'all')}`;

      const consumerConfig: Partial<ConsumerConfig> = {
        durable_name: durableName,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        max_deliver: this.config.maxDeliverAttempts,
        ack_wait: 30 * 1e9, // 30 seconds in nanoseconds
      };

      const consumer = await this.jetStream.consumers.get('EVENTS', durableName);
      const messages = await consumer.consume();

      this.logger.info('Subscribed to subject', { subject, durableName });

      // Register handler
      this.eventHandlers.set(durableName, handler);

      // Process messages
      (async () => {
        for await (const msg of messages) {
          await this.handleMessage(msg, handler);
        }
      })();
    } catch (error) {
      this.logger.error('Failed to subscribe', error as Error, { subject });
      throw error;
    }
  }

  private async handleMessage(msg: JsMsg, handler: EventHandler<DomainEvent>): Promise<void> {
    try {
      const event = this.jsonCodec.decode(msg.data) as DomainEvent;

      this.logger.debug('Received event', {
        eventType: event.eventType,
        eventId: event.eventId,
      });

      // Check idempotency
      const isProcessed = await this.idempotencyService.isProcessed(event.eventId);
      if (isProcessed) {
        this.logger.info('Event already processed, skipping', { eventId: event.eventId });
        msg.ack();
        return;
      }

      // Process event
      await handler(event);

      // Mark as processed
      await this.idempotencyService.markProcessed(event.eventId);

      // Acknowledge message
      msg.ack();

      this.logger.debug('Event processed successfully', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to handle message', error as Error);

      // Check delivery count
      const deliveryCount = msg.info.redeliveryCount;

      if (deliveryCount >= this.config.maxDeliverAttempts - 1) {
        // Send to DLQ
        await this.sendToDeadLetterQueue(msg, error as Error);
        msg.ack(); // Acknowledge to prevent further redelivery
      } else {
        // Negative acknowledge for retry
        msg.nak();
      }
    }
  }

  private async sendToDeadLetterQueue(msg: JsMsg, error: Error): Promise<void> {
    try {
      const originalEvent = this.jsonCodec.decode(msg.data) as DomainEvent;

      const dlqEvent: DeadLetterEvent = {
        originalEvent,
        failureReason: error.message,
        failureCount: msg.info.redeliveryCount + 1,
        firstFailureAt: new Date(),
        lastFailureAt: new Date(),
      };

      const data = this.jsonCodec.encode(dlqEvent);

      await this.jetStream!.publish(`dlq.${originalEvent.eventType}`, data);

      this.logger.warn('Event sent to DLQ', {
        eventType: originalEvent.eventType,
        eventId: originalEvent.eventId,
        reason: error.message,
      });
    } catch (dlqError) {
      this.logger.error('Failed to send event to DLQ', dlqError as Error);
    }
  }

  async request<TRequest extends BaseEvent, TResponse extends BaseEvent>(
    subject: string,
    request: TRequest,
    timeout: number = 5000,
  ): Promise<TResponse> {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }

    try {
      const data = this.jsonCodec.encode(request);
      const response = await this.connection.request(subject, data, { timeout });
      return this.jsonCodec.decode(response.data) as TResponse;
    } catch (error) {
      this.logger.error('Request failed', error as Error, { subject });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.logger.info('NATS connection closed');
    }
  }

  get isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }
}
