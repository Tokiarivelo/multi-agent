import { Injectable } from '@nestjs/common';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/calendar-tool.interface';

@Injectable()
export class DeleteEventTool implements McpToolHandler {
  constructor(private readonly calendar: CalendarApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'calendar_delete_event',
      description: 'Delete an event from Google Calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Google Calendar event ID to delete' },
          calendarId: { type: 'string', description: 'Calendar ID (default: primary)' },
          credentials: {
            type: 'string',
            description: 'Google credentials JSON (uses env if omitted)',
          },
        },
        required: ['eventId'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.calendar.deleteEvent({
      eventId: args['eventId'] as string,
      calendarId: args['calendarId'] as string | undefined,
      credentials: args['credentials'] as string | undefined,
    });
    return textResult(result);
  }
}
