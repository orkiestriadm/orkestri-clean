import { Controller, Get, Post, Put, Delete, Patch, Body, Query, Req, UseGuards, Logger, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Permissions } from "../../auth/permissions.decorator";
import { PermissionsGuard } from "../../auth/permissions.guard";
import { GoogleConfigResolver } from "./google-config.resolver";
import { GoogleOAuthService } from "./google-oauth.service";
import { CalendarConnectionService } from "../calendar/calendar-connection.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";
import { IntegrationConfigService } from "../integration-config.service";

class TogglePushDto {
  @IsBoolean() enabled: boolean;
}

class DisconnectDto {
  @IsOptional() @IsBoolean() purgeAll?: boolean;
}

class SaveConfigDto {
  @IsString() clientId: string;
  @IsOptional() @IsString() clientSecret?: string;
  @IsOptional() @IsString() redirectUri?: string;
  @IsOptional() @IsString() webhookUrl?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

@Controller("integracoes/google")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class GoogleIntegracoesController {
  private readonly logger = new Logger(GoogleIntegracoesController.name);

  constructor(
    private readonly resolver: GoogleConfigResolver,
    private readonly oauth: GoogleOAuthService,
    private readonly connections: CalendarConnectionService,
    private readonly sync: CalendarSyncService,
    private readonly configService: IntegrationConfigService,
  ) {}

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
    return this.configService.getConfig(orgId, req.user.organizationId, "google");
  }

  @Put("config")
  @Permissions("integracoes:configurar")
  saveConfig(@Req() req: any, @Body() dto: SaveConfigDto, @Query("scope") scope?: string) {
    const orgId = this.resolveScope(req, scope);
    return this.configService.saveConfig(orgId, dto, req.user.id, "google");
  }

  @Delete("config")
  @Permissions("integracoes:configurar")
  deleteConfig(@Req() req: any, @Query("scope") scope?: string) {
    const orgId = this.resolveScope(req, scope);
    return this.configService.deleteConfig(orgId, "google");
  }

  @Get("status")
  @Permissions("integracoes:conectar")
  async status(@Req() req: any) {
    const [conn, cfg] = await Promise.all([
      this.connections.getConnection(req.user.id, "google"),
      this.resolver.resolve(req.user.organizationId),
    ]);
    return {
      configured: cfg.isConfigured,
      webhookViable: cfg.isWebhookViable,
      ...this.connections.toStatusDto(conn),
    };
  }

  @Get("connect")
  @Permissions("integracoes:conectar")
  async connect(@Req() req: any, @Query("returnTo") returnTo?: string) {
    const url = await this.oauth.buildAuthorizeUrl(req.user.id, req.user.organizationId, returnTo);
    return { url };
  }

  @Post("disconnect")
  @Permissions("integracoes:conectar")
  async disconnect(@Req() req: any, @Body() dto: DisconnectDto) {
    await this.connections.disconnect(req.user.id, "google", !!dto.purgeAll);
    return { ok: true };
  }

  @Post("sync-now")
  @Permissions("integracoes:conectar")
  async syncNow(@Req() req: any) {
    const conn = await this.connections.getConnection(req.user.id, "google");
    if (!conn) return { ok: false, message: "Sem conexão ativa" };
    const res = await this.sync.deltaSync(conn.id);
    return { ok: true, ...res };
  }

  @Patch("toggle-push")
  @Permissions("integracoes:conectar")
  async togglePush(@Req() req: any, @Body() dto: TogglePushDto) {
    await this.connections.setPushEnabled(req.user.id, dto.enabled, "google");
    return { ok: true, pushEnabled: dto.enabled };
  }

  @Patch("toggle-sync")
  @Permissions("integracoes:conectar")
  async toggleSync(@Req() req: any, @Body() dto: TogglePushDto) {
    await this.connections.setSyncEnabled(req.user.id, dto.enabled, "google");
    return { ok: true, syncEnabled: dto.enabled };
  }
}

