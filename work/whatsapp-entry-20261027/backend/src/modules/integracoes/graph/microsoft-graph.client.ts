import { Injectable, Logger, UnauthorizedException, BadGatewayException } from "@nestjs/common";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path?: string;    // caminho relativo a GRAPH_BASE (ex: /me/events)
  url?: string;     // URL absoluta (ex: nextLink / deltaLink já vem completo)
  body?: any;
  headers?: Record<string, string>;
  /** Preferência de timezone para respostas de calendário. */
  timezone?: string;
}

export class GraphAuthError extends Error {}      // 401 — token inválido, força reautenticação
export class GraphForbiddenError extends Error {} // 403 — permissão insuficiente

/**
 * Cliente HTTP de baixo nível para o Microsoft Graph.
 *
 * Sem estado: recebe o access token pronto (quem garante validade/refresh é o
 * CalendarConnectionService). Cuida do que é transporte: JSON, cabeçalhos,
 * retry com backoff em 429/503 respeitando Retry-After, e a tradução de 401/403
 * em erros tipados para a camada de sync decidir (reautenticar vs. registrar).
 *
 * NUNCA loga corpo de requisição/resposta (contém dados de reunião e, no
 * cabeçalho, o token). Só método, caminho e status.
 */
@Injectable()
export class MicrosoftGraphClient {
  private readonly logger = new Logger(MicrosoftGraphClient.name);
  private readonly MAX_RETRIES = 3;

  async request<T = any>(accessToken: string, opts: GraphRequestOptions): Promise<T> {
    const url = opts.url || `${GRAPH_BASE}${opts.path}`;
    const method = opts.method || "GET";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(opts.headers || {}),
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.timezone) headers["Prefer"] = `outlook.timezone="${opts.timezone}"`;

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt++;
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (e: any) {
        // Falha de rede — tenta de novo com backoff, depois desiste como 502.
        if (attempt <= this.MAX_RETRIES) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        throw new BadGatewayException(`Falha de rede ao chamar o Microsoft Graph: ${e?.code || e?.message || "erro"}`);
      }

      if (res.status === 401) {
        throw new GraphAuthError("Graph retornou 401 (token inválido)");
      }
      if (res.status === 403) {
        throw new GraphForbiddenError("Graph retornou 403 (permissão insuficiente)");
      }
      // Throttling / indisponibilidade temporária → backoff e retry.
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt <= this.MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 0;
        const wait = retryAfter > 0 ? retryAfter * 1000 : this.backoffMs(attempt);
        this.logger.warn(`Graph ${res.status} em ${method} ${this.safePath(url)} — retry ${attempt}/${this.MAX_RETRIES} em ${wait}ms`);
        await this.sleep(wait);
        continue;
      }

      if (res.status === 204) return undefined as unknown as T;

      const text = await res.text();
      const data = text ? this.tryJson(text) : undefined;

      if (!res.ok) {
        const code = data?.error?.code || `HTTP_${res.status}`;
        this.logger.warn(`Graph ${res.status} (${code}) em ${method} ${this.safePath(url)}`);
        throw new BadGatewayException(`Microsoft Graph respondeu ${res.status} (${code})`);
      }

      return data as T;
    }
  }

  // ── Operações de alto nível ────────────────────────────────────────────────

  /** Identidade da conta conectada. */
  getMe(accessToken: string) {
    return this.request<any>(accessToken, { path: "/me?$select=id,mail,userPrincipalName,displayName" });
  }

  /** Calendário principal do usuário. */
  getPrimaryCalendar(accessToken: string) {
    return this.request<any>(accessToken, { path: "/me/calendar?$select=id,name" });
  }

  /**
   * Primeira página do delta do calendário. Se `deltaLink` vier, retoma de onde
   * parou (incremental); senão inicia um delta novo restrito à janela de datas.
   */
  calendarViewDelta(accessToken: string, opts: { deltaLink?: string; startIso?: string; endIso?: string; timezone?: string }) {
    if (opts.deltaLink) {
      return this.request<any>(accessToken, { url: opts.deltaLink, timezone: opts.timezone });
    }
    const params = new URLSearchParams();
    if (opts.startIso) params.set("startDateTime", opts.startIso);
    if (opts.endIso) params.set("endDateTime", opts.endIso);
    return this.request<any>(accessToken, {
      path: `/me/calendarView/delta?${params.toString()}`,
      timezone: opts.timezone,
      headers: { Prefer: `odata.maxpagesize=50${opts.timezone ? `,outlook.timezone="${opts.timezone}"` : ""}` },
    });
  }

  /** Segue nextLink/deltaLink de paginação. */
  followLink(accessToken: string, link: string, timezone?: string) {
    return this.request<any>(accessToken, { url: link, timezone });
  }

  createEvent(accessToken: string, body: any) {
    return this.request<any>(accessToken, { method: "POST", path: "/me/events", body });
  }

  updateEvent(accessToken: string, externalId: string, body: any) {
    return this.request<any>(accessToken, { method: "PATCH", path: `/me/events/${encodeURIComponent(externalId)}`, body });
  }

  deleteEvent(accessToken: string, externalId: string) {
    return this.request<void>(accessToken, { method: "DELETE", path: `/me/events/${encodeURIComponent(externalId)}` });
  }

  getEvent(accessToken: string, externalId: string, timezone?: string) {
    return this.request<any>(accessToken, { path: `/me/events/${encodeURIComponent(externalId)}`, timezone });
  }

  // ── Subscriptions (webhooks) ───────────────────────────────────────────────

  createSubscription(accessToken: string, body: any) {
    return this.request<any>(accessToken, { method: "POST", path: "/subscriptions", body });
  }

  renewSubscription(accessToken: string, subscriptionId: string, expirationIso: string) {
    return this.request<any>(accessToken, {
      method: "PATCH",
      path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
      body: { expirationDateTime: expirationIso },
    });
  }

  deleteSubscription(accessToken: string, subscriptionId: string) {
    return this.request<void>(accessToken, { method: "DELETE", path: `/subscriptions/${encodeURIComponent(subscriptionId)}` });
  }

  // ── Utilitários ────────────────────────────────────────────────────────────

  private backoffMs(attempt: number): number {
    // 0.5s, 1s, 2s (+ jitter determinístico por tentativa)
    return Math.min(2000, 500 * 2 ** (attempt - 1)) + attempt * 50;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private tryJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  /** Remove querystring do log (nextLink/deltaLink carregam tokens de página). */
  private safePath(url: string): string {
    const i = url.indexOf("?");
    return i >= 0 ? url.slice(0, i) : url;
  }
}
