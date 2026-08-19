import { Controller, Get, Post, Put, Delete, Patch, Body, Query, Req, Res, UseGuards, Logger, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Response } from "express";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { MicrosoftConfigResolver } from "./graph/microsoft-config.resolver";
import { MicrosoftOAuthService } from "./graph/microsoft-oauth.service";
import { CalendarConnectionService } from "./calendar/calendar-connection.service";
import { CalendarSyncService } from "./calendar/calendar-sync.service";
import { SubscriptionService } from "./webhooks/subscription.service";
import { IntegrationConfigService } from "./integration-config.service";
import { PrismaService } from "../../prisma/prisma.service";

class TogglePushDto {
  @IsBoolean() enabled: boolean;
}

class DisconnectDto {
  // true = apaga TODOS os eventos importados; padrão = mantém histórico passado.
  @IsOptional() @IsBoolean() purgeAll?: boolean;
}

class SaveConfigDto {
  @IsString() clientId: string;
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsString() clientSecret?: string;
  @IsOptional() @IsString() redirectUri?: string;
  @IsOptional() @IsString() webhookUrl?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

/**
 * API autenticada da integração de calendário. Cada usuário só age sobre a
 * PRÓPRIA conexão (identidade sempre de req.user; nada de id vindo do corpo).
 */
@Controller("integracoes/microsoft")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class IntegracoesController {
  private readonly logger = new Logger(IntegracoesController.name);

  constructor(
    private readonly resolver: MicrosoftConfigResolver,
    private readonly oauth: MicrosoftOAuthService,
    private readonly connections: CalendarConnectionService,
    private readonly sync: CalendarSyncService,
    private readonly subscriptions: SubscriptionService,
    private readonly configService: IntegrationConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Configuração do app (credenciais do Entra) por tela ────────────────────
  //
  // scope=platform (padrão da plataforma, organizationId nulo) só para
  // super-admin; caso contrário, a configuração é da organização do usuário.

  private resolveScope(req: any, scope?: string): string | null {
    if (scope === "platform") {
      if (!req.user?.isSuperAdmin) throw new ForbiddenException("Apenas o super-admin define o padrão da plataforma.");
      return null;
    }
    return req.user.organizationId;
  }

  @Get("config")
  @Permissions("integracoes:configurar")
  getConfig(@Req() req: any, @Query("scope") scope?: string) {
    const orgId = this.resolveScope(req, scope);
    return this.configService.getConfig(orgId, req.user.organizationId);
  }

  @Put("config")
  @Permissions("integracoes:configurar")
  saveConfig(@Req() req: any, @Body() dto: SaveConfigDto, @Query("scope") scope?: string) {
    const orgId = this.resolveScope(req, scope);
    return this.configService.saveConfig(orgId, dto, req.user.id);
  }

  @Delete("config")
  @Permissions("integracoes:configurar")
  deleteConfig(@Req() req: any, @Query("scope") scope?: string) {
    const orgId = this.resolveScope(req, scope);
    return this.configService.deleteConfig(orgId);
  }

  /** Estado da integração do usuário (para a tela de configurações). */
  @Get("status")
  @Permissions("integracoes:conectar")
  async status(@Req() req: any) {
    const [conn, cfg] = await Promise.all([
      this.connections.getConnection(req.user.id),
      this.resolver.resolve(req.user.organizationId),
    ]);
    return {
      configured: cfg.isConfigured,
      webhookViable: cfg.isWebhookViable,
      ...this.connections.toStatusDto(conn),
    };
  }

  /** Devolve a URL de autorização; o frontend redireciona o navegador para ela. */
  @Get("connect")
  @Permissions("integracoes:conectar")
  async connect(@Req() req: any) {
    const cfg = await this.resolver.resolve(req.user.organizationId);
    if (!cfg.isConfigured) {
      throw new ServiceUnavailableException({
        code: "MS_NOT_CONFIGURED",
        message: "Integração Microsoft ainda não configurada pelo administrador.",
      });
    }
    const url = await this.oauth.buildAuthorizeUrl(req.user.id, req.user.organizationId);
    return { url };
  }

  /** Dispara uma sincronização imediata (não bloqueia: responde e roda atrás). */
  @Post("sync-now")
  @Permissions("integracoes:conectar")
  async syncNow(@Req() req: any) {
    const conn = await this.connections.getConnection(req.user.id);
    if (!conn || conn.status === "disconnected") {
      throw new ServiceUnavailableException({ code: "NOT_CONNECTED", message: "Nenhuma conta conectada." });
    }
    // Não bloqueia a requisição HTTP com a varredura.
    this.sync.deltaSync(conn.id).catch((e) => this.logger.warn(`sync-now falhou: ${e?.message || e}`));
    return { started: true };
  }

  /** Liga/desliga o envio de eventos do Orkiestri para o Outlook. */
  @Patch("push")
  @Permissions("integracoes:conectar")
  async togglePush(@Req() req: any, @Body() dto: TogglePushDto) {
    const conn = await this.connections.setPushEnabled(req.user.id, dto.enabled);
    return this.connections.toStatusDto(conn);
  }

  /**
   * Desconecta a conta: cancela assinaturas, apaga tokens, marca desconectado e
   * limpa eventos importados FUTUROS (não poluir disponibilidade com dado
   * obsoleto); histórico passado é mantido, salvo purgeAll. Ver docs.
   */
  @Post("disconnect")
  @Permissions("integracoes:conectar")
  async disconnect(@Req() req: any, @Body() dto: DisconnectDto) {
    const conn = await this.connections.getConnection(req.user.id);
    if (!conn) return { disconnected: true };

    await this.subscriptions.deleteForConnection(conn.id);

    const now = new Date();
    const where: any = { connectionId: conn.id, provider: "microsoft" };
    if (!dto?.purgeAll) where.inicio = { gte: now };
    const del = await this.prisma.event.deleteMany({ where });

    await this.prisma.calendarConnection.update({
      where: { id: conn.id },
      data: {
        status: "disconnected",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        deltaLink: null,
        lastError: null,
      },
    });
    this.logger.log(`Usuário ${req.user.id} desconectou Microsoft (${del.count} eventos removidos, purgeAll=${!!dto?.purgeAll})`);
    return { disconnected: true, eventsRemoved: del.count };
  }
}
