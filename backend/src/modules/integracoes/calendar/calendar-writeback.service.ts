import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarConnectionService } from "./calendar-connection.service";
import { MicrosoftGraphClient } from "../graph/microsoft-graph.client";
import { orkestriEventToGraph, computeSyncHash as computeMsSyncHash } from "./outlook-mapper";
import { GoogleCalendarClient } from "../google/google-calendar.client";
import { orkestriEventToGoogle, computeSyncHash as computeGoogleSyncHash } from "./google-mapper";

@Injectable()
export class CalendarWritebackService {
  private readonly logger = new Logger(CalendarWritebackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: CalendarConnectionService,
    private readonly graph: MicrosoftGraphClient,
    private readonly googleClient: GoogleCalendarClient,
  ) {}

  private async pushableConnections(userId: string) {
    return this.prisma.calendarConnection.findMany({
      where: {
        userId,
        pushEnabled: true,
        syncEnabled: true,
        status: { notIn: ["disconnected", "reauth_required"] },
      },
    });
  }

  /** Cria no provedor externo (Google e/ou Microsoft) um evento nativo recém-criado no Orkiestri. */
  async onEventCreated(eventId: string): Promise<void> {
    try {
      const ev = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!ev || (ev.provider && ev.provider !== "internal")) return;
      if (ev.externalId) return; // já vinculado

      const conns = await this.pushableConnections(ev.userId);
      if (!conns.length) return;

      for (const conn of conns) {
        try {
          const token = await this.connections.getValidAccessToken(conn.id);
          let externalId: string | null = null;
          let externalEtag: string | null = null;

          if (conn.provider === "google") {
            const body = orkestriEventToGoogle(ev as any);
            const created = await this.googleClient.createEvent(token, body, conn.externalCalendarId || "primary");
            externalId = created?.id || null;
            externalEtag = created?.etag || null;
          } else {
            const body = orkestriEventToGraph(ev as any);
            const created = await this.graph.createEvent(token, body);
            externalId = created?.id || null;
            externalEtag = created?.["@odata.etag"] || created?.changeKey || null;
          }

          if (externalId) {
            await this.prisma.event.update({
              where: { id: ev.id },
              data: {
                connectionId: conn.id,
                externalId,
                externalEtag,
                externalCalendarId: conn.externalCalendarId,
                syncHash: computeGoogleSyncHash({
                  titulo: ev.titulo,
                  inicio: ev.inicio,
                  fim: ev.fim ?? null,
                  diaTodo: ev.diaTodo,
                  local: ev.local ?? null,
                  cancelled: false,
                }),
                syncedAt: new Date(),
              },
            });
            this.logger.log(`Evento ${ev.id} espelhado no ${conn.provider} (id: ${externalId})`);
            break; // vincula à conexão primária
          }
        } catch (err: any) {
          this.logger.warn(`Writeback (create) falhou para ${conn.provider} (evento ${eventId}): ${err?.message || err}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Writeback geral (create) falhou para evento ${eventId}: ${e?.message || e}`);
    }
  }

  /** Atualiza no provedor externo um evento que já está vinculado. */
  async onEventUpdated(eventId: string): Promise<void> {
    try {
      const ev = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!ev || !ev.externalId || !ev.connectionId) return;

      const conn = await this.connections.getConnectionById(ev.connectionId);
      if (!conn || !conn.pushEnabled || !conn.syncEnabled || conn.status === "disconnected") return;

      const newHash = computeGoogleSyncHash({
        titulo: ev.titulo,
        inicio: ev.inicio,
        fim: ev.fim ?? null,
        diaTodo: ev.diaTodo,
        local: ev.local ?? null,
        cancelled: false,
      });

      if (newHash === ev.syncHash) return; // Nada relevante mudou

      const token = await this.connections.getValidAccessToken(conn.id);
      let newEtag: string | null = null;

      if (conn.provider === "google") {
        const body = orkestriEventToGoogle(ev as any);
        const updated = await this.googleClient.updateEvent(token, ev.externalId, body, conn.externalCalendarId || "primary");
        newEtag = updated?.etag || ev.externalEtag;
      } else {
        const body = orkestriEventToGraph(ev as any);
        const updated = await this.graph.updateEvent(token, ev.externalId, body);
        newEtag = updated?.["@odata.etag"] || updated?.changeKey || ev.externalEtag;
      }

      await this.prisma.event.update({
        where: { id: ev.id },
        data: {
          externalEtag: newEtag,
          syncHash: newHash,
          syncedAt: new Date(),
        },
      });
      this.logger.log(`Evento ${ev.id} atualizado no ${conn.provider}`);
    } catch (e: any) {
      this.logger.warn(`Writeback (update) falhou para evento ${eventId}: ${e?.message || e}`);
    }
  }

  /** Remove do provedor externo um evento vinculado que foi apagado no Orkiestri. */
  async onEventDeleted(snapshot: { externalId?: string | null; connectionId?: string | null; userId: string }): Promise<void> {
    try {
      if (!snapshot.externalId || !snapshot.connectionId) return;
      const conn = await this.connections.getConnectionById(snapshot.connectionId);
      if (!conn || !conn.pushEnabled || !conn.syncEnabled || conn.status === "disconnected") return;

      const token = await this.connections.getValidAccessToken(conn.id);
      if (conn.provider === "google") {
        await this.googleClient.deleteEvent(token, snapshot.externalId, conn.externalCalendarId || "primary");
      } else {
        await this.graph.deleteEvent(token, snapshot.externalId);
      }
      this.logger.log(`Evento ${snapshot.externalId} excluído no ${conn.provider}`);
    } catch (e: any) {
      this.logger.warn(`Writeback (delete) falhou (externalId ${snapshot.externalId}): ${e?.message || e}`);
    }
  }
}
