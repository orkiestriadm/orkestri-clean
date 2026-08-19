import { Controller, Post, Get, Req, Res, Query, Logger } from "@nestjs/common";
import { Request, Response } from "express";
import { SubscriptionService } from "./subscription.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";

/**
 * Endpoint PÚBLICO das Change Notifications do Microsoft Graph.
 *
 * Não usa AuthGuard (o Graph chama sem sessão). A autenticidade vem do
 * `clientState` — um segredo por assinatura, gerado por nós e devolvido em cada
 * notificação; comparamos com o valor guardado e descartamos o que não bater.
 * A rota está em CSRF_EXEMPT_PATHS (main.ts).
 *
 * Responde SEMPRE rápido (202) e processa a sincronização em segundo plano — o
 * Graph reenvia se não receber 2xx em ~30s, e reprocessar é seguro porque o
 * deltaSync é idempotente.
 */
@Controller("integracoes/microsoft")
export class GraphWebhookController {
  private readonly logger = new Logger(GraphWebhookController.name);

  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly sync: CalendarSyncService,
  ) {}

  /**
   * Handshake de validação: ao criar a assinatura, o Graph faz um GET/POST com
   * ?validationToken=... e espera o token de volta em text/plain, 200, em 10s.
   */
  @Get("webhook")
  validateGet(@Query("validationToken") token: string, @Res() res: Response) {
    return this.handshake(token, res);
  }

  @Post("webhook")
  async notify(@Query("validationToken") validationToken: string, @Req() req: Request, @Res() res: Response) {
    // Alguns fluxos mandam o validationToken no POST.
    if (validationToken) return this.handshake(validationToken, res);

    const body: any = req.body || {};
    const notifications: any[] = Array.isArray(body.value) ? body.value : [];

    // Responde já; processa depois.
    res.status(202).send();

    // Dedup por conexão nesta leva (várias notificações da mesma assinatura).
    const connectionIds = new Set<string>();
    for (const n of notifications) {
      try {
        const subId = n?.subscriptionId;
        const clientState = n?.clientState;
        if (!subId) continue;
        const sub = await this.subscriptions.findBySubscriptionId(subId);
        if (!sub) { this.logger.warn(`Notificação de assinatura desconhecida ${subId}`); continue; }
        // Verificação de autenticidade.
        if (!clientState || clientState !== sub.clientState) {
          this.logger.warn(`clientState inválido para assinatura ${subId} — descartada`);
          continue;
        }
        if (sub.connection && sub.connection.status !== "disconnected") {
          connectionIds.add(sub.connectionId);
        }
      } catch (e: any) {
        this.logger.warn(`Falha ao processar notificação: ${e?.message || e}`);
      }
    }

    for (const cid of connectionIds) {
      this.sync.deltaSync(cid).catch((e) =>
        this.logger.warn(`deltaSync via webhook falhou para conexão ${cid}: ${e?.message || e}`));
    }
  }

  private handshake(token: string, res: Response) {
    // Devolve o token cru, exatamente como recebido.
    res.status(200).type("text/plain").send(token || "");
  }
}
