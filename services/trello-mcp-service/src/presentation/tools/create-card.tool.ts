import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class CreateCardTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_create_card',
      description: 'Create a new card in a Trello list',
      inputSchema: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'Trello list ID to add the card to' },
          name: { type: 'string', description: 'Card name/title' },
          description: { type: 'string', description: 'Card description (markdown supported)' },
          due: {
            type: 'string',
            description: 'Due date in ISO 8601 format (e.g. 2024-12-31T23:59:00Z)',
          },
        },
        required: ['listId', 'name'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const description = args['description'] as string | undefined;
    const due = args['due'] as string | undefined;
    const card = await this.trello.createCard({
      listId: args['listId'] as string,
      name: args['name'] as string,
      ...(description !== undefined ? { description } : {}),
      ...(due !== undefined ? { due } : {}),
    });
    return textResult(card);
  }
}
