import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalendarConnectionService } from "../calendar/calendar-connection.service";
import { MicrosoftGraphClient } from "../graph/microsoft-graph.client";
import { MicrosoftConfigResolver } from "../graph/microsoft-config.resolver";

// /me/events aceita no máximo ~4230 min de validade; deixamos folga.
const SUB_LIFETIME_MIN = 4200;
const RESOURCE = "/me/events";

/**
 * Ciclo de vida das assinaturas de Change Notification do Microsoft Graph.
 *
 * A assinatura expira em ~3 dias; o SubscriptionScheduler renova antes disso.
 * Se não houver URL pública HTTPS (dev/local), o webhook é inviável e o método
 * apenas registra isso — a agenda continua consistente via delta + reconciliação.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: CalendarConnectionService,
    private readonly graph: MicrosoftGraphClient,
    private readonly resolver: MicrosoftConfigResolver,
  ) {}

  /** Cria (ou recria) a assinatura de uma conexão. Idempotente por conexão. */
  async ensureForConnection(connectionId: string): Promise<{ created: boolean; reason?: string }> {
    const conn = await this.prisma.calendarConnection.findUnique({ where: { id: connectionId } });
    if (!conn) return { created: false, reason: "conexao_inexistente" };
    const cfg = await this.resolver.resolve(conn.organizationId);
    if (!cfg.isWebhookViable) {
      return { created: false, reason: "sem_url_publica_https" };
    }
    const existing = await this.prisma.calendarSubscription.findFirst({
      where: { connectionId, expiresAt: { gt: new Date(Date.now() + 10 * 60_000) } },
    });
    if (existing) return { created: false, reason: "ja_existe" };

    let token: string;
    try {
      token = await this.connections.getValidAccessToken(connectionId);
    } catch {
      return { created: false, reason: "sem_token" };
    }

    const clientState = randomBytes(24).toString("hex");
    const expiration = new Date(Date.now() + SUB_LIFETIME_MIN * 60_000);
    try {
      const sub = await this.graph.createSubscription(token, {
        changeType: "created,updated,deleted",
        notificationUrl: cfg.webhookUrl,
        resource: RESOURCE,
        expirationDateTime: expiration.toISOString(),
        clientState,
      });
      await this.prisma.calendarSubscription.create({
        data: {
          connectionId,
          subscriptionId: sub.id,
          resource: RESOURCE,
          clientState,
          expiresAt: sub.expirationDateTime ? new Date(sub.expirationDateTime) : expiration,
        },
      });
      this.logger.log(`Assinatura criada para conexão ${connectionId} (expira ${expiration.toISOString()})`);
      return { created: true };
    } catch (e: any) {
      this.logger.warn(`Falha ao criar assinatura da conexão ${connectionId}: ${e?.message || e}`);
      return { created: false, reason: "erro_graph" };
    }
  }

  /** Renova assinaturas que expiram em breve. */
  async renewExpiring(withinMin = 12 * 60): Promise<{ renewed: number; failed: number }> {
    const due = await this.prisma.calendarSubscription.findMany({
      where: { expiresAt: { lt: new Date(Date.now() + withinMin * 60_000) } },
    });
    let renewed = 0, failed = 0;
    for (const sub of due) {
      try {
        const token = await this.connections.getValidAccessToken(sub.connectionId);
        const expiration = new Date(Date.now() + SUB_LIFETIME_MIN * 60_000);
        await this.graph.renewSubscription(token, sub.subscriptionId, expiration.toISOString());
        await this.prisma.calendarSubscription.update({ where: { id: sub.id }, data: { expiresAt: expiration } });
        renewed++;
      } catch (e: any) {
        failed++;
        this.logger.warn(`Renovação falhou (sub ${sub.subscriptionId}): ${e?.message || e}`);
        // Assinatura provavelmente morta no Graph — remove o registro e deixa o
        // ensure recriar na próxima passada.
        if (String(e?.message || "").includes("404")) {
          await this.prisma.calendarSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
    return { renewed, failed };
  }

  /** Cancela e remove todas as assinaturas de uma conexão (usado na desconexão). */
  async deleteForConnection(connectionId: string): Promise<void> {
    const subs = await this.prisma.calendarSubscription.findMany({ where: { connectionId } });
    if (!subs.length) return;
    let token: string | null = null;
    try { token = await this.connections.getValidAccessToken(connectionId); } catch { token = null; }
    for (const sub of subs) {
      if (token) {
        await this.graph.deleteSubscription(token, sub.subscriptionId).catch((e) =>
          this.logger.warn(`Falha ao deletar assinatura ${sub.subscriptionId} no Graph: ${e?.message || e}`));
      }
      await this.prisma.calendarSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }

  findBySubscriptionId(subscriptionId: string) {
    return this.prisma.calendarSubscription.findUnique({
      where: { subscriptionId },
      include: { connection: true },
    });
  }
}
