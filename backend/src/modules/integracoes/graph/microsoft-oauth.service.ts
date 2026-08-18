import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { MicrosoftConfig } from "./microsoft.config";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // segundos
  scope?: string;
  expiresAt: Date;
}

interface StatePayload {
  userId: string;
  organizationId: string;
  nonce: string;
  exp: number; // epoch ms
}

/**
 * OAuth 2.0 Authorization Code Flow contra o Microsoft Entra ID.
 *
 * O `state` é assinado (HMAC-SHA256 com JWT_SECRET) e carrega o usuário que
 * iniciou o fluxo + expiração de 10 min. O callback é uma rota pública (a
 * Microsoft redireciona o navegador para lá, sem o CSRF double-submit do app),
 * então o `state` assinado é o que impede um terceiro de plantar um callback:
 * sem a chave, ninguém forja um state válido, e a conexão só se vincula ao
 * usuário embutido no state — nunca a um id vindo solto na querystring.
 */
@Injectable()
export class MicrosoftOAuthService {
  private readonly logger = new Logger(MicrosoftOAuthService.name);

  constructor(private readonly config: MicrosoftConfig) {}

  private stateSecret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new ServiceUnavailableException("JWT_SECRET ausente — OAuth indisponível");
    return s;
  }

  /** Cria um state assinado ligado ao usuário iniciador. */
  signState(userId: string, organizationId: string): string {
    const payload: StatePayload = {
      userId,
      organizationId,
      nonce: randomBytes(8).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", this.stateSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  /** Verifica e decodifica o state. Lança se adulterado ou expirado. */
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
    if (!payload.exp || payload.exp < Date.now()) throw new BadRequestException("fluxo OAuth expirado — tente conectar novamente");
    return payload;
  }

  /** Monta a URL de autorização para redirecionar o navegador do usuário. */
  buildAuthorizeUrl(userId: string, organizationId: string): string {
    if (!this.config.isConfigured()) {
      throw new ServiceUnavailableException("Integração Microsoft não configurada (MS_CLIENT_ID/MS_CLIENT_SECRET ausentes)");
    }
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      response_mode: "query",
      scope: this.config.scopes.join(" "),
      state: this.signState(userId, organizationId),
      // Garante refresh token e revê o consentimento a cada nova conexão.
      prompt: "select_account",
    });
    return `${this.config.authorizeEndpoint}?${params.toString()}`;
  }

  /** Troca o authorization code por tokens. */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    return this.tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
    });
  }

  /** Renova o access token a partir do refresh token. */
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    return this.tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: this.config.scopes.join(" "),
    });
  }

  private async tokenRequest(extra: Record<string, string>): Promise<OAuthTokens> {
    if (!this.config.isConfigured()) {
      throw new ServiceUnavailableException("Integração Microsoft não configurada");
    }
    const form = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...extra,
    });

    const res = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Loga o CÓDIGO do erro, nunca o corpo com tokens/secret.
      const err = data?.error || "erro_desconhecido";
      const desc = String(data?.error_description || "").split("\n")[0].slice(0, 200);
      this.logger.warn(`Token endpoint respondeu ${res.status} (${err})`);
      // Refresh token revogado/expirado → sinaliza reautenticação.
      if (err === "invalid_grant") {
        throw new BadRequestException({ code: "REAUTH_REQUIRED", message: "Autorização Microsoft expirada ou revogada. Reconecte a conta." });
      }
      throw new BadRequestException({ code: "MS_TOKEN_ERROR", message: `Falha ao obter token Microsoft (${err}): ${desc}` });
    }

    const expiresIn = Number(data.expires_in || 3600);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // pode não vir em refresh — o chamador preserva o anterior
      expiresIn,
      scope: data.scope,
      expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000), // 60s de folga
    };
  }
}
