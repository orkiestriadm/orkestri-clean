import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarConnectionService } from "./calendar-connection.service";
import { MicrosoftGraphClient, GraphAuthError, GraphForbiddenError } from "../graph/microsoft-graph.client";
import { graphEventToOrkestri, isSeriesMasterWithoutInstance, needsSeriesMaster, withSeriesMaster, GraphEventLike } from "./outlook-mapper";

const PROVIDER = "microsoft";
// Janela sincronizada: passado recente (histórico útil) + futuro amplo (agenda).
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 180;
const SYNC_TIMEZONE = "UTC";
const MAX_PAGES = 200; // guarda contra loop de paginação

export interface SyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
}

/**
 * Traz o Outlook para a agenda unificada (tabela Event) e mantém em dia.
 *
 * - `initialSync`: varredura completa da janela via calendarView/delta, grava o
 *   deltaLink (cursor) ao final. Também rola a janela (é o que a reconciliação usa).
 * - `deltaSync`: retoma do deltaLink — barato, usado pelo webhook.
 *
 * ## Anti-duplicidade
 * (connectionId, externalId) é UNIQUE. Todo upsert casa por essa chave; webhook
 * e reconciliação chegando ao mesmo evento convergem para a MESMA linha.
 *
 * ## Anti-loop (eco)
 * Se o etag que chega do Graph é igual ao `externalEtag` já guardado, o evento
 * não mudou de fato — pulamos. É o que impede que o writeback do Orkiestri (que
 * grava o etag retornado pelo Graph) volte como uma "mudança" e reescreva tudo
 * num ciclo infinito.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: CalendarConnectionService,
    private readonly graph: MicrosoftGraphClient,
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
      // getValidAccessToken já marca reauth_required quando é o caso.
      const msg = e?.response?.message || e?.message || "Falha de autenticação";
      if (e?.response?.code !== "REAUTH_REQUIRED") {
        await this.connections.setStatus(connectionId, "error", String(msg).slice(0, 300));
      }
      throw e;
    }

    try {
      const { startIso, endIso } = this.window();
      let page = await this.graph.calendarViewDelta(accessToken, {
        deltaLink: opts.fresh ? undefined : (conn.deltaLink || undefined),
        startIso,
        endIso,
        timezone: SYNC_TIMEZONE,
      });

      // Lê todas as páginas antes de aplicar: o mestre de uma série pode vir
      // numa página depois das ocorrências dele.
      let pages = 0;
      let deltaLink: string | null = null;
      const items: GraphEventLike[] = [];
      while (page) {
        pages++;
        items.push(...(page.value || []));
        deltaLink = page["@odata.deltaLink"] || null;
        const nextLink = page["@odata.nextLink"] || null;
        if (deltaLink || !nextLink || pages >= MAX_PAGES) break;
        page = await this.graph.followLink(accessToken, nextLink, SYNC_TIMEZONE);
      }

      const masters = new Map<string, GraphEventLike | null>();
      for (const ev of items) {
        if (ev.type === "seriesMaster" && ev.id) masters.set(ev.id, ev);
      }
      for (const ev of items) {
        let full = ev;
        if (needsSeriesMaster(ev)) {
          const id = ev.seriesMasterId!;
          if (!masters.has(id)) {
            // Delta incremental costuma trazer só a ocorrência: busca o mestre
            // uma vez por série. Falhar aqui não derruba a sincronização.
            try {
              masters.set(id, await this.graph.getSeriesMaster(accessToken, id));
            } catch (e: any) {
              if (e instanceof GraphAuthError) throw e;
              masters.set(id, null);
            }
          }
          full = withSeriesMaster(ev, masters.get(id));
        }
        const r = await this.applyEvent(conn, full);
        result[r]++;
      }

      await this.prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          deltaLink: deltaLink || conn.deltaLink,
          lastSyncAt: new Date(),
          status: "synced",
          lastError: null,
        },
      });
      this.logger.log(`Sync ${connectionId}: +${result.imported} ~${result.updated} x${result.cancelled} (skip ${result.skipped})`);
      return result;
    } catch (e: any) {
      if (e instanceof GraphAuthError) {
        await this.connections.markReauthRequired(connectionId, "Graph 401 durante sync");
      } else if (e instanceof GraphForbiddenError) {
        await this.connections.setStatus(connectionId, "error", "Permissão insuficiente (Calendars.ReadWrite)");
      } else {
        await this.connections.setStatus(connectionId, "error", String(e?.message || "Falha na sincronização").slice(0, 300));
      }
      throw e;
    }
  }

  /**
   * Aplica um evento do Graph à agenda unificada. Retorna qual contador somar.
   * Idempotente: reexecutar com o mesmo etag é no-op ("skipped").
   */
  private async applyEvent(conn: any, ev: GraphEventLike): Promise<keyof SyncResult> {
    if (isSeriesMasterWithoutInstance(ev)) return "skipped";
    const mapped = graphEventToOrkestri(ev);
    if (!mapped) return "skipped";

    const existing = await this.prisma.event.findUnique({
      where: { connectionId_externalId: { connectionId: conn.id, externalId: mapped.externalId } },
    });

    // Cancelado/removido no Outlook → reflete removendo o espelho local.
    if (mapped.cancelled) {
      if (existing) {
        await this.prisma.event.delete({ where: { id: existing.id } });
        return "cancelled";
      }
      return "skipped";
    }

    // "Livre"/"trabalhando noutro lugar" não ocupa a agenda — não espelhamos.
    if (mapped.showAsFree) {
      if (existing) {
        await this.prisma.event.delete({ where: { id: existing.id } });
        return "cancelled";
      }
      return "skipped";
    }

    // Anti-eco: mesmo etag = nada mudou. Se o conteúdo que calculamos mudou
    // (ex.: a ocorrência agora ganha o título do mestre da série), atualiza.
    if (
      existing && mapped.externalEtag && existing.externalEtag === mapped.externalEtag &&
      (!existing.syncHash || existing.syncHash === mapped.syncHash)
    ) {
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
        cor: "#0078d4", // azul Outlook, para distinguir visualmente
        provider: PROVIDER,
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
   * ativas com uma varredura completa, rolando a janela. Cobre notificações de
   * webhook perdidas e falhas transitórias.
   */
  async reconcileAll(): Promise<{ connections: number; errors: number }> {
    const conns = await this.prisma.calendarConnection.findMany({
      where: { provider: PROVIDER, syncEnabled: true, status: { in: ["connected", "synced", "error", "syncing"] } },
      select: { id: true },
    });
    let errors = 0;
    for (const c of conns) {
      try {
        await this.initialSync(c.id);
      } catch (e: any) {
        errors++;
        this.logger.warn(`Reconciliação falhou para conexão ${c.id}: ${e?.message || e}`);
      }
    }
    return { connections: conns.length, errors };
  }
}
