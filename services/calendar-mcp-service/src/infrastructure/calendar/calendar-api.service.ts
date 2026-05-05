import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  location?: string;
}

export interface FreeSlot {
  start: string;
  end: string;
}

@Injectable()
export class CalendarApiService {
  private readonly logger = new Logger(CalendarApiService.name);
  private readonly defaultCalendarId: string;
  private readonly defaultAuth: OAuth2Client | null;

  constructor(private readonly config: ConfigService) {
    this.defaultCalendarId = this.config.get<string>('google.calendarId', 'primary');
    this.defaultAuth = this.buildDefaultAuth();
  }

  private buildDefaultAuth(credentialsJson?: string): OAuth2Client | null {
    const raw = credentialsJson ?? this.config.get<string>('google.credentials', '');
    const clientId = this.config.get<string>('google.oauthClientId', '');
    const clientSecret = this.config.get<string>('google.oauthClientSecret', '');
    const refreshToken = this.config.get<string>('google.oauthRefreshToken', '');

    if (clientId && clientSecret && refreshToken) {
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      return auth;
    }

    if (raw) {
      try {
        const creds = JSON.parse(raw) as Record<string, unknown>;
        const auth = google.auth.fromJSON(creds) as OAuth2Client;
        return auth;
      } catch (err) {
        this.logger.warn(
          `Failed to parse GOOGLE_CALENDAR_CREDENTIALS: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return null;
  }

  private resolveAuth(credentialsArg?: string): OAuth2Client {
    if (credentialsArg) {
      const auth = this.buildDefaultAuth(credentialsArg);
      if (auth) return auth;
    }
    if (this.defaultAuth) return this.defaultAuth;
    throw new Error(
      'No Google credentials configured. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN, or GOOGLE_CALENDAR_CREDENTIALS (service account JSON).',
    );
  }

  private calendarClient(credentialsArg?: string): calendar_v3.Calendar {
    return google.calendar({ version: 'v3', auth: this.resolveAuth(credentialsArg) });
  }

  async createEvent(
    params: CalendarEvent & { credentials?: string; calendarId?: string },
  ): Promise<unknown> {
    const cal = this.calendarClient(params.credentials);
    const calendarId = params.calendarId ?? this.defaultCalendarId;

    this.logger.log(`Creating event "${params.title}" on calendar ${calendarId}`);

    const response = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startDateTime, timeZone: 'UTC' },
        end: { dateTime: params.endDateTime, timeZone: 'UTC' },
        attendees: params.attendees?.map((email) => ({ email })),
      },
    });

    return response.data;
  }

  async listEvents(params: {
    credentials?: string;
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }): Promise<unknown[]> {
    const cal = this.calendarClient(params.credentials);
    const calendarId = params.calendarId ?? this.defaultCalendarId;

    const response = await cal.events.list({
      calendarId,
      timeMin: params.timeMin ?? new Date().toISOString(),
      timeMax: params.timeMax,
      maxResults: params.maxResults ?? 20,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items ?? [];
  }

  async findFreeSlots(params: {
    credentials?: string;
    calendarId?: string;
    durationMinutes: number;
    count: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<FreeSlot[]> {
    const cal = this.calendarClient(params.credentials);
    const calendarId = params.calendarId ?? this.defaultCalendarId;

    const timeMin = params.fromDate ?? new Date().toISOString();
    const toDate = new Date(timeMin);
    toDate.setDate(toDate.getDate() + 14);
    const timeMax = params.toDate ?? toDate.toISOString();

    const freeBusy = await cal.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      },
    });

    const busy = (freeBusy.data.calendars?.[calendarId]?.busy ?? []) as Array<{
      start: string;
      end: string;
    }>;

    const durationMs = params.durationMinutes * 60 * 1000;
    const slots: FreeSlot[] = [];
    const cursor = new Date(timeMin);
    const end = new Date(timeMax);

    while (cursor < end && slots.length < params.count) {
      const hour = cursor.getUTCHours();
      if (hour < 9 || hour >= 18) {
        cursor.setUTCHours(hour < 9 ? 9 : 9);
        if (hour >= 18) cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      const slotEnd = new Date(cursor.getTime() + durationMs);
      const overlaps = busy.some((b) => {
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return cursor < be && slotEnd > bs;
      });

      if (!overlaps) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
        cursor.setTime(slotEnd.getTime());
      } else {
        cursor.setTime(cursor.getTime() + 30 * 60 * 1000);
      }
    }

    return slots;
  }

  async updateEvent(params: {
    credentials?: string;
    calendarId?: string;
    eventId: string;
    title?: string;
    description?: string;
    startDateTime?: string;
    endDateTime?: string;
    attendees?: string[];
  }): Promise<unknown> {
    const cal = this.calendarClient(params.credentials);
    const calendarId = params.calendarId ?? this.defaultCalendarId;

    const existing = await cal.events.get({ calendarId, eventId: params.eventId });
    const patch: calendar_v3.Schema$Event = { ...existing.data };

    if (params.title !== undefined) patch.summary = params.title;
    if (params.description !== undefined) patch.description = params.description;
    if (params.startDateTime !== undefined)
      patch.start = { dateTime: params.startDateTime, timeZone: 'UTC' };
    if (params.endDateTime !== undefined)
      patch.end = { dateTime: params.endDateTime, timeZone: 'UTC' };
    if (params.attendees !== undefined)
      patch.attendees = params.attendees.map((email) => ({ email }));

    const response = await cal.events.update({
      calendarId,
      eventId: params.eventId,
      requestBody: patch,
    });
    return response.data;
  }

  async deleteEvent(params: {
    credentials?: string;
    calendarId?: string;
    eventId: string;
  }): Promise<{ deleted: boolean; eventId: string }> {
    const cal = this.calendarClient(params.credentials);
    const calendarId = params.calendarId ?? this.defaultCalendarId;

    await cal.events.delete({ calendarId, eventId: params.eventId });
    return { deleted: true, eventId: params.eventId };
  }
}
