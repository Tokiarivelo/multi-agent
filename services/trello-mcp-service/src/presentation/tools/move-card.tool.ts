import { Injectable } from '@nestjs/common';
import { TrelloApiService } from '@infrastructure/trello/trello-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/trello-tool.interface';

@Injectable()
export class MoveCardTool implements McpToolHandler {
  constructor(private readonly trello: TrelloApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'trello_move_card',
      description:
        'Move a Trello card to a different list. Provide either cardId or cardName+boardId.',
      inputSchema: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'Target list ID to move the card to' },
          cardId: { type: 'string', description: 'Card ID to move (preferred)' },
          cardName: { type: 'string', description: 'Card name to search for (requires boardId)' },
          boardId: { type: 'string', description: 'Board ID to search within when using cardName' },
        },
        required: ['listId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    let cardId = args['cardId'] as string | undefined;

    if (!cardId) {
      const cardName = args['cardName'] as string | undefined;
      const boardId = args['boardId'] as string | undefined;

      if (!cardName) throw new Error('Either cardId or cardName must be provided');
      if (!boardId) throw new Error('boardId is required when using cardName');

      const found = await this.trello.findCardByName(boardId, cardName);
      if (!found) throw new Error(`Card not found with name: "${cardName}"`);
      cardId = found.id;
    }

    const result = await this.trello.moveCard(cardId, args['listId'] as string);
    return textResult(result);
  }
}
