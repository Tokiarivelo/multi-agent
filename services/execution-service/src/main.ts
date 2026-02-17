import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './presentation/filters/http-exception.filter';
import { Logger } from '@multi-agent/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  app.enableCors();

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Execution Service API')
    .setDescription('Execution tracking and logging service')
    .setVersion('1.0')
    .addTag('executions')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = process.env.PORT || 3003;
  await app.listen(port);

  logger.info(`🚀 Execution Service is running on: http://localhost:${port}/api`);
  logger.info(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
