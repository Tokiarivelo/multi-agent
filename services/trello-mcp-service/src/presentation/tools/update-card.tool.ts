import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class UpdateCardTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_update_card',
      description: 'Update an existing Trello card (name, description, or due date)',
      inputSchema: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID to update' },
          name: { type: 'string', description: 'New card name' },
          description: { type: 'string', description: 'New card description' },
          due: {
            type: 'string',
            description: 'New due date in ISO 8601 format, or empty string to clear',
          },
        },
        required: ['cardId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const name = args['name'] as string | undefined;
    const description = args['description'] as string | undefined;
    const dueRaw = args['due'] as string | undefined;
    const result = await this.trello.updateCard(args['cardId'] as string, {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(dueRaw !== undefined ? { due: dueRaw === '' ? null : dueRaw } : {}),
    });
    return textResult(result);
  }
}
