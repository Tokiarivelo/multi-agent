import { Injectable } from '@nestjs/common';
import { CalendarApiService } from '@infrastructure/calendar/calendar-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/calendar-tool.interface';

@Injectable()
export class FindFreeSlotsTool implements McpToolHandler {
  constructor(private readonly calendar: CalendarApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'calendar_find_free_slots',
      description:
        'Find N available time slots of a given duration in a calendar, scanning working hours (09:00–18:00 UTC).',
      inputSchema: {
        type: 'object',
        properties: {
          duration: { type: 'string', description: 'Slot duration in minutes (e.g. 60)' },
          count: { type: 'string', description: 'Number of slots to return (default: 3)' },
          fromDate: {
            type: 'string',
            description: 'Search from this ISO 8601 date (default: now)',
          },
          toDate: {
            type: 'string',
            description: 'Search until this ISO 8601 date (default: +14 days)',
          },
          calendarId: { type: 'string', description: 'Calendar ID (default: primary)' },
          credentials: {
            type: 'string',
            description: 'Google credentials JSON (uses env if omitted)',
          },
        },
        required: ['duration'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const slots = await this.calendar.findFreeSlots({
      durationMinutes: Number(args['duration']),
      count: args['count'] ? Number(args['count']) : 3,
      fromDate: args['fromDate'] as string | undefined,
      toDate: args['toDate'] as string | undefined,
      calendarId: args['calendarId'] as string | undefined,
      credentials: args['credentials'] as string | undefined,
    });
    return textResult({ slots, count: slots.length });
  }
}
