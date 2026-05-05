import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { EmailApiService } from '@infrastructure/email/email-api.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import { SendEmailTool, SendEmailTemplateTool, VerifySmtpTool } from '@presentation/tools';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
  ],
  controllers: [McpController],
  providers: [EmailApiService, SendEmailTool, SendEmailTemplateTool, VerifySmtpTool],
})
export class AppModule {}
