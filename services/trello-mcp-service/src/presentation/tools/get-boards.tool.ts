import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class GetBoardsTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_get_boards',
      description: 'List all Trello boards for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  async execute(_args: Record<string, unknown>): Promise<McpToolResult> {
    const boards = await this.trello.getBoards();
    return textResult(boards);
  }
}
