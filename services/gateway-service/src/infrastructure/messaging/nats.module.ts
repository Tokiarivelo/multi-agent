import { Module, Global, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsClient } from '@multi-agent/nats-client';

@Global()
@Module({
  providers: [
    {
      provide: NatsClient,
      useFactory: (configService: ConfigService) => {
        const natsUrl = configService.get<string>('NATS_URL', 'nats://localhost:4222');
        return new NatsClient(
          {
            servers: [natsUrl],
            maxReconnectAttempts: -1,
            reconnectTimeWait: 1000,
            maxDeliverAttempts: 3,
          },
          'gateway-service',
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [NatsClient],
})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsModule.name);

  constructor(private readonly natsClient: NatsClient) {}

  async onModuleInit() {
    try {
      await this.natsClient.connect();
      this.logger.log('Connected to NATS');
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.natsClient.close();
      this.logger.log('Disconnected from NATS');
    } catch (error) {
      this.logger.error('Error disconnecting from NATS', error);
    }
  }
}
