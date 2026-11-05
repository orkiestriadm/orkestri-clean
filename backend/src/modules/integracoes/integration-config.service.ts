import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CalendarProvider } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MicrosoftConfig } from "./graph/microsoft.config";
import { MicrosoftConfigResolver } from "./graph/microsoft-config.resolver";
import { GoogleConfig } from "./google/google.config";
import { GoogleConfigResolver } from "./google/google-config.resolver";
import { encryptSecret, vaultConfigured } from "../../common/vault";

export interface SaveConfigInput {
  clientId?: string;
  tenantId?: string;
  clientSecret?: string; // texto puro; só chega aqui, é cifrado antes de gravar
  redirectUri?: string;
  webhookUrl?: string;
  enabled?: boolean;
}

@Injectable()
export class IntegrationConfigService {
  private readonly logger = new Logger(IntegrationConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly msEnv: MicrosoftConfig,
    private readonly msResolver: MicrosoftConfigResolver,
    private readonly googleEnv: GoogleConfig,
    private readonly googleResolver: GoogleConfigResolver,
  ) {}

  private findRow(scopeOrgId: string | null, provider: CalendarProvider) {
    return this.prisma.calendarProviderConfig.findFirst({
      where: { organizationId: scopeOrgId, provider },
    });
  }

  async getConfig(scopeOrgId: string | null, effectiveForOrgId?: string, provider: CalendarProvider = "microsoft") {
    const row = await this.findRow(scopeOrgId, provider);
    if (provider === "google") {
      const effective = await this.googleResolver.resolve(effectiveForOrgId ?? scopeOrgId ?? undefined);
      return {
        provider: "google" as const,
        scope: scopeOrgId ? "org" : "platform",
        exists: !!row,
        enabled: row?.enabled ?? true,
        clientId: row?.clientId ?? "",
        redirectUri: row?.redirectUri || this.googleEnv.redirectUriFor(this.googleEnv.appUrl),
        webhookUrl: row?.webhookUrl || this.googleEnv.webhookUrlFor(this.googleEnv.appUrl),
        secretConfigured: !!row?.clientSecretEnc,
        redirectUriParaRegistrar: this.googleEnv.redirectUriFor(this.googleEnv.appUrl),
        webhookUrlParaRegistrar: this.googleEnv.webhookUrlFor(this.googleEnv.appUrl),
        effectiveSource: effective.source,
        effectiveConfigured: effective.isConfigured,
        vaultReady: vaultConfigured(),
      };
    }

    // Microsoft
    const effective = await this.msResolver.resolve(effectiveForOrgId ?? scopeOrgId ?? undefined);
    return {
      provider: "microsoft" as const,
      scope: scopeOrgId ? "org" : "platform",
      exists: !!row,
      enabled: row?.enabled ?? true,
      clientId: row?.clientId ?? "",
      tenantId: row?.tenantId ?? "common",
      redirectUri: row?.redirectUri || this.msEnv.redirectUriFor(this.msEnv.appUrl),
      webhookUrl: row?.webhookUrl || this.msEnv.webhookUrlFor(this.msEnv.appUrl),
      secretConfigured: !!row?.clientSecretEnc,
      redirectUriParaRegistrar: this.msEnv.redirectUriFor(this.msEnv.appUrl),
      webhookUrlParaRegistrar: this.msEnv.webhookUrlFor(this.msEnv.appUrl),
      effectiveSource: effective.source,
      effectiveConfigured: effective.isConfigured,
      vaultReady: vaultConfigured(),
    };
  }

  async saveConfig(scopeOrgId: string | null, input: SaveConfigInput, userId?: string, provider: CalendarProvider = "microsoft") {
    if (!vaultConfigured()) {
      throw new BadRequestException("APP_VAULT_KEY não configurada — não é seguro guardar o segredo do app.");
    }
    const clientId = (input.clientId || "").trim();
    if (!clientId) throw new BadRequestException("Client ID é obrigatório.");
    if (input.redirectUri && !/^https:\/\/|^http:\/\/localhost/.test(input.redirectUri.trim())) {
      throw new BadRequestException("Redirect URI deve começar com https:// ou http://localhost.");
    }
    if (input.webhookUrl && !/^https:\/\//.test(input.webhookUrl.trim())) {
      throw new BadRequestException("Webhook URL deve começar com https://.");
    }

    const existing = await this.findRow(scopeOrgId, provider);

    const secretProvided = typeof input.clientSecret === "string" && input.clientSecret.trim().length > 0;
    if (!existing && !secretProvided) {
      throw new BadRequestException("Client Secret é obrigatório na primeira configuração.");
    }

    const data: any = {
      organizationId: scopeOrgId,
      provider,
      clientId,
      tenantId: (input.tenantId || "common").trim(),
      redirectUri: input.redirectUri?.trim() || null,
      webhookUrl: input.webhookUrl?.trim() || null,
      enabled: input.enabled ?? true,
      atualizadoPorId: userId || null,
    };
    if (secretProvided) data.clientSecretEnc = encryptSecret(input.clientSecret!.trim());

    if (existing) {
      await this.prisma.calendarProviderConfig.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.calendarProviderConfig.create({ data });
    }
    this.logger.log(`Config do provedor ${provider} salva (scope=${scopeOrgId ? "org:" + scopeOrgId : "platform"}) por ${userId}`);
    return this.getConfig(scopeOrgId, scopeOrgId ?? undefined, provider);
  }

  async deleteConfig(scopeOrgId: string | null, provider: CalendarProvider = "microsoft") {
    const existing = await this.findRow(scopeOrgId, provider);
    if (existing) {
      await this.prisma.calendarProviderConfig.delete({ where: { id: existing.id } });
    }
    return { removed: !!existing };
  }
}
