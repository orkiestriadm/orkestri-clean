import { Controller, Get, Query, Res, Logger } from "@nestjs/common";
import { Response } from "express";
import { GoogleConfig } from "./google.config";
import { GoogleOAuthService } from "./google-oauth.service";
import { CalendarConnectionService } from "../calendar/calendar-connection.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";

@Controller("integracoes/google")
export class GoogleOAuthCallbackController {
  private readonly logger = new Logger(GoogleOAuthCallbackController.name);

  constructor(
    private readonly config: GoogleConfig,
    private readonly oauth: GoogleOAuthService,
    private readonly connections: CalendarConnectionService,
    private readonly sync: CalendarSyncService,
  ) {}

  private redirectTo(res: Response, status: string, returnTo?: string) {
    const base = returnTo || "/dashboard/agenda";
    const separator = base.includes("?") ? "&" : "?";
    const url = `${this.config.appUrl}${base}${separator}google=${encodeURIComponent(status)}`;
    res.redirect(302, url);
  }

  @Get("callback")
  async callback(
    @Res() res: Response,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
  ) {
    if (error) {
      this.logger.warn(`Callback OAuth Google com erro: ${error}`);
      return this.redirectTo(res, error === "access_denied" ? "cancelled" : "error");
    }
    if (!code || !state) return this.redirectTo(res, "error");

    let payload: { userId: string; organizationId: string; returnTo?: string };
    try {
      payload = this.oauth.verifyState(state);
    } catch (e: any) {
      this.logger.warn(`State inválido no callback Google: ${e?.message || e}`);
      return this.redirectTo(res, "invalid_state");
    }

    try {
      const tokens = await this.oauth.exchangeCode(code, payload.organizationId);
      const conn = await this.connections.completeConnection({
        userId: payload.userId,
        organizationId: payload.organizationId,
        tokens,
        provider: "google",
      });

      // Dispara sincronização inicial em background
      this.sync.initialSync(conn.id).catch((e) => {
        this.logger.warn(`Sync inicial Google falhou (conn ${conn.id}): ${e?.message || e}`);
      });

      return this.redirectTo(res, "connected", payload.returnTo);
    } catch (e: any) {
      const code2 = e?.response?.code || "";
      this.logger.warn(`Falha ao concluir conexão Google: ${code2 || e?.message || e}`);
      return this.redirectTo(res, code2 === "REAUTH_REQUIRED" ? "reauth" : "error", payload.returnTo);
    }
  }
}

