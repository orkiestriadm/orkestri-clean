import { create } from "zustand";
import { authApi } from "./api";

export interface User {
  id: string; nome: string; email: string;
  avatar?: string; roles: string[]; isMaster: boolean;
  isSuperAdmin?: boolean;
  modulos: string[];
  permissions: string[];
  impersonating?: boolean;
  impersonatingOrgName?: string;
  organizationId?: string;
}
interface AuthState {
  user: User | null; token: string | null;
  loading: boolean; error: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, token: null, loading: false, error: null,

  login: async (email, senha) => {
    set({ loading: true, error: null });
    try {
      const result = await authApi.login(email, senha);
      set({ user: result.user, token: result.accessToken, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || "Credenciais invalidas", loading: false });
      throw err;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    // HttpOnly cookie is cleared by the backend — no JS access needed
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));