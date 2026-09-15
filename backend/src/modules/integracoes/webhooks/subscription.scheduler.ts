import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SubscriptionService } from "./subscription.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Mantém a integração viva sem depender de ninguém clicar em nada:
 *  - renova as assinaturas de webhook antes de expirarem (e recria as que faltam);
 *  - reconcilia todas as conexões periodicamente (rede de segurança contra
 *    notificações perdidas e para rolar a janela de datas do delta).
 *
 * Tudo é no-op enquanto a integração não estiver configurada (sem App
 * Registration), então conviver com o ambiente "ainda não conectei o Entra" é
 * seguro. Uma trava simples evita sobreposição de execuções.
 */
@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);
  private renewing = false;
  private reconciling = false;
  private polling = false;

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly sync: CalendarSyncService,
    private readonly prisma: PrismaService,
  ) {}

  /** Renova/recria assinaturas — de 6 em 6 horas. */
  @Cron("0 */6 * * *")
  async renew() {
    // Sem gate global de config: a viabilidade de webhook é resolvida por
    // conexão (cada org pode ter a sua). Se não houver conexão/assinatura, os
    // métodos abaixo são no-op baratos.
    if (this.renewing) return;
    this.renewing = true;
    try {
      const { renewed, failed } = await this.subscriptions.renewExpiring();
      // Garante assinatura para conexões ativas que porventura ficaram sem.
      const active = await this.prisma.calendarConnection.findMany({
        where: { provider: "microsoft", syncEnabled: true, status: { in: ["connected", "synced", "syncing", "error"] } },
        select: { id: true },
      });
      let ensured = 0;
      for (const c of active) {
        const r = await this.subscriptions.ensureForConnection(c.id);
        if (r.created) ensured++;
      }
      if (renewed || failed || ensured) {
        this.logger.log(`Assinaturas: ${renewed} renovadas, ${ensured} criadas, ${failed} falhas`);
      }
    } catch (e: any) {
      this.logger.warn(`Renovação de assinaturas falhou: ${e?.message || e}`);
    } finally {
      this.renewing = false;
    }
  }

  /**
   * Sincronização incremental a cada 10 minutos para quem está SEM assinatura
   * ativa. Quando o servidor não é alcançável pela internet (DNS só interno),
   * a Microsoft recusa criar o webhook e, sem isto, o que muda no Outlook
   * esperava a reconciliação de 4 em 4 horas. Com webhook ativo, não roda.
   */
  @Cron("*/10 * * * *")
  async pollSemWebhook() {
    if (this.polling || this.reconciling) return;
    this.polling = true;
    try {
      const conns = await this.prisma.calendarConnection.findMany({
        where: {
          provider: "microsoft",
          syncEnabled: true,
          status: { in: ["connected", "synced", "error"] },
          subscriptions: { none: { expiresAt: { gt: new Date() } } },
        },
        select: { id: true },
      });
      for (const c of conns) {
        await this.sync.deltaSync(c.id).catch((e) => this.logger.warn(`Sync de 10 min falhou (conn ${c.id}): ${e?.message || e}`));
      }
    } catch (e: any) {
      this.logger.warn(`Sync de 10 min falhou: ${e?.message || e}`);
    } finally {
      this.polling = false;
    }
  }

  /** Reconciliação completa — de 4 em 4 horas. */
  @Cron("0 */4 * * *")
  async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const { connections, errors } = await this.sync.reconcileAll();
      if (connections) this.logger.log(`Reconciliação: ${connections} conexões, ${errors} com erro`);
    } catch (e: any) {
      this.logger.warn(`Reconciliação falhou: ${e?.message || e}`);
    } finally {
      this.reconciling = false;
    }
  }
}
