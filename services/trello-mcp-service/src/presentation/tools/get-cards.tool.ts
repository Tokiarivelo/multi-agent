import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class GetCardsTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_get_cards',
      description: 'Get all open cards in a Trello list',
      inputSchema: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'Trello list ID' },
        },
        required: ['listId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const cards = await this.trello.getCards(args['listId'] as string);
    return textResult(cards);
  }
}
