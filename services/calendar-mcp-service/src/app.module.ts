import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import {
  CreateEventTool,
  ListEventsTool,
  FindFreeSlotsTool,
  UpdateEventTool,
  DeleteEventTool,
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
    CalendarApiService,
    CreateEventTool,
    ListEventsTool,
    FindFreeSlotsTool,
    UpdateEventTool,
    DeleteEventTool,
  ],
})
export class AppModule {}
