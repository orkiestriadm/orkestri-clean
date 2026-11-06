import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { GoogleConfigResolver, EffectiveGoogleConfig } from "./google-config.resolver";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  expiresAt: Date;
}

interface StatePayload {
  userId: string;
  organizationId: string;
  returnTo?: string;
  nonce: string;
  exp: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly resolver: GoogleConfigResolver) {}

  private stateSecret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new ServiceUnavailableException("JWT_SECRET ausente — OAuth indisponível");
    return s;
  }

  signState(userId: string, organizationId: string, returnTo?: string): string {
    const payload: StatePayload = {
      userId,
      organizationId,
      returnTo,
      nonce: randomBytes(8).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", this.stateSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  verifyState(state: string): StatePayload {
    const parts = (state || "").split(".");
    if (parts.length !== 2) throw new BadRequestException("state inválido");
    const [body, sig] = parts;
    const expected = createHmac("sha256", this.stateSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException("assinatura do state inválida");
    }
    let payload: StatePayload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      throw new BadRequestException("state corrompido");
    }
    if (!payload.exp || payload.exp < Date.now()) {
      throw new BadRequestException("fluxo OAuth expirado — tente conectar novamente");
    }
    return payload;
  }

  async buildAuthorizeUrl(userId: string, organizationId: string, returnTo?: string): Promise<string> {
    const cfg = await this.resolver.resolve(organizationId);
    if (!cfg.isConfigured) {
      throw new ServiceUnavailableException("Integração Google Calendar não configurada. Cadastre as credenciais no painel.");
    }
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: cfg.redirectUri,
      scope: cfg.scopes.join(" "),
      state: this.signState(userId, organizationId, returnTo),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return `${cfg.authorizeEndpoint}?${params.toString()}`;
  }

  async exchangeCode(code: string, organizationId: string): Promise<OAuthTokens> {
    const cfg = await this.resolver.resolve(organizationId);
    return this.tokenRequest(cfg, {
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    });
  }

  async refresh(refreshToken: string, organizationId: string): Promise<OAuthTokens> {
    const cfg = await this.resolver.resolve(organizationId);
    return this.tokenRequest(cfg, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private async tokenRequest(cfg: EffectiveGoogleConfig, body: Record<string, string>): Promise<OAuthTokens> {
    if (!cfg.isConfigured) {
      throw new ServiceUnavailableException("Integração Google Calendar não configurada");
    }
    const params = new URLSearchParams({
      ...body,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });

    const res = await fetch(cfg.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data.error || "token_error";
      const desc = data.error_description || "falha ao obter token do Google";
      this.logger.warn(`Google token endpoint erro ${res.status}: ${err} - ${desc}`);
      if (err === "invalid_grant") {
        throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Autorização do Google expirou ou foi revogada." });
      }
      throw new BadRequestException(`Erro do Google: ${desc}`);
    }

    const expiresIn = Number(data.expires_in) || 3600;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn,
      scope: data.scope,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
}

