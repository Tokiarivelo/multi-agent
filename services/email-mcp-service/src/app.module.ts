import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import { GmailFetchService } from '@infrastructure/email/gmail-fetch.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import {
  GmailToolsController,
  SmtpToolsController,
} from '@presentation/controllers/tools.controller';
import {
  SendEmailTool,
  SendEmailTemplateTool,
  VerifySmtpTool,
  FetchEmailsTool,
  ManipulateEmailsTool,
  ListAttachmentsTool,
  DownloadAttachmentTool,
} from '@presentation/tools';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    HttpModule,
  ],
  controllers: [McpController, GmailToolsController, SmtpToolsController],
  providers: [
    EmailApiService,
    GmailFetchService,
    SendEmailTool,
    SendEmailTemplateTool,
    VerifySmtpTool,
    FetchEmailsTool,
    ManipulateEmailsTool,
    ListAttachmentsTool,
    DownloadAttachmentTool,
  ],
})
export class AppModule {}
