import { Injectable, Logger } from "@nestjs/common";
import { GoogleConfig } from "./google.config";

export class GoogleAuthError extends Error {
  code = "GOOGLE_AUTH_ERROR";
}

export class GoogleSyncTokenExpiredError extends Error {
  code = "SYNC_TOKEN_EXPIRED";
}

export interface GoogleEventDateTime {
  date?: string; // YYYY-MM-DD para evento dia todo
  dateTime?: string; // ISO RFC3339
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  etag?: string;
  updated?: string;
  created?: string;
  htmlLink?: string;
}

export interface GoogleEventsPage {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

@Injectable()
export class GoogleCalendarClient {
  private readonly logger = new Logger(GoogleCalendarClient.name);

  constructor(private readonly config: GoogleConfig) {}

  private async fetchJson(url: string, accessToken: string, init: RequestInit = {}): Promise<any> {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...init, headers });

    if (res.status === 401) {
      throw new GoogleAuthError("Token do Google inválido ou expirado");
    }
    if (res.status === 410) {
      throw new GoogleSyncTokenExpiredError("syncToken expirou; necessário sincronismo completo");
    }

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || `Google API status ${res.status}`;
      this.logger.warn(`Erro Google Calendar API (${url}): ${msg}`);
      throw new Error(msg);
    }
    return data;
  }

  async getMe(accessToken: string): Promise<{ id: string; email: string; name?: string }> {
    const data = await this.fetchJson(this.config.userinfoEndpoint, accessToken);
    return {
      id: data.id || data.sub,
      email: data.email,
      name: data.name,
    };
  }

  async getPrimaryCalendar(accessToken: string): Promise<{ id: string; summary: string }> {
    const url = `${this.config.calendarApiBase}/users/me/calendarList/primary`;
    try {
      const data = await this.fetchJson(url, accessToken);
      return { id: data.id || "primary", summary: data.summary || "Principal" };
    } catch {
      return { id: "primary", summary: "Principal" };
    }
  }

  async calendarEventsDelta(
    accessToken: string,
    opts: {
      syncToken?: string;
      timeMin?: string;
      timeMax?: string;
      pageToken?: string;
      calendarId?: string;
    },
  ): Promise<GoogleEventsPage> {
    const calId = encodeURIComponent(opts.calendarId || "primary");
    const params = new URLSearchParams();
    params.set("maxResults", "250");

    if (opts.pageToken) {
      params.set("pageToken", opts.pageToken);
    }

    if (opts.syncToken) {
      params.set("syncToken", opts.syncToken);
    } else {
      if (opts.timeMin) params.set("timeMin", opts.timeMin);
      if (opts.timeMax) params.set("timeMax", opts.timeMax);
      params.set("singleEvents", "true");
    }

    const url = `${this.config.calendarApiBase}/calendars/${calId}/events?${params.toString()}`;
    const data = await this.fetchJson(url, accessToken);

    return {
      items: data.items || [],
      nextPageToken: data.nextPageToken,
      nextSyncToken: data.nextSyncToken,
    };
  }

  async createEvent(
    accessToken: string,
    eventBody: Partial<GoogleCalendarEvent>,
    calendarId: string = "primary",
  ): Promise<GoogleCalendarEvent> {
    const calId = encodeURIComponent(calendarId);
    const url = `${this.config.calendarApiBase}/calendars/${calId}/events`;
    return this.fetchJson(url, accessToken, {
      method: "POST",
      body: JSON.stringify(eventBody),
    });
  }

  async updateEvent(
    accessToken: string,
    eventId: string,
    eventBody: Partial<GoogleCalendarEvent>,
    calendarId: string = "primary",
  ): Promise<GoogleCalendarEvent> {
    const calId = encodeURIComponent(calendarId);
    const url = `${this.config.calendarApiBase}/calendars/${calId}/events/${encodeURIComponent(eventId)}`;
    return this.fetchJson(url, accessToken, {
      method: "PATCH",
      body: JSON.stringify(eventBody),
    });
  }

  async deleteEvent(
    accessToken: string,
    eventId: string,
    calendarId: string = "primary",
  ): Promise<void> {
    const calId = encodeURIComponent(calendarId);
    const url = `${this.config.calendarApiBase}/calendars/${calId}/events/${encodeURIComponent(eventId)}`;
    try {
      await this.fetchJson(url, accessToken, { method: "DELETE" });
    } catch (e: any) {
      // Se já foi deletado (404/410), engole o erro
      if (e?.message?.includes("404") || e?.message?.includes("Resource has been deleted")) return;
      throw e;
    }
  }

  async watch(
    accessToken: string,
    channel: { id: string; type: string; address: string; token?: string; expiration?: string },
    calendarId: string = "primary",
  ): Promise<{ id: string; resourceId: string; expiration: string }> {
    const calId = encodeURIComponent(calendarId);
    const url = `${this.config.calendarApiBase}/calendars/${calId}/events/watch`;
    return this.fetchJson(url, accessToken, {
      method: "POST",
      body: JSON.stringify(channel),
    });
  }

  async stopChannel(accessToken: string, channel: { id: string; resourceId: string }): Promise<void> {
    const url = `${this.config.calendarApiBase}/channels/stop`;
    try {
      await this.fetchJson(url, accessToken, {
        method: "POST",
        body: JSON.stringify(channel),
      });
    } catch (e: any) {
      this.logger.warn(`Falha ao parar canal de watch do Google: ${e?.message || e}`);
    }
  }
}

