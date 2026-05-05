import { Injectable } from '@nestjs/common';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/calendar-tool.interface';

@Injectable()
export class CreateEventTool implements McpToolHandler {
  constructor(private readonly calendar: CalendarApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'calendar_create_event',
      description: 'Create a new event in Google Calendar.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title/summary' },
          description: { type: 'string', description: 'Event description' },
          startDateTime: { type: 'string', description: 'Start date-time in ISO 8601 (UTC)' },
          endDateTime: { type: 'string', description: 'End date-time in ISO 8601 (UTC)' },
          attendees: { type: 'string', description: 'Comma-separated attendee emails' },
          location: { type: 'string', description: 'Physical or virtual location' },
          calendarId: { type: 'string', description: 'Calendar ID (default: primary)' },
          credentials: {
            type: 'string',
            description: 'Google credentials JSON (uses env if omitted)',
          },
        },
        required: ['title', 'startDateTime', 'endDateTime'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const attendeesRaw = args['attendees'] as string | undefined;
    const result = await this.calendar.createEvent({
      title: args['title'] as string,
      description: args['description'] as string | undefined,
      startDateTime: args['startDateTime'] as string,
      endDateTime: args['endDateTime'] as string,
      attendees: attendeesRaw ? attendeesRaw.split(',').map((e) => e.trim()) : undefined,
      location: args['location'] as string | undefined,
      calendarId: args['calendarId'] as string | undefined,
      credentials: args['credentials'] as string | undefined,
    });
    return textResult(result);
  }
}
