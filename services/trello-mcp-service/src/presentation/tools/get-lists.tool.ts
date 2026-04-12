import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class GetListsTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_get_lists',
      description: 'Get all open lists on a Trello board',
      inputSchema: {
        type: 'object',
        properties: {
          boardId: { type: 'string', description: 'Trello board ID' },
        },
        required: ['boardId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const lists = await this.trello.getLists(args['boardId'] as string);
    return textResult(lists);
  }
}
