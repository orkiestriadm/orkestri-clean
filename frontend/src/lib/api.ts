import axios, { AxiosError } from "axios";
import { useToastStore } from "./toast";

const BASE = typeof window !== "undefined"
  ? window.location.origin + "/api"
  : "http://localhost/api";

// withCredentials: true ensures HttpOnly cookies are sent automatically
export const api = axios.create({ baseURL: BASE, withCredentials: true, timeout: 10000 });

// ── Response interceptor: error handling global ──
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ message?: string }>) => {
    if (typeof window === "undefined") return Promise.reject(err);

    const status = err.response?.status;
    const message = err.response?.data?.message;

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
        fetch("/api/auth/clear", { method: "POST", credentials: "include" }).finally(() => {
          window.location.href = "/login";
        });
      }
      return Promise.reject(err);
    }

    // 403 — sem permissão
    if (status === 403) {
      useToastStore.getState().error("Sem permissao", message || "Voce nao tem acesso a este recurso.");
      return Promise.reject(err);
    }

    // 429 — rate limit
    if (status === 429) {
      useToastStore.getState().warning("Muitas tentativas", message || "Aguarde antes de tentar novamente.");
      return Promise.reject(err);
    }

    // 409 — conflito (ex: email duplicado)
    if (status === 409) {
      useToastStore.getState().error("Conflito", message || "O recurso ja existe.");
      return Promise.reject(err);
    }

    // 500+ — erro do servidor
    if (status && status >= 500) {
      useToastStore.getState().error("Erro no servidor", "Tente novamente em alguns instantes.");
      return Promise.reject(err);
    }

    // Erro de rede (sem resposta do servidor)
    if (!err.response) {
      useToastStore.getState().error("Sem conexao", "Verifique sua conexao com a internet.");
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
    return { accessToken: data.accessToken, user: data.user, primeiroAcesso: data.primeiroAcesso };
  },

  me: async () => {
    // Cookie is sent automatically via withCredentials
    const { data } = await api.get("/auth/me");
    return data;
  },

  logout: async () => {
    try { await api.post("/auth/logout"); } catch {}
    // Backend clears the HttpOnly cookie; nothing to clean up client-side
  },
};
