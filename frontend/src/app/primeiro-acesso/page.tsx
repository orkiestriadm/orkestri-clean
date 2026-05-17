"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { OrkestriLogo } from "@/components/ui/logo";

function PasswordStrength({ senha }: { senha: string }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: senha.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(senha) },
    { label: "Letra minúscula", ok: /[a-z]/.test(senha) },
    { label: "Número", ok: /[0-9]/.test(senha) },
  ];
  if (!senha) return null;
  return (
    <div className="flex flex-col gap-1 mt-2">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-2 text-[12px]">
          <span className={c.ok ? "text-green-500" : "text-zinc-400"}>
            {c.ok ? "✓" : "○"}
          </span>
          <span className={c.ok ? "text-green-600 dark:text-green-400" : "text-zinc-400 dark:text-zinc-500"}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Session validation is handled by the middleware and /auth/me call
  }, []);

  const isValid = novaSenha.length >= 8 && /[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha) && /[0-9]/.test(novaSenha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setError("A senha não atende aos requisitos."); return; }
    if (novaSenha !== confirmar) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      await api.patch("/auth/primeiro-acesso", { novaSenha });
      const user = await authApi.me();
      useAuthStore.setState({ user, loading: false });
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao definir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center font-display">
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[800px] h-[800px] bg-black/[0.02] dark:bg-white/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-8">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5 shadow-xl rounded-[30px] overflow-hidden">
            <OrkestriLogo size={48} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">
            Definir senha
          </h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400 text-center">
            Este é seu primeiro acesso. Crie uma senha segura para continuar.
          </p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                Nova senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 tracking-widest"
              />
              <PasswordStrength senha={novaSenha} />
            </div>

            <div>
              <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 tracking-widest"
              />
              {confirmar && novaSenha !== confirmar && (
                <p className="text-[12px] text-red-500 mt-1.5">As senhas não coincidem.</p>
              )}
            </div>

            {error && (
              <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isValid || novaSenha !== confirmar}
              className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1 shadow-md"
            >
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
