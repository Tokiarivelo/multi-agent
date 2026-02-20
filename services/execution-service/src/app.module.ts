import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { NatsModule } from './infrastructure/messaging/nats.module';
import { ExecutionModule } from './infrastructure/execution/execution.module';
import { ExecutionController } from './presentation/controllers/execution.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [ConfigModule, ExecutionModule, NatsModule],
  controllers: [ExecutionController, HealthController],
})
export class AppModule {}
