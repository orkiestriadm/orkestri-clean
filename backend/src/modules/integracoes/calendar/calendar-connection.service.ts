import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CalendarProvider } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { MicrosoftOAuthService, OAuthTokens as MsOAuthTokens } from "../graph/microsoft-oauth.service";
import { MicrosoftGraphClient } from "../graph/microsoft-graph.client";
import { GoogleOAuthService, OAuthTokens as GoogleOAuthTokens } from "../google/google-oauth.service";
import { GoogleCalendarClient } from "../google/google-calendar.client";
import { encryptSecret, decryptSecret, vaultConfigured } from "../../../common/vault";

export type AnyOAuthTokens = MsOAuthTokens | GoogleOAuthTokens;

@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly msOAuth: MicrosoftOAuthService,
    private readonly graph: MicrosoftGraphClient,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly googleClient: GoogleCalendarClient,
  ) {}

  getConnection(userId: string, provider: CalendarProvider = "microsoft") {
    return this.prisma.calendarConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
  }

  getConnectionById(id: string) {
    return this.prisma.calendarConnection.findUnique({ where: { id } });
  }

  getUserConnections(userId: string) {
    return this.prisma.calendarConnection.findMany({
      where: { userId, status: { not: "disconnected" } },
    });
  }

  /**
   * Conclui o OAuth (Microsoft ou Google): descobre a identidade da conta,
   * o calendário principal e grava (ou atualiza) a conexão com tokens cifrados.
   */
  async completeConnection(params: {
    userId: string;
    organizationId: string;
    tokens: AnyOAuthTokens;
    provider?: CalendarProvider;
    pushEnabled?: boolean;
    syncEnabled?: boolean;
  }) {
    if (!vaultConfigured()) {
      throw new BadRequestException("APP_VAULT_KEY não configurada — não é seguro guardar tokens.");
    }
    const { userId, organizationId, tokens } = params;
    const provider: CalendarProvider = params.provider || "microsoft";

    let providerAccountId: string | null = null;
    let providerEmail: string | null = null;
    let externalCalendarId: string | null = null;
    let externalCalendarName: string | null = null;

    if (provider === "google") {
      try {
        const me = await this.googleClient.getMe(tokens.accessToken);
        providerAccountId = me.id || null;
        providerEmail = me.email || null;
      } catch (e: any) {
        this.logger.warn(`Falha ao obter perfil do Google: ${e?.message || e}`);
      }

      try {
        const cal = await this.googleClient.getPrimaryCalendar(tokens.accessToken);
        externalCalendarId = cal.id;
        externalCalendarName = cal.summary;
      } catch (e: any) {
        this.logger.warn(`Falha ao obter calendário do Google: ${e?.message || e}`);
        externalCalendarId = "primary";
        externalCalendarName = "Principal";
      }
    } else {
      // Microsoft Graph
      const me = await this.graph.getMe(tokens.accessToken);
      providerAccountId = me?.id || null;
      providerEmail = me?.mail || me?.userPrincipalName || null;
      try {
        const calendar = await this.graph.getPrimaryCalendar(tokens.accessToken);
        externalCalendarId = calendar?.id || null;
        externalCalendarName = calendar?.name || null;
      } catch {
        this.logger.warn("Não foi possível ler o calendário principal no Graph; seguirá com /me/events.");
      }
    }

    const data: any = {
      organizationId,
      userId,
      provider,
      providerAccountId,
      providerEmail,
      externalCalendarId,
      externalCalendarName,
      status: "syncing" as const,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope || null,
      lastError: null,
      deltaLink: null,
    };

    if (params.pushEnabled !== undefined) data.pushEnabled = params.pushEnabled;
    if (params.syncEnabled !== undefined) data.syncEnabled = params.syncEnabled;

    return this.prisma.calendarConnection.upsert({
      where: { userId_provider: { userId, provider } },
      create: data,
      update: data,
    });
  }

  /**
   * Garante um access token válido para uma conexão, renovando se necessário.
   */
  async getValidAccessToken(connectionId: string): Promise<string> {
    const conn = await this.prisma.calendarConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new BadRequestException("Conexão não encontrada");
    if (conn.status === "disconnected") throw new BadRequestException("Conexão desconectada");
    if (!conn.accessTokenEnc) throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Sem token — reconecte." });

    const expiresSoon = !conn.tokenExpiresAt || conn.tokenExpiresAt.getTime() - Date.now() < 120_000;
    if (!expiresSoon) {
      return decryptSecret(conn.accessTokenEnc);
    }

    // Precisa renovar.
    if (!conn.refreshTokenEnc) {
      await this.markReauthRequired(conn.id, "Sem refresh token");
      throw new BadRequestException({ code: "REAUTH_REQUIRED", message: `Reconecte a conta ${conn.provider}.` });
    }
    let refreshToken: string;
    try {
      refreshToken = decryptSecret(conn.refreshTokenEnc);
    } catch {
      await this.markReauthRequired(conn.id, "Refresh token corrompido");
      throw new BadRequestException({ code: "REAUTH_REQUIRED", message: `Reconecte a conta ${conn.provider}.` });
    }

    try {
      let tokens: AnyOAuthTokens;
      if (conn.provider === "google") {
        tokens = await this.googleOAuth.refresh(refreshToken, conn.organizationId);
      } else {
        tokens = await this.msOAuth.refresh(refreshToken, conn.organizationId);
      }

      await this.prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : conn.refreshTokenEnc,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope || conn.scope,
          status: conn.status === "reauth_required" ? "connected" : conn.status,
          lastError: null,
        },
      });
      return tokens.accessToken;
    } catch (e: any) {
      const code = e?.response?.code || e?.code;
      if (code === "REAUTH_REQUIRED") {
        await this.markReauthRequired(conn.id, "invalid_grant no refresh");
        throw new BadRequestException({ code: "REAUTH_REQUIRED", message: `Autorização ${conn.provider} expirada. Reconecte a conta.` });
      }
      throw e;
    }
  }

  async markReauthRequired(connectionId: string, reason: string) {
    this.logger.warn(`Conexão ${connectionId} precisa de reautenticação: ${reason}`);
    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: { status: "reauth_required", lastError: reason },
    }).catch(() => {});
  }

  async setStatus(connectionId: string, status: any, lastError?: string | null) {
    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: { status, ...(lastError !== undefined ? { lastError } : {}) },
    }).catch(() => {});
  }

  async setPushEnabled(userId: string, enabled: boolean, provider: CalendarProvider = "microsoft") {
    const conn = await this.getConnection(userId, provider);
    if (!conn) throw new BadRequestException("Nenhuma conta conectada");
    return this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: { pushEnabled: enabled },
    });
  }

  async setSyncEnabled(userId: string, enabled: boolean, provider: CalendarProvider = "microsoft") {
    const conn = await this.getConnection(userId, provider);
    if (!conn) throw new BadRequestException("Nenhuma conta conectada");
    return this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: { syncEnabled: enabled },
    });
  }

  async disconnect(userId: string, provider: CalendarProvider = "microsoft", purgeAll: boolean = false) {
    const conn = await this.getConnection(userId, provider);
    if (!conn) return;

    // Desconecta e limpa tokens/cursor
    await this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: {
        status: "disconnected",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        deltaLink: null,
        lastError: null,
      },
    });

    // Remove assinaturas ativas de webhook
    await this.prisma.calendarSubscription.deleteMany({
      where: { connectionId: conn.id },
    }).catch(() => {});

    // Limpeza de eventos importados
    if (purgeAll) {
      await this.prisma.event.deleteMany({
        where: { connectionId: conn.id },
      });
    } else {
      // Mantém histórico passado e remove compromissos futuros
      await this.prisma.event.deleteMany({
        where: {
          connectionId: conn.id,
          inicio: { gte: new Date() },
        },
      });
    }
  }

  /** DTO de status seguro para o frontend — sem tokens, sem stack traces. */
  toStatusDto(conn: any | null) {
    if (!conn) {
      return { connected: false, status: "DISCONNECTED" as const };
    }
    return {
      connected: conn.status !== "disconnected",
      status: String(conn.status).toUpperCase(),
      provider: conn.provider,
      account: conn.providerEmail,
      calendarName: conn.externalCalendarName,
      lastSyncAt: conn.lastSyncAt,
      pushEnabled: conn.pushEnabled,
      syncEnabled: conn.syncEnabled,
      error: conn.status === "error" || conn.status === "reauth_required" ? (conn.lastError || null) : null,
    };
  }
}
