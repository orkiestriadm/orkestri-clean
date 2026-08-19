import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { MicrosoftOAuthService, OAuthTokens } from "../graph/microsoft-oauth.service";
import { MicrosoftGraphClient } from "../graph/microsoft-graph.client";
import { encryptSecret, decryptSecret, vaultConfigured } from "../../../common/vault";

const PROVIDER = "microsoft" as const;

/**
 * Dono do vínculo do usuário com o provedor e do ciclo de vida dos tokens.
 *
 * Tokens ficam SEMPRE cifrados (common/vault.ts). O access token é renovado
 * proativamente quando falta menos de ~2 min para expirar; um refresh que falha
 * com invalid_grant marca a conexão como `reauth_required` — nunca deixa o
 * usuário num limbo silencioso.
 */
@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: MicrosoftOAuthService,
    private readonly graph: MicrosoftGraphClient,
  ) {}

  getConnection(userId: string) {
    return this.prisma.calendarConnection.findUnique({
      where: { userId_provider: { userId, provider: PROVIDER } },
    });
  }

  getConnectionById(id: string) {
    return this.prisma.calendarConnection.findUnique({ where: { id } });
  }

  /**
   * Conclui o OAuth: descobre a identidade da conta, o calendário principal e
   * grava (ou atualiza) a conexão com tokens cifrados. Retorna a conexão.
   */
  async completeConnection(params: {
    userId: string;
    organizationId: string;
    tokens: OAuthTokens;
  }) {
    if (!vaultConfigured()) {
      throw new BadRequestException("APP_VAULT_KEY não configurada — não é seguro guardar tokens.");
    }
    const { userId, organizationId, tokens } = params;

    // Identidade + calendário principal (falha aqui não deve vazar token no log).
    const me = await this.graph.getMe(tokens.accessToken);
    let calendar: any = null;
    try {
      calendar = await this.graph.getPrimaryCalendar(tokens.accessToken);
    } catch (e) {
      this.logger.warn("Não foi possível ler o calendário principal na conexão; seguirá com /me/events.");
    }

    const data = {
      organizationId,
      userId,
      provider: PROVIDER,
      providerAccountId: me?.id || null,
      providerEmail: me?.mail || me?.userPrincipalName || null,
      externalCalendarId: calendar?.id || null,
      externalCalendarName: calendar?.name || null,
      status: "syncing" as const,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope || null,
      lastError: null,
      // Reconexão zera o cursor incremental para forçar uma varredura completa.
      deltaLink: null,
    };

    return this.prisma.calendarConnection.upsert({
      where: { userId_provider: { userId, provider: PROVIDER } },
      create: data,
      update: data,
    });
  }

  /**
   * Garante um access token válido para uma conexão, renovando se necessário.
   * Persiste o token renovado (cifrado). Lança com code REAUTH_REQUIRED se o
   * refresh token não valer mais.
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
      throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Reconecte a conta Microsoft." });
    }
    let refreshToken: string;
    try {
      refreshToken = decryptSecret(conn.refreshTokenEnc);
    } catch {
      await this.markReauthRequired(conn.id, "Refresh token corrompido");
      throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Reconecte a conta Microsoft." });
    }

    try {
      const tokens = await this.oauth.refresh(refreshToken, conn.organizationId);
      await this.prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          // O Graph pode devolver um novo refresh token (rotativo) — preserva o antigo se não vier.
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
        throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Autorização Microsoft expirada. Reconecte a conta." });
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

  async setPushEnabled(userId: string, enabled: boolean) {
    const conn = await this.getConnection(userId);
    if (!conn) throw new BadRequestException("Nenhuma conta conectada");
    return this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: { pushEnabled: enabled },
    });
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
      // Mensagem amigável; detalhe técnico fica só no lastError (log/admin).
      error: conn.status === "error" || conn.status === "reauth_required" ? (conn.lastError || null) : null,
    };
  }
}
