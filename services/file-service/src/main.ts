import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3008);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(port);
  logger.log(`🚀 File Service is running on: http://localhost:${port}`);
}

void bootstrap();
