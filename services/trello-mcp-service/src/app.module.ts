import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import { McpController } from '@presentation/controllers/mcp.controller';
import {
  GetBoardsTool,
  GetListsTool,
  GetCardsTool,
  CreateCardTool,
  MoveCardTool,
  UpdateCardTool,
  ArchiveCardTool,
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
    TrelloApiService,
    GetBoardsTool,
    GetListsTool,
    GetCardsTool,
    CreateCardTool,
    MoveCardTool,
    UpdateCardTool,
    ArchiveCardTool,
  ],
})
export class AppModule {}
