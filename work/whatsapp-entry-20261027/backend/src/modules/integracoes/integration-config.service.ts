import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MicrosoftConfig } from "./graph/microsoft.config";
import { MicrosoftConfigResolver } from "./graph/microsoft-config.resolver";
import { encryptSecret, vaultConfigured } from "../../common/vault";

const PROVIDER = "microsoft" as const;

export interface SaveConfigInput {
  clientId?: string;
  tenantId?: string;
  clientSecret?: string; // texto puro; só chega aqui, é cifrado antes de gravar
  redirectUri?: string;
  webhookUrl?: string;
  enabled?: boolean;
}

/**
 * Administra a configuração do app do provedor pela tela (em vez de env).
 *
 * `scopeOrgId`:
 *   - uma string → configuração DAQUELA organização (bring-your-own-app);
 *   - null → padrão da PLATAFORMA (só super-admin), herdado por quem não tem a sua.
 *
 * O client secret nunca volta ao frontend: o DTO expõe apenas `secretConfigured`.
 */
@Injectable()
export class IntegrationConfigService {
  private readonly logger = new Logger(IntegrationConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: MicrosoftConfig,
    private readonly resolver: MicrosoftConfigResolver,
  ) {}

  private findRow(scopeOrgId: string | null) {
    return this.prisma.calendarProviderConfig.findFirst({
      where: { organizationId: scopeOrgId, provider: PROVIDER },
    });
  }

  /** DTO seguro (sem secret) + o que a org precisa saber para registrar no Entra. */
  async getConfig(scopeOrgId: string | null, effectiveForOrgId?: string) {
    const row = await this.findRow(scopeOrgId);
    // A config EFETIVA (o que de fato será usado), para a tela mostrar a origem.
    const effective = await this.resolver.resolve(effectiveForOrgId ?? scopeOrgId ?? undefined);
    return {
      scope: scopeOrgId ? "org" : "platform",
      exists: !!row,
      enabled: row?.enabled ?? true,
      clientId: row?.clientId ?? "",
      tenantId: row?.tenantId ?? "common",
      redirectUri: row?.redirectUri || this.env.redirectUriFor(this.env.appUrl),
      webhookUrl: row?.webhookUrl || this.env.webhookUrlFor(this.env.appUrl),
      secretConfigured: !!row?.clientSecretEnc,
      // Endereços que devem ser registrados no App Registration.
      redirectUriParaRegistrar: this.env.redirectUriFor(this.env.appUrl),
      webhookUrlParaRegistrar: this.env.webhookUrlFor(this.env.appUrl),
      // Origem da config que está valendo AGORA para esta org.
      effectiveSource: effective.source, // org | platform | env | none
      effectiveConfigured: effective.isConfigured,
      vaultReady: vaultConfigured(),
    };
  }

  async saveConfig(scopeOrgId: string | null, input: SaveConfigInput, userId?: string) {
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

    const existing = await this.findRow(scopeOrgId);

    // Secret: só atualiza se veio um novo; string vazia = manter o atual.
    const secretProvided = typeof input.clientSecret === "string" && input.clientSecret.trim().length > 0;
    if (!existing && !secretProvided) {
      throw new BadRequestException("Client Secret é obrigatório na primeira configuração.");
    }

    const data: any = {
      organizationId: scopeOrgId,
      provider: PROVIDER,
      clientId,
      tenantId: (input.tenantId || "common").trim(),
      redirectUri: input.redirectUri?.trim() || null,
      webhookUrl: input.webhookUrl?.trim() || null,
      enabled: input.enabled ?? true,
      atualizadoPorId: userId || null,
    };
    if (secretProvided) data.clientSecretEnc = encryptSecret(input.clientSecret!.trim());

    let saved;
    if (existing) {
      saved = await this.prisma.calendarProviderConfig.update({ where: { id: existing.id }, data });
    } else {
      saved = await this.prisma.calendarProviderConfig.create({ data });
    }
    this.logger.log(`Config do provedor salva (scope=${scopeOrgId ? "org:" + scopeOrgId : "platform"}) por ${userId}`);
    return this.getConfig(scopeOrgId, scopeOrgId ?? undefined);
  }

  async deleteConfig(scopeOrgId: string | null) {
    const existing = await this.findRow(scopeOrgId);
    if (existing) {
      await this.prisma.calendarProviderConfig.delete({ where: { id: existing.id } });
    }
    return { removed: !!existing };
  }
}
