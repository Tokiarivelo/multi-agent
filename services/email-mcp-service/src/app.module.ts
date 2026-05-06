import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import { GmailFetchService } from '@infrastructure/email/gmail-fetch.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import {
  SendEmailTool,
  SendEmailTemplateTool,
  VerifySmtpTool,
  FetchEmailsTool,
  ManipulateEmailsTool,
} from '@presentation/tools';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
  ],
  controllers: [McpController],
  providers: [
    EmailApiService,
    GmailFetchService,
    SendEmailTool,
    SendEmailTemplateTool,
    VerifySmtpTool,
    FetchEmailsTool,
    ManipulateEmailsTool,
  ],
})
export class AppModule {}
