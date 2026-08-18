import { Injectable, Logger } from "@nestjs/common";

/**
 * Configuração da integração Microsoft 365, lida do ambiente.
 *
 * Nenhum segredo tem valor padrão: se `MS_CLIENT_ID`/`MS_CLIENT_SECRET` não
 * estiverem no ambiente, `isConfigured()` retorna false e o resto do módulo
 * responde 503/"não configurado" em vez de estourar. Isso permite que o código
 * exista em produção ANTES de o App Registration ser criado no Entra.
 *
 * Ver docs/integracoes/MICROSOFT_365_SETUP.md.
 */
@Injectable()
export class MicrosoftConfig {
  private readonly logger = new Logger(MicrosoftConfig.name);

  /** Application (client) ID do App Registration. */
  get clientId(): string {
    return process.env.MS_CLIENT_ID || "";
  }

  /** Client secret (Value). Nunca logado. */
  get clientSecret(): string {
    return process.env.MS_CLIENT_SECRET || "";
  }

  /** Directory (tenant) ID, ou "common"/"organizations" para multitenant. */
  get tenantId(): string {
    return process.env.MS_TENANT_ID || "common";
  }

  /**
   * URL pública base do Orkiestri (https). Usada para montar o redirect_uri do
   * OAuth e o notificationUrl do webhook do Graph. Cai para APP_URL.
   */
  get appUrl(): string {
    return (process.env.MS_APP_URL || process.env.APP_URL || "http://localhost").replace(/\/+$/, "");
  }

  /** Redirect URI registrado no Entra. Precisa bater EXATAMENTE. */
  get redirectUri(): string {
    return process.env.MS_REDIRECT_URI || `${this.appUrl}/api/integracoes/microsoft/callback`;
  }

  /** Endpoint público que o Graph chama nas notificações de mudança. */
  get webhookUrl(): string {
    return process.env.MS_WEBHOOK_URL || `${this.appUrl}/api/integracoes/microsoft/webhook`;
  }

  /**
   * Escopos delegados (menor privilégio para o cenário principal).
   * offline_access → refresh token; Calendars.ReadWrite → ler e escrever eventos;
   * User.Read/openid/email/profile → descobrir a identidade da conta conectada.
   */
  get scopes(): string[] {
    return [
      "openid",
      "profile",
      "email",
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
    ];
  }

  get authority(): string {
    return `https://login.microsoftonline.com/${this.tenantId}`;
  }

  get authorizeEndpoint(): string {
    return `${this.authority}/oauth2/v2.0/authorize`;
  }

  get tokenEndpoint(): string {
    return `${this.authority}/oauth2/v2.0/token`;
  }

  /** true quando há client id + secret configurados. */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Webhook só é viável com URL pública HTTPS (o Graph recusa http e localhost).
   * Sem isso, caímos para delta sync + reconciliação periódica (ainda robusto).
   */
  isWebhookViable(): boolean {
    return this.webhookUrl.startsWith("https://");
  }
}
