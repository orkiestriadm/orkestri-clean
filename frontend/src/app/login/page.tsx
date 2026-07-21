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
    <div className="flex min-h-screen bg-black font-display text-white">
      {/* Lado Esquerdo - Imagem (apenas desktop) */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center pointer-events-none" 
          style={{ backgroundImage: "url('/branding/rodovia.jpg')" }}
        >
          {/* Gradiente sutil para misturar com o painel escuro da direita */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-[#09090b]" />
        </div>
      </div>

      {/* Lado Direito - Painel de Login */}
      <div className="w-full lg:w-[500px] xl:w-[560px] flex flex-col justify-center px-8 sm:px-12 bg-[#09090b] relative z-10 shadow-2xl">
        <div className="w-full max-w-[400px] mx-auto">
          
          <div className="mb-10">
            <img src="/branding/logo-ttbr-branca.png" alt="Triunfo TBR" className="h-12 w-auto mb-8 rounded" />
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              HUB Operacional
            </h1>
            <p className="text-[15px] text-zinc-400 font-medium">
              Faça login no seu workspace Triunfo.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="space-y-5">
              <div className="group">
                <label className="text-[12px] font-semibold text-zinc-500 group-focus-within:text-white block mb-2 transition-colors uppercase tracking-widest">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3.5 px-4 text-white text-[15px] focus:outline-none focus:border-red-500 focus:bg-zinc-900 transition-all placeholder:text-zinc-600 shadow-sm"
                />
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-zinc-500 group-focus-within:text-white transition-colors uppercase tracking-widest">
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-[12px] font-medium text-red-500 hover:text-red-400 transition-colors"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3.5 px-4 text-white text-[15px] focus:outline-none focus:border-red-500 focus:bg-zinc-900 transition-all placeholder:text-zinc-600 tracking-widest shadow-sm"
                />
              </div>
            </div>

            {localError && (
              <div className="text-[13px] text-red-400 font-medium text-center bg-red-950/30 py-3 px-4 rounded-lg border border-red-500/20">
                {localError}
              </div>
            )}

            <button
              type="submit"
              disabled={localLoading || !email || !senha}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_24px_rgba(220,38,38,0.4)]"
            >
              {localLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verificando...
                </>
              ) : "Entrar no sistema"}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col items-center gap-2">
            <p className="text-[12px] text-zinc-500 font-mono tracking-wider">ORKIESTRI HUB</p>
            <p className="text-[11px] text-zinc-600">&copy; {new Date().getFullYear()} Triunfo Transbrasiliana</p>
          </div>

        </div>
      </div>
    </div>
  );
}
