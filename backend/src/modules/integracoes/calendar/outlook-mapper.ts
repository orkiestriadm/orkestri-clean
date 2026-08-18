import { createHash } from "crypto";

/**
 * Tradução pura entre o evento do Microsoft Graph e o Event da agenda unificada.
 *
 * Sem I/O, sem Prisma — só transformação, para ser testável isoladamente
 * (timezone, dia inteiro, cancelamento, recorrência expandida).
 *
 * ## Timezone
 * Pedimos ao Graph `Prefer: outlook.timezone="UTC"`, então todo `start.dateTime`
 * volta em UTC ("2026-08-18T09:00:00.0000000", timeZone "UTC"). Anexamos "Z" e
 * viram Date corretos. Nada de adivinhar fuso: o Graph já normaliza.
 *
 * ## Recorrência
 * Usamos `/me/calendarView/delta`, que ENTREGA as ocorrências já expandidas
 * dentro da janela (type "occurrence"/"exception", com `seriesMasterId`). Cada
 * ocorrência vira uma linha Event concreta — que é exatamente o que a
 * disponibilidade precisa (um bloco ocupado por instância), sem ter de modelar
 * RRULE no Orkiestri. O seriesMaster puro (sem data) é ignorado.
 */

export interface GraphEventLike {
  id: string;
  "@removed"?: { reason?: string };
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
  seriesMasterId?: string;
  type?: string; // singleInstance | occurrence | exception | seriesMaster
  showAs?: string; // free | tentative | busy | oof | workingElsewhere | unknown
  changeKey?: string;
  lastModifiedDateTime?: string;
  "@odata.etag"?: string;
}

export interface MappedExternalEvent {
  externalId: string;
  titulo: string;
  descricao: string | null;
  inicio: Date;
  fim: Date | null;
  diaTodo: boolean;
  local: string | null;
  externalEtag: string | null;
  cancelled: boolean;
  showAsFree: boolean; // "free"/"workingElsewhere" → não ocupa a agenda
  syncHash: string;
}

/** Parse de um horário do Graph (UTC pedido via Prefer) para Date. */
function parseGraphDateTime(dt?: { dateTime?: string; timeZone?: string; date?: string }): Date | null {
  if (!dt) return null;
  if (dt.date && !dt.dateTime) {
    // Evento de dia inteiro: "2026-08-18"
    return new Date(`${dt.date}T00:00:00Z`);
  }
  if (!dt.dateTime) return null;
  let iso = dt.dateTime;
  // Graph manda sem sufixo de fuso quando pedimos UTC via Prefer. Normaliza.
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(iso)) {
    const tz = (dt.timeZone || "UTC").toLowerCase();
    if (tz === "utc") iso = iso.replace(/\.\d+$/, "") + "Z";
    else iso = iso.replace(/\.\d+$/, "") + "Z"; // fallback: trata como UTC (Prefer garante UTC)
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** É um evento que devemos ignorar por não ter data utilizável (seriesMaster). */
export function isSeriesMasterWithoutInstance(ev: GraphEventLike): boolean {
  return ev.type === "seriesMaster";
}

/** Hash do conteúdo relevante — muda só quando algo que nos importa muda. */
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

/**
 * Converte um evento do Graph em campos do Event. Retorna null se não houver
 * como posicioná-lo no tempo (sem início).
 */
export function graphEventToOrkestri(ev: GraphEventLike): MappedExternalEvent | null {
  const removed = !!ev["@removed"];
  const inicio = parseGraphDateTime(ev.start);
  // Evento removido no delta vem só com id + @removed — tratamos como cancelamento.
  if (!inicio && !removed) return null;

  const titulo = (ev.subject && ev.subject.trim()) || "(Sem título)";
  const fim = parseGraphDateTime(ev.end);
  const diaTodo = !!ev.isAllDay;
  const local = ev.location?.displayName?.trim() || null;
  const joinUrl = ev.onlineMeeting?.joinUrl || ev.onlineMeetingUrl || null;
  const cancelled = removed || !!ev.isCancelled;
  const showAs = (ev.showAs || "busy").toLowerCase();
  const showAsFree = showAs === "free" || showAs === "workingelsewhere";

  // Descrição: preferimos bodyPreview (texto curto, sem HTML) e anexamos o link
  // de reunião se houver. Evita guardar corpo HTML completo (privacidade).
  const descParts: string[] = [];
  if (ev.bodyPreview && ev.bodyPreview.trim()) descParts.push(ev.bodyPreview.trim().slice(0, 500));
  if (joinUrl) descParts.push(`Reunião: ${joinUrl}`);
  const descricao = descParts.length ? descParts.join("\n\n") : null;

  const etag = ev["@odata.etag"] || ev.changeKey || null;

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
    showAsFree,
    syncHash: computeSyncHash({ titulo, inicio, fim, diaTodo, local, cancelled }),
  };
}

/**
 * Monta o corpo do evento do Graph a partir de um Event do Orkiestri (writeback).
 * v1 escreve evento único; recorrência nativa do Orkiestri sobe como uma série
 * simples só quando informada, senão evento pontual. Datas em UTC.
 */
export function orkestriEventToGraph(ev: {
  titulo: string;
  descricao?: string | null;
  inicio: Date;
  fim?: Date | null;
  diaTodo?: boolean;
  local?: string | null;
}): any {
  const start = ev.inicio;
  // Sem fim: assume 1h (ou o dia inteiro).
  const end = ev.fim || new Date(start.getTime() + 60 * 60 * 1000);

  const body: any = {
    subject: ev.titulo,
    body: { contentType: "text", content: ev.descricao || "" },
    isAllDay: !!ev.diaTodo,
  };

  if (ev.diaTodo) {
    const dstr = (d: Date) => d.toISOString().slice(0, 10);
    // Dia inteiro no Graph exige start/end à meia-noite e end no dia seguinte.
    const endDay = ev.fim ? end : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    body.start = { dateTime: `${dstr(start)}T00:00:00.0000000`, timeZone: "UTC" };
    body.end = { dateTime: `${dstr(endDay)}T00:00:00.0000000`, timeZone: "UTC" };
  } else {
    body.start = { dateTime: start.toISOString().replace("Z", "0000"), timeZone: "UTC" };
    body.end = { dateTime: end.toISOString().replace("Z", "0000"), timeZone: "UTC" };
  }

  if (ev.local) body.location = { displayName: ev.local };
  return body;
}
