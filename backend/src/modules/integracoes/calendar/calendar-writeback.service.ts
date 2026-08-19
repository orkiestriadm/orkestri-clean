import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarConnectionService } from "./calendar-connection.service";
import { MicrosoftGraphClient } from "../graph/microsoft-graph.client";
import { orkestriEventToGraph, computeSyncHash } from "./outlook-mapper";

/**
 * Escreve para o Outlook o que nasceu/mudou no Orkiestri (Orkiestri → Graph).
 *
 * É BEST-EFFORT e não-fatal: uma falha no Graph nunca derruba a operação de
 * agenda do usuário — é registrada e a reconciliação/nova edição reconvergem.
 * Só age quando o usuário tem conexão ativa e `pushEnabled`, e apenas sobre
 * eventos NATIVOS (provider internal). Eventos que já vieram do Outlook não são
 * reescritos aqui (o writeback só empurra o que o Orkiestri originou).
 *
 * ## Anti-loop
 * Ao criar/atualizar no Graph, guardamos no Event o `externalId`, o `etag`
 * retornado e o `syncHash`. Quando o delta trouxer esse mesmo evento de volta,
 * o etag coincide e o CalendarSyncService o ignora — sem eco.
 */
@Injectable()
export class CalendarWritebackService {
  private readonly logger = new Logger(CalendarWritebackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: CalendarConnectionService,
    private readonly graph: MicrosoftGraphClient,
  ) {}

  private async pushableConnection(userId: string) {
    const conn = await this.connections.getConnection(userId);
    if (!conn) return null;
    if (!conn.pushEnabled || !conn.syncEnabled) return null;
    if (conn.status === "disconnected" || conn.status === "reauth_required") return null;
    return conn;
  }

  /** Cria no Outlook um evento nativo recém-criado no Orkiestri e o vincula. */
  async onEventCreated(eventId: string): Promise<void> {
    try {
      const ev = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!ev || (ev.provider && ev.provider !== "internal")) return;
      if (ev.externalId) return; // já vinculado
      const conn = await this.pushableConnection(ev.userId);
      if (!conn) return;

      const token = await this.connections.getValidAccessToken(conn.id);
      const body = orkestriEventToGraph(ev as any);
      const created = await this.graph.createEvent(token, body);

      await this.prisma.event.update({
        where: { id: ev.id },
        data: {
          connectionId: conn.id,
          externalId: created?.id || null,
          externalEtag: created?.["@odata.etag"] || created?.changeKey || null,
          externalCalendarId: conn.externalCalendarId,
          syncHash: computeSyncHash({
            titulo: ev.titulo, inicio: ev.inicio, fim: ev.fim ?? null,
            diaTodo: ev.diaTodo, local: ev.local ?? null, cancelled: false,
          }),
          syncedAt: new Date(),
        },
      });
      this.logger.log(`Evento ${ev.id} espelhado no Outlook (${created?.id ? "ok" : "sem id"})`);
    } catch (e: any) {
      this.logger.warn(`Writeback (create) falhou para evento ${eventId}: ${e?.message || e}`);
    }
  }

  /** Atualiza no Outlook um evento que já está vinculado. */
  async onEventUpdated(eventId: string): Promise<void> {
    try {
      const ev = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!ev || !ev.externalId || !ev.connectionId) return;
      const conn = await this.pushableConnection(ev.userId);
      if (!conn || conn.id !== ev.connectionId) return;

      const newHash = computeSyncHash({
        titulo: ev.titulo, inicio: ev.inicio, fim: ev.fim ?? null,
        diaTodo: ev.diaTodo, local: ev.local ?? null, cancelled: false,
      });
      // Nada relevante mudou → não chama o Graph (evita eco e chamada inútil).
      if (newHash === ev.syncHash) return;

      const token = await this.connections.getValidAccessToken(conn.id);
      const updated = await this.graph.updateEvent(token, ev.externalId, orkestriEventToGraph(ev as any));
      await this.prisma.event.update({
        where: { id: ev.id },
        data: {
          externalEtag: updated?.["@odata.etag"] || updated?.changeKey || ev.externalEtag,
          syncHash: newHash,
          syncedAt: new Date(),
        },
      });
    } catch (e: any) {
      this.logger.warn(`Writeback (update) falhou para evento ${eventId}: ${e?.message || e}`);
    }
  }

  /** Remove do Outlook um evento vinculado que foi apagado no Orkiestri. */
  async onEventDeleted(snapshot: { externalId?: string | null; connectionId?: string | null; userId: string }): Promise<void> {
    try {
      if (!snapshot.externalId || !snapshot.connectionId) return;
      const conn = await this.pushableConnection(snapshot.userId);
      if (!conn || conn.id !== snapshot.connectionId) return;
      const token = await this.connections.getValidAccessToken(conn.id);
      await this.graph.deleteEvent(token, snapshot.externalId);
    } catch (e: any) {
      this.logger.warn(`Writeback (delete) falhou (externalId ${snapshot.externalId}): ${e?.message || e}`);
    }
  }
}
