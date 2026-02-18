import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './presentation/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('AGENT_PORT', 3002);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  await app.listen(port);

  logger.log(`🚀 Agent Service is running on: http://localhost:${port}`);
  logger.log(`📊 Health check available at: http://localhost:${port}/api/health`);
  logger.log(`🔌 WebSocket available at: ws://localhost:${port}/agent-execution`);
}

bootstrap();
