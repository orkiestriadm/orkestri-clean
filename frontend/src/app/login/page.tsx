"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { loading, error, clearError, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mounted, setMounted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user]);
  useEffect(() => { setLocalError(""); }, [email, senha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha || localLoading) return;
    setLocalLoading(true);
    setLocalError("");
    try {
      const result = await authApi.login(email, senha);
      useAuthStore.setState({ user: result.user, token: result.accessToken, loading: false });
      router.replace(result.primeiroAcesso ? "/primeiro-acesso" : "/dashboard");
    } catch (err: any) {
      setLocalError(err?.response?.data?.message || "Credenciais inválidas. Verifique seus dados.");
      setLocalLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center lg:justify-end font-display">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none" 
        style={{ backgroundImage: "url('/branding/rodovia.jpg')" }}
      >
        <div className="absolute inset-0 bg-red-900/50 mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-8 lg:pr-32 xl:pr-40">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6 rounded-[20px] overflow-hidden p-2 bg-white/10 backdrop-blur-md border border-white/20">
            <img src="/branding/logo-ttbr-branca.png" alt="Triunfo TBR" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 text-center">
            HUB Operacional
          </h1>
          <p className="text-[15px] text-white/80 font-medium text-center">
            Faça login no seu workspace.
          </p>
        </div>

        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-4">
              <div className="group">
                <label className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-2 transition-colors uppercase tracking-widest">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-red-500 focus:bg-white dark:focus:bg-black transition-colors"
                />
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 transition-colors uppercase tracking-widest">
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-[12px] font-medium text-red-600 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-red-500 focus:bg-white dark:focus:bg-black transition-colors tracking-widest"
                />
              </div>
            </div>

            {localError && (
              <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-3 rounded-lg border border-red-500/20">
                {localError}
              </div>
            )}

            <button
              type="submit"
              disabled={localLoading || !email || !senha}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-[15px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-md"
            >
              {localLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verificando...
                </>
              ) : "Entrar no workspace"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-1">
          <p className="text-[12px] text-white/60 font-mono">Orkiestri HUB Operacional</p>
          <p className="text-[11px] text-white/40">Triunfo Transbrasiliana</p>
        </div>
      </div>
    </div>
  );
}
