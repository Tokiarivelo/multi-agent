import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class ArchiveCardTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_archive_card',
      description: 'Archive (close) a Trello card',
      inputSchema: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID to archive' },
        },
        required: ['cardId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.trello.archiveCard(args['cardId'] as string);
    return textResult(result);
  }
}
