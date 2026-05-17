import axios, { AxiosError } from "axios";
import { useToastStore } from "./toast";

const BASE = typeof window !== "undefined"
  ? window.location.origin + "/api"
  : "http://localhost/api";

export const api = axios.create({ baseURL: BASE });

// ── Request interceptor: injeta token ──
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("orkestri_token="))
      ?.split("=")[1];
    if (token) config.headers.Authorization = `Bearer ${token}`;
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

    // 401 — sessão expirada
    if (status === 401) {
      document.cookie = "orkestri_token=; max-age=0; path=/";
      // Só redireciona se não estiver na página de login
      if (!window.location.pathname.includes("/login")) {
        useToastStore.getState().warning("Sessao expirada", "Faca login novamente.");
        setTimeout(() => { window.location.href = "/login"; }, 1500);
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
    const { data } = await api.post("/auth/login", { email, senha });
    if (data.accessToken) {
      document.cookie = `orkestri_token=${data.accessToken}; max-age=28800; path=/; SameSite=Strict`;
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
    }
    return { accessToken: data.accessToken, user: data.user, primeiroAcesso: data.primeiroAcesso };
  },

  me: async () => {
    const token = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("orkestri_token="))
      ?.split("=")[1];
    if (!token) throw new Error("No token");
    const { data } = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  logout: async () => {
    try { await api.post("/auth/logout"); } catch {}
    document.cookie = "orkestri_token=; max-age=0; path=/";
    delete api.defaults.headers.common.Authorization;
  },
};