import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GoogleConfig } from "./google.config";
import { decryptSecret } from "../../../common/vault";

const PROVIDER = "google" as const;

export interface EffectiveGoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookUrl: string;
  appUrl: string;
  scopes: string[];
  authorizeEndpoint: string;
  tokenEndpoint: string;
  isConfigured: boolean;
  isWebhookViable: boolean;
  source: "org" | "platform" | "env" | "none";
}

@Injectable()
export class GoogleConfigResolver {
  private readonly logger = new Logger(GoogleConfigResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: GoogleConfig,
  ) {}

  async resolve(organizationId?: string | null): Promise<EffectiveGoogleConfig> {
    let row: any = null;
    let source: EffectiveGoogleConfig["source"] = "none";

    // 1) Configuração da própria organização (bring-your-own-credentials).
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

    // 3) Ambiente (retaguarda via .env).
    let clientId = "";
    let clientSecret = "";
    let redirectUri = "";
    let webhookUrl = "";

    if (row) {
      clientId = row.clientId || "";
      redirectUri = row.redirectUri || this.env.redirectUriFor(this.env.appUrl);
      webhookUrl = row.webhookUrl || this.env.webhookUrlFor(this.env.appUrl);
      if (row.clientSecretEnc) {
        try {
          clientSecret = decryptSecret(row.clientSecretEnc);
        } catch {
          this.logger.warn(`Client secret cifrado inválido do Google (config ${row.id})`);
        }
      }
    } else if (this.env.isConfigured()) {
      source = "env";
      clientId = this.env.clientId;
      clientSecret = this.env.clientSecret;
      redirectUri = this.env.redirectUri;
      webhookUrl = this.env.webhookUrl;
    }

    const appUrl = this.env.appUrl;
    const isConfigured = !!clientId && !!clientSecret;

    return {
      clientId,
      clientSecret,
      redirectUri,
      webhookUrl,
      appUrl,
      scopes: this.env.scopes,
      authorizeEndpoint: this.env.authorizeEndpoint,
      tokenEndpoint: this.env.tokenEndpoint,
      isConfigured,
      isWebhookViable: isConfigured && /^https:\/\//.test(webhookUrl),
      source,
    };
  }
}

