import { googleEventToOrkestri, orkestriEventToGoogle, computeSyncHash } from "./google-mapper";
import { GoogleCalendarEvent } from "../google/google-calendar.client";

describe("google-mapper", () => {
  it("converte evento normal com dateTime e fuso para a agenda do Orkiestri", () => {
    const gEvent: GoogleCalendarEvent = {
      id: "g-ev-123",
      status: "confirmed",
      summary: "Reunião de Planejamento",
      description: "Discutir metas Q4",
      location: "Sala 2",
      start: { dateTime: "2026-11-10T14:00:00Z" },
      end: { dateTime: "2026-11-10T15:00:00Z" },
      etag: '"etag123"',
      htmlLink: "https://calendar.google.com/event?eid=xxx",
    };

    const mapped = googleEventToOrkestri(gEvent);
    expect(mapped).not.toBeNull();
    expect(mapped!.externalId).toBe("g-ev-123");
    expect(mapped!.titulo).toBe("Reunião de Planejamento");
    expect(mapped!.local).toBe("Sala 2");
    expect(mapped!.diaTodo).toBe(false);
    expect(mapped!.cancelled).toBe(false);
    expect(mapped!.inicio.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(mapped!.fim?.toISOString()).toBe("2026-11-10T15:00:00.000Z");
    expect(mapped!.externalEtag).toBe('"etag123"');
    expect(mapped!.descricao).toContain("Discutir metas Q4");
    expect(mapped!.descricao).toContain("Google Agenda: https://calendar.google.com/event?eid=xxx");
  });

  it("converte evento de dia inteiro com date", () => {
    const gEvent: GoogleCalendarEvent = {
      id: "g-allday-1",
      status: "confirmed",
      summary: "Feriado Municipal",
      start: { date: "2026-12-25" },
      end: { date: "2026-12-26" },
      etag: '"allday-etag"',
    };

    const mapped = googleEventToOrkestri(gEvent);
    expect(mapped).not.toBeNull();
    expect(mapped!.diaTodo).toBe(true);
    expect(mapped!.titulo).toBe("Feriado Municipal");
    expect(mapped!.inicio.toISOString()).toBe("2026-12-25T00:00:00.000Z");
  });

  it("identifica evento cancelado", () => {
    const gEvent: GoogleCalendarEvent = {
      id: "g-cancelled-1",
      status: "cancelled",
    };

    const mapped = googleEventToOrkestri(gEvent);
    expect(mapped).not.toBeNull();
    expect(mapped!.cancelled).toBe(true);
    expect(mapped!.externalId).toBe("g-cancelled-1");
  });

  it("converte evento do Orkiestri para formato do Google Calendar (writeback)", () => {
    const orkEvent = {
      titulo: "Alinhamento com Cliente",
      descricao: "Apresentar nova feature",
      inicio: new Date("2026-11-12T10:00:00.000Z"),
      fim: new Date("2026-11-12T11:00:00.000Z"),
      diaTodo: false,
      local: "Google Meet",
    };

    const googlePayload = orkestriEventToGoogle(orkEvent);
    expect(googlePayload.summary).toBe("Alinhamento com Cliente");
    expect(googlePayload.description).toBe("Apresentar nova feature");
    expect(googlePayload.location).toBe("Google Meet");
    expect(googlePayload.start?.dateTime).toBe("2026-11-12T10:00:00.000Z");
    expect(googlePayload.end?.dateTime).toBe("2026-11-12T11:00:00.000Z");
  });

  it("calcula hash estável para detecção de eco (anti-loop)", () => {
    const hash1 = computeSyncHash({
      titulo: "Dentista",
      inicio: new Date("2026-11-15T09:00:00Z"),
      fim: new Date("2026-11-15T10:00:00Z"),
      diaTodo: false,
      local: null,
      cancelled: false,
    });

    const hash2 = computeSyncHash({
      titulo: "Dentista",
      inicio: new Date("2026-11-15T09:00:00Z"),
      fim: new Date("2026-11-15T10:00:00Z"),
      diaTodo: false,
      local: null,
      cancelled: false,
    });

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32);
  });
});

