import { Injectable } from '@nestjs/common';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/calendar-tool.interface';

@Injectable()
export class ListEventsTool implements McpToolHandler {
  constructor(private readonly calendar: CalendarApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'calendar_list_events',
      description: 'List upcoming events from Google Calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          timeMin: { type: 'string', description: 'Start of range in ISO 8601 (default: now)' },
          timeMax: { type: 'string', description: 'End of range in ISO 8601' },
          maxResults: {
            type: 'string',
            description: 'Maximum number of events to return (default: 20)',
          },
          calendarId: { type: 'string', description: 'Calendar ID (default: primary)' },
          credentials: {
            type: 'string',
            description: 'Google credentials JSON (uses env if omitted)',
          },
        },
        required: [],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const events = await this.calendar.listEvents({
      timeMin: args['timeMin'] as string | undefined,
      timeMax: args['timeMax'] as string | undefined,
      maxResults: args['maxResults'] ? Number(args['maxResults']) : undefined,
      calendarId: args['calendarId'] as string | undefined,
      credentials: args['credentials'] as string | undefined,
    });
    return textResult({ events, count: events.length });
  }
}
