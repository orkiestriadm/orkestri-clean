import { Controller, Get, Query, Res, Logger } from "@nestjs/common";
import { Response } from "express";
import { MicrosoftConfig } from "./graph/microsoft.config";
import { MicrosoftOAuthService } from "./graph/microsoft-oauth.service";
import { CalendarConnectionService } from "./calendar/calendar-connection.service";
import { CalendarSyncService } from "./calendar/calendar-sync.service";
import { SubscriptionService } from "./webhooks/subscription.service";

/**
 * Callback do OAuth — a Microsoft redireciona o NAVEGADOR do usuário para cá
 * (não é chamada do axios). Por isso é público e a identidade vem do `state`
 * assinado, não de sessão nem de id no corpo. Ao final redireciona de volta
 * para a tela de integrações com um status legível na querystring.
 *
 * GET (método seguro) → isento do CSRF por natureza.
 */
@Controller("integracoes/microsoft")
export class OAuthCallbackController {
  private readonly logger = new Logger(OAuthCallbackController.name);

  constructor(
    private readonly config: MicrosoftConfig,
    private readonly oauth: MicrosoftOAuthService,
    private readonly connections: CalendarConnectionService,
    private readonly sync: CalendarSyncService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /**
   * Volta para a tela de integrações por uma página intermediária, e não por
   * 302. O cookie de sessão é `SameSite=Strict`: numa cadeia de redirects que
   * começou em login.microsoftonline.com o navegador não o envia, e o usuário
   * caía no /login mesmo logado. O meta refresh parte de uma página do próprio
   * domínio, então a navegação é same-site e o cookie vai. (Script inline não
   * serve: a CSP do nginx só permite script de 'self'.)
   */
  private redirectTo(res: Response, status: string) {
    const url = `${this.config.appUrl}/dashboard/configuracoes/integracoes?ms=${encodeURIComponent(status)}`;
    const attr = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    res
      .status(200)
      .set("Cache-Control", "no-store")
      .type("html")
      .send(
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
        `<meta http-equiv="refresh" content="0;url=${attr}"><title>Voltando…</title></head>` +
        `<body style="font-family:system-ui,sans-serif;padding:32px">` +
        `<p>Voltando para o sistema… <a href="${attr}">clique aqui</a> se não acontecer sozinho.</p>` +
        `</body></html>`,
      );
  }

  @Get("callback")
  async callback(
    @Res() res: Response,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
    @Query("error_description") errorDescription?: string,
  ) {
    // Usuário cancelou / consentimento negado.
    if (error) {
      this.logger.warn(`Callback OAuth com erro: ${error}`);
      return this.redirectTo(res, error === "access_denied" ? "cancelled" : "error");
    }
    if (!code || !state) return this.redirectTo(res, "error");

    let payload: { userId: string; organizationId: string };
    try {
      payload = this.oauth.verifyState(state);
    } catch (e: any) {
      this.logger.warn(`State inválido no callback: ${e?.message || e}`);
      return this.redirectTo(res, "invalid_state");
    }

    try {
      const tokens = await this.oauth.exchangeCode(code, payload.organizationId);
      const conn = await this.connections.completeConnection({
        userId: payload.userId,
        organizationId: payload.organizationId,
        tokens,
      });

      // Sincronização inicial e criação da assinatura em segundo plano — não
      // travamos o redirect do navegador esperando uma agenda grande.
      this.sync.initialSync(conn.id)
        .then(() => this.subscriptions.ensureForConnection(conn.id))
        .catch((e) => this.logger.warn(`Sync inicial/assinatura falhou (conn ${conn.id}): ${e?.message || e}`));

      return this.redirectTo(res, "connected");
    } catch (e: any) {
      const code2 = e?.response?.code || "";
      this.logger.warn(`Falha ao concluir conexão: ${code2 || e?.message || e}`);
      return this.redirectTo(res, code2 === "REAUTH_REQUIRED" ? "reauth" : "error");
    }
  }
}
