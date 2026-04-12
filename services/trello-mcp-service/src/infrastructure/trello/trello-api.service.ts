import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class TrelloApiService {
  private readonly logger = new Logger(TrelloApiService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('trello.apiKey', '');
    this.token = this.config.get<string>('trello.token', '');

    this.client = axios.create({
      baseURL: 'https://api.trello.com/1',
      timeout: 10000,
    });
  }

  private authParams(): Record<string, string> {
    return { key: this.apiKey, token: this.token };
  }

  async getBoards(): Promise<unknown[]> {
    const response = await this.client.get('/members/me/boards', {
      params: { ...this.authParams(), fields: 'id,name,url,closed' },
    });
    return response.data as unknown[];
  }

  async getLists(boardId: string): Promise<unknown[]> {
    const response = await this.client.get(`/boards/${boardId}/lists`, {
      params: { ...this.authParams(), filter: 'open' },
    });
    return response.data as unknown[];
  }

  async getCards(listId: string): Promise<unknown[]> {
    const response = await this.client.get(`/lists/${listId}/cards`, {
      params: { ...this.authParams(), fields: 'id,name,desc,idList,due,url,closed' },
    });
    return response.data as unknown[];
  }

  async createCard(params: {
    listId: string;
    name: string;
    description?: string;
    due?: string;
  }): Promise<unknown> {
    const response = await this.client.post('/cards', null, {
      params: {
        ...this.authParams(),
        idList: params.listId,
        name: params.name,
        ...(params.description ? { desc: params.description } : {}),
        ...(params.due ? { due: params.due } : {}),
      },
    });
    return response.data;
  }

  async moveCard(cardId: string, listId: string): Promise<unknown> {
    const response = await this.client.put(`/cards/${cardId}`, null, {
      params: { ...this.authParams(), idList: listId },
    });
    return response.data;
  }

  async updateCard(
    cardId: string,
    updates: { name?: string; description?: string; due?: string | null },
  ): Promise<unknown> {
    const params: Record<string, unknown> = { ...this.authParams() };
    if (updates.name !== undefined) params['name'] = updates.name;
    if (updates.description !== undefined) params['desc'] = updates.description;
    if (updates.due !== undefined) params['due'] = updates.due;

    const response = await this.client.put(`/cards/${cardId}`, null, { params });
    return response.data;
  }

  async archiveCard(cardId: string): Promise<unknown> {
    const response = await this.client.put(`/cards/${cardId}`, null, {
      params: { ...this.authParams(), closed: true },
    });
    return response.data;
  }

  async findCardByName(
    boardId: string,
    cardName: string,
  ): Promise<{ id: string; name: string } | null> {
    const listsResponse = await this.client.get(`/boards/${boardId}/lists`, {
      params: { ...this.authParams(), cards: 'open', fields: 'id,name' },
    });

    const needle = cardName.toLowerCase();

    for (const list of listsResponse.data as Array<{ id: string }>) {
      const cardsResponse = await this.client.get(`/lists/${list.id}/cards`, {
        params: { ...this.authParams(), fields: 'id,name' },
      });

      const cards = cardsResponse.data as Array<{ id: string; name: string }>;
      const exact = cards.find((c) => c.name.toLowerCase() === needle);
      if (exact) return exact;

      const partial = cards.find((c) => c.name.toLowerCase().includes(needle));
      if (partial) return partial;
    }

    return null;
  }
}
