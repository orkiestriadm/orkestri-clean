"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";

import { OrkestriLogo } from "@/components/ui/logo";

export default function LoginPage() {
  const router = useRouter();
  const { loading, error, clearError, user, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // With HttpOnly cookies we can't read them from JS — let middleware handle redirects
  }, []);
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user]);
  useEffect(() => { if (error) clearError(); }, [email, senha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha || loading) return;
    try {
      const result = await authApi.login(email, senha);
      if (result.primeiroAcesso) {
        useAuthStore.setState({ user: result.user, token: result.accessToken, loading: false });
        router.replace("/primeiro-acesso");
      } else {
        useAuthStore.setState({ user: result.user, token: result.accessToken, loading: false });
        router.replace("/dashboard");
      }
    } catch (err: any) {
      useAuthStore.setState({
        error: err?.response?.data?.message || "Credenciais inválidas",
        loading: false,
      });
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center font-display selection:bg-black/10 dark:selection:bg-white/20">
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[800px] h-[800px] bg-black/[0.02] dark:bg-white/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-8">
        <div className="flex flex-col items-center mb-12">
          <div className="mb-6 shadow-xl rounded-[30px] overflow-hidden">
            <OrkestriLogo size={72} />
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">
            Orkiestri
          </h1>
          <p className="text-[15px] text-zinc-500 dark:text-zinc-400 font-medium text-center">
            Faça login no seu workspace.
          </p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-4">
              <div className="group">
                <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-2 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white">
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 tracking-widest"
                />
              </div>
            </div>

            {error && (
              <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verificando...
                </>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/solicitar-acesso"
            className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors underline underline-offset-4"
          >
            Solicitar criação de usuário
          </Link>
        </div>

        <div className="mt-4 text-center space-y-1">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-600 font-medium">Orkiestri System • Version 2.0.4</p>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-700">© Orkiestri — Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
