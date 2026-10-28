import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { MicrosoftConfig } from "./microsoft.config";
import { decryptSecret } from "../../../common/vault";

const PROVIDER = "microsoft" as const;

export interface EffectiveMicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  webhookUrl: string;
  appUrl: string;
  scopes: string[];
  authority: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  isConfigured: boolean;
  isWebhookViable: boolean;
  /** De onde a config veio: a org, a plataforma (org nula) ou o ambiente. */
  source: "org" | "platform" | "env" | "none";
}

/**
 * Resolve a configuração efetiva do provedor para UMA organização.
 *
 * Ordem: config da própria organização → padrão da plataforma (linha com
 * organizationId nulo) → variáveis de ambiente. Assim cada ambiente/instalação
 * e cada cliente externo configuram pela tela, sem editar env/compose, e o env
 * continua valendo como padrão de retaguarda (compatibilidade).
 *
 * O client secret é decifrado aqui e NUNCA sai deste processo — o frontend
 * recebe só um booleano "secret configurado".
 */
@Injectable()
export class MicrosoftConfigResolver {
  private readonly logger = new Logger(MicrosoftConfigResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: MicrosoftConfig,
  ) {}

  async resolve(organizationId?: string | null): Promise<EffectiveMicrosoftConfig> {
    let row: any = null;
    let source: EffectiveMicrosoftConfig["source"] = "none";

    // 1) Config da organização.
    if (organizationId) {
      row = await this.prisma.calendarProviderConfig
        .findUnique({ where: { organizationId_provider: { organizationId, provider: PROVIDER } } })
        .catch(() => null);
      if (row && row.enabled && row.clientId) source = "org";
      else row = null;
    }

    // 2) Padrão da plataforma (organizationId nulo).
    if (!row) {
      const platform = await this.prisma.calendarProviderConfig
        .findFirst({ where: { organizationId: null, provider: PROVIDER } })
        .catch(() => null);
      if (platform && platform.enabled && platform.clientId) {
        row = platform;
        source = "platform";
      }
    }

    // 3) Ambiente (retaguarda).
    let clientId = "";
    let clientSecret = "";
    let tenantId = "common";
    let redirectUri = "";
    let webhookUrl = "";

    if (row) {
      clientId = row.clientId || "";
      tenantId = row.tenantId || "common";
      redirectUri = row.redirectUri || this.env.redirectUriFor(this.env.appUrl);
      webhookUrl = row.webhookUrl || this.env.webhookUrlFor(this.env.appUrl);
      if (row.clientSecretEnc) {
        try { clientSecret = decryptSecret(row.clientSecretEnc); }
        catch { this.logger.warn(`client secret cifrado inválido (config ${row.id})`); }
      }
    } else if (this.env.isConfigured()) {
      source = "env";
      clientId = this.env.clientId;
      clientSecret = this.env.clientSecret;
      tenantId = this.env.tenantId;
      redirectUri = this.env.redirectUri;
      webhookUrl = this.env.webhookUrl;
    }

    const appUrl = this.env.appUrl;
    const isConfigured = !!clientId && !!clientSecret;

    return {
      clientId,
      clientSecret,
      tenantId,
      redirectUri: redirectUri || this.env.redirectUriFor(appUrl),
      webhookUrl: webhookUrl || this.env.webhookUrlFor(appUrl),
      appUrl,
      scopes: this.env.scopes,
      authority: this.env.authorityFor(tenantId),
      authorizeEndpoint: this.env.authorizeEndpointFor(tenantId),
      tokenEndpoint: this.env.tokenEndpointFor(tenantId),
      isConfigured,
      isWebhookViable: (webhookUrl || this.env.webhookUrlFor(appUrl)).startsWith("https://"),
      source: isConfigured ? source : "none",
    };
  }
}
