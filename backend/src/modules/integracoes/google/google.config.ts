import { Injectable, Logger } from "@nestjs/common";

/**
 * Configuração da integração Google Calendar / Google Workspace lida do ambiente.
 *
 * Segue o mesmo princípio do MicrosoftConfig: nenhum segredo possui valor padrão
 * inseguro. Se GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não estiverem no ambiente,
 * isConfigured() retorna false e a resolução pode vir do banco (config da organização)
 * ou orientar o usuário a cadastrar no modal.
 */
@Injectable()
export class GoogleConfig {
  private readonly logger = new Logger(GoogleConfig.name);

  /** Client ID do OAuth 2.0 Client no Google Cloud Console. */
  get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID || "";
  }

  /** Client secret. Nunca logado. */
  get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || "";
  }

  /** URL pública base do Orkiestri (https). */
  get appUrl(): string {
    return (process.env.GOOGLE_APP_URL || process.env.APP_URL || "http://localhost").replace(/\/+$/, "");
  }

  /** Redirect URI registrado no Google Cloud Console. */
  get redirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI || `${this.appUrl}/api/integracoes/google/callback`;
  }

  /** Endpoint público que o Google chama para Webhook / Push notifications. */
  get webhookUrl(): string {
    return process.env.GOOGLE_WEBHOOK_URL || `${this.appUrl}/api/integracoes/google/webhook`;
  }

  /**
   * Escopos delegados para leitura e escrita na agenda e identidade da conta.
   */
  get scopes(): string[] {
    return [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/calendar.events",
    ];
  }

  get authorizeEndpoint(): string {
    return "https://accounts.google.com/o/oauth2/v2/auth";
  }

  get tokenEndpoint(): string {
    return "https://oauth2.googleapis.com/token";
  }

  get calendarApiBase(): string {
    return "https://www.googleapis.com/calendar/v3";
  }

  get userinfoEndpoint(): string {
    return "https://www.googleapis.com/oauth2/v2/userinfo";
  }

  redirectUriFor(appUrl: string): string {
    return `${(appUrl || this.appUrl).replace(/\/+$/, "")}/api/integracoes/google/callback`;
  }

  webhookUrlFor(appUrl: string): string {
    return `${(appUrl || this.appUrl).replace(/\/+$/, "")}/api/integracoes/google/webhook`;
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }
}

