"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, Cloud, Sparkles, Network } from "lucide-react";
import { BrandLogo } from "@/components/ui/logo";

const pilares = [
  { icon: ShieldCheck, label: "Segurança", text: "MFA, criptografia e auditoria" },
  { icon: Sparkles, label: "IA nativa", text: "Copilotos em toda a plataforma" },
  { icon: Cloud, label: "Cloud Native", text: "99,9% de disponibilidade" },
  { icon: Network, label: "API First", text: "Integrações sem retrabalho" },
];

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
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
      setLocalError(err?.response?.data?.message || "Credenciais inválidas. Confira o e-mail e a senha e tente novamente.");
      setLocalLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[#08090c] text-white">
      {/* ── Atmosfera ───────────────────────────────────────────────────────
          O último quadro da abertura em vídeo continua aqui como plano de
          fundo: quem vem de /entrar sente que a animação apenas congelou. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img
          src="/branding/planeta.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Véus: escurecem o suficiente para o formulário manter contraste AA
            sem apagar o planeta. */}
        <div className="absolute inset-0 bg-[#08090c]/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_25%,rgba(8,9,12,0.72)_85%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08090c]/70 via-transparent to-[#08090c]/80" />
      </div>

      {/* ── Painel da marca (desktop) ───────────────────────────────────────── */}
      <aside className="relative z-10 hidden flex-1 flex-col justify-between p-12 xl:p-16 lg:flex">
        <BrandLogo size="lg" tone="light" />

        <div className="max-w-lg">
          <h2 className="text-[2.6rem] font-bold leading-[1.08] tracking-[-0.035em] xl:text-[3.1rem]">
            O sistema operacional
            <br />
            da sua{" "}
            <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
              empresa
            </span>
            .
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/55">
            Gestão, automação e inteligência artificial em uma única plataforma —
            conectando pessoas, processos e informações.
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-3">
            {pilares.map((p) => {
              const Icon = p.icon;
              return (
                <li
                  key={p.label}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f97316]/15 text-[#fb923c] ring-1 ring-inset ring-[#f97316]/20">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{p.label}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/45">{p.text}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-[13px] text-white/30">
          &copy; {new Date().getFullYear()} Orkiestri — Enterprise Software Company
        </p>
      </aside>

      {/* ── Painel de acesso ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex w-full items-center justify-center px-6 py-12 sm:px-10 lg:w-[560px] lg:px-12">
        <div className="w-full max-w-[400px]">
          {/* Marca no mobile (o painel lateral fica oculto) */}
          <div className="mb-10 lg:hidden">
            <BrandLogo size="lg" tone="light" />
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-8">
            <h1 className="text-[26px] font-bold tracking-tight text-white">
              Acessar a plataforma
            </h1>
            <p className="mt-1.5 text-[15px] text-white/50">
              Entre com suas credenciais corporativas.
            </p>

            <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="email"
                  className="text-[13px] font-medium text-white/70"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  aria-invalid={!!localError}
                  className="h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#f97316] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#f97316]/15"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="senha"
                    className="text-[13px] font-medium text-white/70"
                  >
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="rounded text-[13px] font-medium text-[#fb923c] transition-colors hover:text-[#f97316] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="senha"
                    name="senha"
                    type={showSenha ? "text" : "password"}
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={!!localError}
                    className="h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 pr-12 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#f97316] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#f97316]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showSenha}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-white/40 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
                  >
                    {showSenha ? (
                      <EyeOff className="h-[18px] w-[18px]" aria-hidden />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {localError && (
                <p
                  role="alert"
                  className="rounded-[14px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300"
                >
                  {localError}
                </p>
              )}

              <button
                type="submit"
                disabled={localLoading || !email || !senha}
                className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#f97316] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)] transition-all hover:bg-[#ea580c] hover:shadow-[0_12px_32px_-6px_rgba(249,115,22,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {localLoading ? (
                  <>
                    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                    Verificando…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-7 text-center text-[13px] text-white/35">
            Ainda não tem acesso?{" "}
            <Link
              href="/solicitar-acesso"
              className="rounded font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
            >
              Solicitar acesso
            </Link>
          </p>

          <p className="mt-8 text-center text-[12px] text-white/25 lg:hidden">
            &copy; {new Date().getFullYear()} Orkiestri
          </p>
        </div>
      </main>
    </div>
  );
}
