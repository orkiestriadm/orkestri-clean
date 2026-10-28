import axios, { AxiosError } from "axios";
import { useToastStore } from "./toast";
import { createSessionRedirect } from "./session-redirect";

const redirectExpiredSession = createSessionRedirect(
  signal => fetch("/api/auth/clear", { method: "POST", credentials: "include", signal }),
  () => window.location.replace("/login"),
);

/**
 * Opção `silent` — para chamadas de segundo plano.
 *
 * Listas de apoio (combos de veículo, motorista, setor, usuário) são carregadas
 * sem o usuário pedir. Quando uma delas falha — normalmente 403, porque o perfil
 * não tem permissão naquele cadastro — a tela continua utilizável, só o combo
 * fica vazio. Um alerta vermelho ali é ruído: culpa o usuário por algo que ele
 * não fez e não pode resolver.
 *
 * `silent` suprime apenas o AVISO VISUAL. Nunca suprime efeito colateral:
 * expiração de sessão e assinatura suspensa continuam redirecionando, porque são
 * eventos de sessão e não "esta chamada falhou".
 *
 * Uso — no nível da configuração, NÃO em `params`:
 *     api.get("/users/picklist", { silent: true })            // ✓
 *     api.get("/users/picklist", { params: { silent: true } }) // ✗ vira ?silent=true
 */
declare module "axios" {
  export interface AxiosRequestConfig {
    silent?: boolean;
  }
}

const BASE = typeof window !== "undefined"
  ? window.location.origin + "/api"
  : "http://localhost/api";

// withCredentials: true ensures HttpOnly cookies are sent automatically
// timeout 30s: evita falsos "sem conexao" em janelas de contencao (ex: backup do
// Postgres) ou endpoints externos mais lentos (OSA/Zabbix). Antes era 10s.
export const api = axios.create({ baseURL: BASE, withCredentials: true, timeout: 30000 });

// ── Request interceptor: CSRF Double Submit Cookie ──
api.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const csrf = document.cookie.split("; ").find(c => c.startsWith("csrf_token="))?.split("=")[1];
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
});

// ── Response interceptor: error handling global ──
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ message?: string }>) => {
    if (typeof window === "undefined") return Promise.reject(err);

    const status = err.response?.status;
    const message = err.response?.data?.message;

    // Lê a opção da configuração da requisição. A versão anterior testava
    // `config.url.includes("silent=true")` — que nunca casava, porque o axios
    // mantém os params em `config.params` e não os concatena em `config.url`.
    const silent = err.config?.silent === true;

    /** Aviso visual, exceto em chamada silenciosa. Silenciado não é invisível:
     *  em desenvolvimento a falha vai para o console. */
    const avisar = (
      tipo: "error" | "warning",
      titulo: string,
      texto: string,
    ) => {
      if (silent) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[api:silent] ${status ?? "sem resposta"} ${err.config?.method?.toUpperCase() ?? ""} ${err.config?.url ?? ""} — ${titulo}: ${texto}`,
          );
        }
        return;
      }
      useToastStore.getState()[tipo](titulo, texto);
    };

    // 401 — billing suspenso (hard block)
    if (status === 401) {
      const errData = err.response?.data as { code?: string; checkoutUrl?: string; message?: string } | undefined;
      if (errData?.code === 'BILLING_SUSPENDED') {
        const checkout = errData.checkoutUrl ? encodeURIComponent(errData.checkoutUrl) : '';
        const msg = encodeURIComponent(errData.message || 'Assinatura suspensa');
        if (!window.location.pathname.startsWith('/suspended')) {
          window.location.href = `/suspended?reason=${msg}${checkout ? `&checkout=${checkout}` : ''}`;
        }
        return Promise.reject(err);
      }
    }

    // 401 — sessão expirada
    if (status === 401) {
      if (!window.location.pathname.includes("/login")) {
        useToastStore.getState().warning("Sessao expirada", "Faca login novamente.");
        // Clear the cookie server-side so middleware won't loop back to /dashboard
        redirectExpiredSession();
      }
      return Promise.reject(err);
    }

    // 403 — primeiro acesso (senha temporária)
    if (status === 403) {
      const errData = err.response?.data as { code?: string } | undefined;
      if (errData?.code === "PRIMEIRO_ACESSO") {
        if (!window.location.pathname.includes("/primeiro-acesso")) {
          window.location.href = "/primeiro-acesso";
        }
        return Promise.reject(err);
      }
      avisar("error", "Sem permissao", message || "Voce nao tem acesso a este recurso.");
      return Promise.reject(err);
    }

    // 429 — rate limit
    if (status === 429) {
      avisar("warning", "Muitas tentativas", message || "Aguarde antes de tentar novamente.");
      return Promise.reject(err);
    }

    // 409 — conflito (ex: email duplicado)
    if (status === 409) {
      avisar("error", "Conflito", message || "O recurso ja existe.");
      return Promise.reject(err);
    }

    // 500+ — erro do servidor
    if (status && status >= 500) {
      avisar("error", "Erro no servidor", "Tente novamente em alguns instantes.");
      return Promise.reject(err);
    }

    // Erro de rede (sem resposta do servidor)
    if (!err.response) {
      if (axios.isCancel(err)) return Promise.reject(err);
      avisar("error", "Não foi possível carregar", err.code === "ECONNABORTED"
        ? "O servidor demorou para responder. Tente novamente."
        : "Não conseguimos falar com o servidor. Tente novamente em instantes.");
      return Promise.reject(err);
    }

    return Promise.reject(err);
  }
);

// ── Auth API ──
export const authApi = {
  login: async (email: string, senha: string) => {
    // Backend sets HttpOnly cookie — no manual cookie management needed
    const { data } = await api.post("/auth/login", { email, senha });
    // No primeiro acesso o servidor NÃO devolve sessão: devolve
    // `precisaTrocarSenha` e manda um código para o e-mail cadastrado. Quem
    // chama precisa olhar esse campo antes de usar `user`/`accessToken`, que
    // vêm indefinidos nesse caso.
    return {
      accessToken: data.accessToken,
      user: data.user,
      primeiroAcesso: data.primeiroAcesso,
      precisaTrocarSenha: data.precisaTrocarSenha === true,
      mensagem: data.mensagem as string | undefined,
    };
  },

  /** Primeiro acesso: confere o código do e-mail, troca a senha e abre sessão. */
  confirmarPrimeiroAcesso: async (email: string, senhaProvisoria: string, codigo: string, novaSenha: string) => {
    const { data } = await api.post("/auth/primeiro-acesso/confirmar", { email, senhaProvisoria, codigo, novaSenha });
    return { accessToken: data.accessToken, user: data.user };
  },

  reenviarCodigoPrimeiroAcesso: async (email: string, senhaProvisoria: string) => {
    const { data } = await api.post("/auth/primeiro-acesso/reenviar", { email, senhaProvisoria });
    return data as { ok: boolean; mensagem: string };
  },

  me: async (options: { timeout?: number; silent?: boolean; signal?: AbortSignal } = {}) => {
    // Cookie is sent automatically via withCredentials
    const { data } = await api.get("/auth/me", options);
    return data;
  },

  logout: async () => {
    try { await api.post("/auth/logout"); } catch {}
    // Backend clears the HttpOnly cookie; nothing to clean up client-side
  },
};
