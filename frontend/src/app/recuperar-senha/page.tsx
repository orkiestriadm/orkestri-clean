"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/ui/logo";
import { Loader2, Mail, Check, ArrowLeft } from "lucide-react";

/**
 * Recuperação de senha.
 *
 * A apresentação acompanha o /login — mesmo fundo do planeta, mesma paleta —
 * para que sair do login e cair aqui não pareça outro produto. A lógica é a
 * mesma de sempre: 4 etapas, token pela URL, `/auth/esqueci-senha` e
 * `/auth/redefinir-senha`.
 */

type Step = "email" | "enviado" | "nova-senha" | "ok";

/** Campo e botão repetem a métrica do login: 52px de altura, raio 14. */
const INPUT =
  "h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#f97316] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#f97316]/15";

const BOTAO =
  "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#f97316] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)] transition-all hover:bg-[#ea580c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

function PasswordStrength({ senha }: { senha: string }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: senha.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(senha) },
    { label: "Letra minúscula", ok: /[a-z]/.test(senha) },
    { label: "Número", ok: /[0-9]/.test(senha) },
  ];
  if (!senha) return null;
  return (
    <ul className="mt-2.5 flex flex-col gap-1">
      {checks.map(c => (
        <li key={c.label} className="flex items-center gap-2 text-[12px]">
          <span className={c.ok ? "text-emerald-400" : "text-white/25"} aria-hidden>
            {c.ok ? "✓" : "○"}
          </span>
          <span className={c.ok ? "text-emerald-300" : "text-white/40"}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

function RecuperarSenhaContent() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se vier com ?token=xxx na URL, pula direto para o passo de nova senha
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setResetToken(token);
      setStep("nova-senha");
    }
  }, [searchParams]);

  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Informe seu e-mail."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/esqueci-senha", { email });
      setStep("enviado");
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao enviar e-mail.");
    } finally { setLoading(false); }
  };

  const isValid =
    novaSenha.length >= 8 && /[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha) && /[0-9]/.test(novaSenha);

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setError("A senha não atende aos requisitos."); return; }
    if (novaSenha !== confirmar) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/redefinir-senha", { resetToken, novaSenha });
      setStep("ok");
    } catch (err: any) {
      setError(err.response?.data?.message || "Token inválido ou expirado. Solicite um novo link.");
    } finally { setLoading(false); }
  };

  const titulo =
    step === "ok" ? "Senha redefinida"
      : step === "nova-senha" ? "Defina sua nova senha"
      : step === "enviado" ? "Verifique seu e-mail"
      : "Recuperar senha";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#08090c] px-5 py-10 text-white">
      {/* Mesma atmosfera do login: o planeta continua ao fundo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img src="/branding/planeta.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#08090c]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(8,9,12,0.85)_80%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[430px]">
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <BrandLogo size="lg" tone="light" />
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">{titulo}</h1>
        </div>

        <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-xl sm:p-8">
          {/* PASSO 1 — digitar email */}
          {step === "email" && (
            <form onSubmit={handleEnviarEmail} className="flex flex-col gap-5">
              <p className="text-[14px] leading-relaxed text-white/55">
                Informe o e-mail cadastrado na sua conta. Enviaremos um link para redefinir sua senha.
              </p>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-white/70">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={INPUT}
                  autoFocus
                />
              </div>
              {error && <Erro texto={error} />}
              <button type="submit" disabled={loading} className={BOTAO}>
                {loading ? <><Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> Enviando...</> : "Enviar link de redefinição"}
              </button>
            </form>
          )}

          {/* PASSO 2 — aguardar email */}
          {step === "enviado" && (
            <div className="flex flex-col items-center gap-4 py-1 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f97316]/12 text-[#fb923c]">
                <Mail size={28} aria-hidden />
              </span>
              <p className="text-[13.5px] leading-relaxed text-white/60">
                Se <strong className="text-white/85">{email}</strong> estiver cadastrado, você receberá um
                link para redefinir sua senha.
              </p>
              <div className="w-full rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4 text-left text-[12.5px] leading-relaxed text-white/55">
                <strong className="text-white/80">Não recebeu?</strong><br />
                Verifique a pasta de spam. O link expira em <strong className="text-white/80">30 minutos</strong>.
              </div>
              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); }}
                className="text-[13px] font-medium text-white/55 transition-colors hover:text-white"
              >
                ← Usar outro e-mail
              </button>
            </div>
          )}

          {/* PASSO 3 — nova senha (vindo do link do email) */}
          {step === "nova-senha" && (
            <form onSubmit={handleRedefinir} className="flex flex-col gap-5">
              <p className="text-[14px] leading-relaxed text-white/55">
                Crie sua nova senha. Escolha algo seguro e fácil de lembrar.
              </p>
              <div>
                <label htmlFor="nova" className="mb-1.5 block text-[13px] font-medium text-white/70">
                  Nova senha
                </label>
                <input
                  id="nova"
                  type="password"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT} tracking-widest`}
                  autoFocus
                />
                <PasswordStrength senha={novaSenha} />
              </div>
              <div>
                <label htmlFor="confirmar" className="mb-1.5 block text-[13px] font-medium text-white/70">
                  Confirmar senha
                </label>
                <input
                  id="confirmar"
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT} tracking-widest`}
                />
                {confirmar && novaSenha !== confirmar && (
                  <p className="mt-1.5 text-[12px] text-red-400">As senhas não coincidem.</p>
                )}
              </div>
              {error && <Erro texto={error} />}
              <button
                type="submit"
                disabled={loading || !isValid || novaSenha !== confirmar}
                className={BOTAO}
              >
                {loading ? <><Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> Salvando...</> : "Redefinir senha"}
              </button>
            </form>
          )}

          {/* PASSO 4 — sucesso */}
          {step === "ok" && (
            <div className="flex flex-col items-center gap-4 py-1 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check size={26} aria-hidden />
              </span>
              <p className="text-[14px] leading-relaxed text-white/60">
                Sua senha foi alterada com sucesso. Faça login com a nova senha.
              </p>
              <Link href="/login" className={`${BOTAO} mt-1`}>
                Ir para o login
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
          >
            <ArrowLeft size={14} aria-hidden /> Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <p
      role="alert"
      className="rounded-[12px] border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-center text-[13px] font-medium text-red-300"
    >
      {texto}
    </p>
  );
}

export default function RecuperarSenhaPage() {
  return (
    <Suspense>
      <RecuperarSenhaContent />
    </Suspense>
  );
}
