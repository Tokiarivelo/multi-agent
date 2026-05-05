import { Injectable } from '@nestjs/common';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/calendar-tool.interface';

@Injectable()
export class UpdateEventTool implements McpToolHandler {
  constructor(private readonly calendar: CalendarApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'calendar_update_event',
      description: 'Update an existing Google Calendar event.',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Google Calendar event ID' },
          title: { type: 'string', description: 'New event title' },
          description: { type: 'string', description: 'New event description' },
          startDateTime: { type: 'string', description: 'New start date-time in ISO 8601' },
          endDateTime: { type: 'string', description: 'New end date-time in ISO 8601' },
          attendees: {
            type: 'string',
            description: 'Comma-separated attendee emails (replaces existing)',
          },
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
    const attendeesRaw = args['attendees'] as string | undefined;
    const result = await this.calendar.updateEvent({
      eventId: args['eventId'] as string,
      title: args['title'] as string | undefined,
      description: args['description'] as string | undefined,
      startDateTime: args['startDateTime'] as string | undefined,
      endDateTime: args['endDateTime'] as string | undefined,
      attendees: attendeesRaw ? attendeesRaw.split(',').map((e) => e.trim()) : undefined,
      calendarId: args['calendarId'] as string | undefined,
      credentials: args['credentials'] as string | undefined,
    });
    return textResult(result);
  }
}
