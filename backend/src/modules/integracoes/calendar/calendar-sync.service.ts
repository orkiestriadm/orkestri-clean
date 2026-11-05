import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarConnectionService } from "./calendar-connection.service";
import { MicrosoftGraphClient, GraphAuthError, GraphForbiddenError } from "../graph/microsoft-graph.client";
import { graphEventToOrkestri, isSeriesMasterWithoutInstance, GraphEventLike, MappedExternalEvent } from "./outlook-mapper";
import { GoogleCalendarClient, GoogleAuthError, GoogleSyncTokenExpiredError } from "../google/google-calendar.client";
import { googleEventToOrkestri } from "./google-mapper";

// Janela sincronizada: passado recente (histórico útil) + futuro amplo (agenda).
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 180;
const SYNC_TIMEZONE = "UTC";
const MAX_PAGES = 200;

export interface SyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: CalendarConnectionService,
    private readonly graph: MicrosoftGraphClient,
    private readonly googleClient: GoogleCalendarClient,
  ) {}

  private window() {
    const now = Date.now();
    return {
      startIso: new Date(now - WINDOW_PAST_DAYS * 86400_000).toISOString(),
      endIso: new Date(now + WINDOW_FUTURE_DAYS * 86400_000).toISOString(),
    };
  }

  /** Varredura completa (também rola a janela do delta). */
  async initialSync(connectionId: string): Promise<SyncResult> {
    return this.runSync(connectionId, { fresh: true });
  }

  /** Incremental a partir do cursor salvo; cai para completa se não houver cursor. */
  async deltaSync(connectionId: string): Promise<SyncResult> {
    const conn = await this.connections.getConnectionById(connectionId);
    if (!conn?.deltaLink) return this.runSync(connectionId, { fresh: true });
    return this.runSync(connectionId, { fresh: false });
  }

  private async runSync(connectionId: string, opts: { fresh: boolean }): Promise<SyncResult> {
    const conn = await this.connections.getConnectionById(connectionId);
    const result: SyncResult = { imported: 0, updated: 0, cancelled: 0, skipped: 0 };
    if (!conn || conn.status === "disconnected" || !conn.syncEnabled) return result;

    await this.connections.setStatus(connectionId, "syncing");

    let accessToken: string;
    try {
      accessToken = await this.connections.getValidAccessToken(connectionId);
    } catch (e: any) {
      const msg = e?.response?.message || e?.message || "Falha de autenticação";
      if (e?.response?.code !== "REAUTH_REQUIRED") {
        await this.connections.setStatus(connectionId, "error", String(msg).slice(0, 300));
      }
      throw e;
    }

    if (conn.provider === "google") {
      return this.runGoogleSync(conn, accessToken, opts);
    } else {
      return this.runMicrosoftSync(conn, accessToken, opts);
    }
  }

  /** Sincronização Google Calendar */
  private async runGoogleSync(conn: any, accessToken: string, opts: { fresh: boolean }): Promise<SyncResult> {
    const result: SyncResult = { imported: 0, updated: 0, cancelled: 0, skipped: 0 };
    const { startIso, endIso } = this.window();

    try {
      let pageToken: string | undefined = undefined;
      let nextSyncToken: string | undefined = undefined;
      let pages = 0;

      do {
        pages++;
        let page;
        try {
          page = await this.googleClient.calendarEventsDelta(accessToken, {
            syncToken: (opts.fresh || !conn.deltaLink) ? undefined : conn.deltaLink,
            timeMin: (opts.fresh || !conn.deltaLink) ? startIso : undefined,
            timeMax: (opts.fresh || !conn.deltaLink) ? endIso : undefined,
            pageToken,
          });
        } catch (e) {
          if (e instanceof GoogleSyncTokenExpiredError) {
            this.logger.warn(`SyncToken Google expirado para conexão ${conn.id}. Executando sync completo.`);
            return this.runGoogleSync(conn, accessToken, { fresh: true });
          }
          throw e;
        }

        for (const ev of page.items) {
          const mapped = googleEventToOrkestri(ev);
          if (mapped) {
            const r = await this.applyMappedEvent(conn, mapped, "#4285F4");
            result[r]++;
          }
        }

        pageToken = page.nextPageToken;
        if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
      } while (pageToken && pages < MAX_PAGES);

      await this.prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          deltaLink: nextSyncToken || conn.deltaLink,
          lastSyncAt: new Date(),
          status: "synced",
          lastError: null,
        },
      });

      this.logger.log(`Google Sync ${conn.id}: +${result.imported} ~${result.updated} x${result.cancelled} (skip ${result.skipped})`);
      return result;
    } catch (e: any) {
      if (e instanceof GoogleAuthError) {
        await this.connections.markReauthRequired(conn.id, "Google 401 durante sync");
      } else {
        await this.connections.setStatus(conn.id, "error", String(e?.message || "Falha na sincronização Google").slice(0, 300));
      }
      throw e;
    }
  }

  /** Sincronização Microsoft Graph */
  private async runMicrosoftSync(conn: any, accessToken: string, opts: { fresh: boolean }): Promise<SyncResult> {
    const result: SyncResult = { imported: 0, updated: 0, cancelled: 0, skipped: 0 };
    const { startIso, endIso } = this.window();

    try {
      let page = await this.graph.calendarViewDelta(accessToken, {
        deltaLink: opts.fresh ? undefined : (conn.deltaLink || undefined),
        startIso,
        endIso,
        timezone: SYNC_TIMEZONE,
      });

      let pages = 0;
      let deltaLink: string | null = null;
      while (page) {
        pages++;
        const items: GraphEventLike[] = page.value || [];
        for (const ev of items) {
          if (!isSeriesMasterWithoutInstance(ev)) {
            const r = await this.applyEvent(conn, ev);
            result[r]++;
          }
        }
        deltaLink = page["@odata.deltaLink"] || null;
        const nextLink = page["@odata.nextLink"] || null;
        if (deltaLink || !nextLink || pages >= MAX_PAGES) break;
        page = await this.graph.followLink(accessToken, nextLink, SYNC_TIMEZONE);
      }

      await this.prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          deltaLink: deltaLink || conn.deltaLink,
          lastSyncAt: new Date(),
          status: "synced",
          lastError: null,
        },
      });
      this.logger.log(`Microsoft Sync ${conn.id}: +${result.imported} ~${result.updated} x${result.cancelled} (skip ${result.skipped})`);
      return result;
    } catch (e: any) {
      if (e instanceof GraphAuthError) {
        await this.connections.markReauthRequired(conn.id, "Graph 401 durante sync");
      } else if (e instanceof GraphForbiddenError) {
        await this.connections.setStatus(conn.id, "error", "Permissão insuficiente (Calendars.ReadWrite)");
      } else {
        await this.connections.setStatus(conn.id, "error", String(e?.message || "Falha na sincronização").slice(0, 300));
      }
      throw e;
    }
  }

  /**
   * Aplica um evento do Microsoft Graph à agenda unificada.
   */
  private async applyEvent(conn: any, ev: GraphEventLike): Promise<keyof SyncResult> {
    if (isSeriesMasterWithoutInstance(ev)) return "skipped";
    const mapped = graphEventToOrkestri(ev);
    if (!mapped) return "skipped";
    return this.applyMappedEvent(conn, mapped, "#0078d4");
  }

  /**
   * Aplica um evento mapeado (Google ou Microsoft) à tabela Event.
   */
  private async applyMappedEvent(conn: any, mapped: MappedExternalEvent, defaultColor: string): Promise<keyof SyncResult> {
    const existing = await this.prisma.event.findUnique({
      where: { connectionId_externalId: { connectionId: conn.id, externalId: mapped.externalId } },
    });

    if (mapped.cancelled || mapped.showAsFree) {
      if (existing) {
        await this.prisma.event.delete({ where: { id: existing.id } });
        return "cancelled";
      }
      return "skipped";
    }

    if (existing && mapped.externalEtag && existing.externalEtag === mapped.externalEtag) {
      return "skipped";
    }

    const dataCommon = {
      titulo: mapped.titulo,
      descricao: mapped.descricao,
      inicio: mapped.inicio,
      fim: mapped.fim,
      diaTodo: mapped.diaTodo,
      local: mapped.local,
      externalEtag: mapped.externalEtag,
      syncHash: mapped.syncHash,
      syncedAt: new Date(),
      externalCancelled: false,
    };

    if (existing) {
      await this.prisma.event.update({ where: { id: existing.id }, data: dataCommon });
      return "updated";
    }

    await this.prisma.event.create({
      data: {
        ...dataCommon,
        organizationId: conn.organizationId,
        userId: conn.userId,
        criadoPorId: conn.userId,
        tipo: "EXTERNO" as any,
        cor: defaultColor,
        provider: conn.provider || "microsoft",
        connectionId: conn.id,
        externalId: mapped.externalId,
        externalCalendarId: conn.externalCalendarId,
        confirmado: true,
      } as any,
    });
    return "imported";
  }

  /**
   * Reconciliação periódica (rede de segurança): re-sincroniza todas as conexões
   * ativas (Google e Microsoft) com uma varredura completa.
   */
  async reconcileAll(): Promise<{ connections: number; errors: number }> {
    const conns = await this.prisma.calendarConnection.findMany({
      where: { syncEnabled: true, status: { in: ["connected", "synced", "error", "syncing"] } },
      select: { id: true, provider: true },
    });
    let errors = 0;
    for (const c of conns) {
      try {
        await this.initialSync(c.id);
      } catch (e: any) {
        errors++;
        this.logger.warn(`Reconciliação falhou para conexão ${c.id} (${c.provider}): ${e?.message || e}`);
      }
    }
    return { connections: conns.length, errors };
  }
}
