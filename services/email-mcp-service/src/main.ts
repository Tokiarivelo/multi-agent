import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Email MCP Service')
    .setDescription(
      'REST interface for all email MCP tools. ' +
        'Use the endpoints below to test Gmail IMAP and SMTP operations directly.\n\n' +
        '**Credentials:** If `imapUser`/`imapPass` (or `smtpUser`/`smtpPass`) are omitted, ' +
        'the service falls back to `IMAP_USER`/`IMAP_PASS` (or `SMTP_*`) environment variables.',
    )
    .setVersion('1.0')
    .addTag('Gmail — IMAP', 'Fetch, search, and manipulate Gmail messages via IMAP')
    .addTag('Email — SMTP', 'Send emails and verify SMTP connectivity')
    .addTag('MCP — JSON-RPC', 'Raw JSON-RPC 2.0 endpoint used by AI agents')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: 2, docExpansion: 'list' },
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3012);

  app.use((req: { method: string; url: string }, _res: unknown, next: () => void) => {
    logger.log(`${req.method} ${req.url}`);
    next();
  });

  await app.listen(port);
  logger.log(`Email MCP server listening on port ${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
