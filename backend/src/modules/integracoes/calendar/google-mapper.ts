import { createHash } from "crypto";
import { GoogleCalendarEvent } from "../google/google-calendar.client";
import { MappedExternalEvent } from "./outlook-mapper";

export function computeSyncHash(parts: {
  titulo: string;
  inicio: Date | null;
  fim: Date | null;
  diaTodo: boolean;
  local: string | null;
  cancelled: boolean;
}): string {
  const raw = [
    parts.titulo,
    parts.inicio?.toISOString() || "",
    parts.fim?.toISOString() || "",
    parts.diaTodo ? "1" : "0",
    parts.local || "",
    parts.cancelled ? "cancel" : "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function parseGoogleDateTime(dt?: { date?: string; dateTime?: string; timeZone?: string }): Date | null {
  if (!dt) return null;
  if (dt.date) {
    // Evento de dia inteiro: "YYYY-MM-DD"
    return new Date(`${dt.date}T00:00:00Z`);
  }
  if (!dt.dateTime) return null;
  const d = new Date(dt.dateTime);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converte um GoogleCalendarEvent em MappedExternalEvent para a tabela Event.
 */
export function googleEventToOrkestri(ev: GoogleCalendarEvent): MappedExternalEvent | null {
  const cancelled = ev.status === "cancelled";
  const inicio = parseGoogleDateTime(ev.start);
  if (!inicio && !cancelled) return null;

  const titulo = (ev.summary && ev.summary.trim()) || "(Sem título)";
  const fim = parseGoogleDateTime(ev.end);
  const diaTodo = !ev.start?.dateTime && !!ev.start?.date;
  const local = ev.location?.trim() || null;

  const descParts: string[] = [];
  if (ev.description && ev.description.trim()) {
    descParts.push(ev.description.trim().slice(0, 500));
  }
  if (ev.htmlLink) {
    descParts.push(`Google Agenda: ${ev.htmlLink}`);
  }
  const descricao = descParts.length ? descParts.join("\n\n") : null;

  const etag = ev.etag || null;

  return {
    externalId: ev.id,
    titulo,
    descricao,
    inicio: inicio || new Date(0),
    fim,
    diaTodo,
    local,
    externalEtag: etag,
    cancelled,
    showAsFree: false,
    syncHash: computeSyncHash({ titulo, inicio, fim, diaTodo, local, cancelled }),
  };
}

/**
 * Converte um Event do Orkiestri para o formato esperado pela Google Calendar API v3.
 */
export function orkestriEventToGoogle(ev: {
  titulo: string;
  descricao?: string | null;
  inicio: Date;
  fim?: Date | null;
  diaTodo?: boolean;
  local?: string | null;
}): Partial<GoogleCalendarEvent> {
  const start = ev.inicio;
  const end = ev.fim || new Date(start.getTime() + 60 * 60 * 1000);

  const body: Partial<GoogleCalendarEvent> = {
    summary: ev.titulo,
    description: ev.descricao || "",
  };

  if (ev.local) {
    body.location = ev.local;
  }

  if (ev.diaTodo) {
    const dstr = (d: Date) => d.toISOString().slice(0, 10);
    const endDay = ev.fim ? end : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    body.start = { date: dstr(start) };
    body.end = { date: dstr(endDay) };
  } else {
    body.start = { dateTime: start.toISOString() };
    body.end = { dateTime: end.toISOString() };
  }

  return body;
}

