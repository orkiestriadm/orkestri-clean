"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/ui/logo";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, ShieldCheck, Cloud, Sparkles, Network } from "lucide-react";
import { MARCA } from "@/lib/marca";

/**
 * Cadastro que começa aqui e termina no WhatsApp.
 *
 * Esta tela pede só o necessário para abrir a conversa — nome, CPF e WhatsApp.
 * O resto (e-mail e empresa) a Aurélia pergunta por lá, uma coisa por vez, e a
 * conta só passa a existir quando a pessoa confirma no chat.
 *
 * Por que tão pouco campo: cada campo a mais aqui é uma chance a mais de a
 * pessoa desistir antes de chegar ao WhatsApp, que é onde o cadastro de fato
 * acontece. E o CPF fica aqui, e não lá, porque é o que distingue uma pessoa
 * de um cadastro de brincadeira antes de gastarmos uma mensagem com ele.
 */

const PILARES = [
  { icon: ShieldCheck, label: "Segurança", text: "MFA, criptografia e auditoria" },
  { icon: Sparkles, label: "IA nativa", text: "Copilotos em toda a plataforma" },
  { icon: Cloud, label: "Cloud Native", text: "99,9% de disponibilidade" },
  { icon: Network, label: "API First", text: "Integrações sem retrabalho" },
];

/** Máscara de CPF conforme se digita: 000.000.000-00. */
function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara de celular: (11) 99999-9999. */
function mascaraFone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Dígitos verificadores do CPF, conferidos aqui também.
 *
 * O servidor valida de novo — esta cópia existe só para a pessoa descobrir o
 * erro de digitação na hora, em vez de esperar a ida e a volta.
 */
function cpfValido(bruto: string): boolean {
  const cpf = bruto.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const corte of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(cpf[i]) * (corte + 1 - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(cpf[corte])) return false;
  }
  return true;
}

export default function CadastroPage() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 3) { setError("Escreva seu nome completo."); return; }
    if (!cpfValido(cpf)) { setError("Esse CPF não parece válido. Confira os números."); return; }
    if (whatsapp.replace(/\D/g, "").length < 10) { setError("Informe o WhatsApp com DDD."); return; }

    setLoading(true); setError("");
    try {
      await api.post("/cadastro-whatsapp/iniciar", {
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ""),
        whatsapp: whatsapp.replace(/\D/g, ""),
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Não consegui enviar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[#08090c] text-white">
      {/* ── Atmosfera: glow quente + malha sutil (igual ao login) ───────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[560px] w-[720px] rounded-full bg-[#f97316]/[0.16] blur-[130px]" />
        <div className="absolute -bottom-52 left-1/3 h-[460px] w-[620px] rounded-full bg-[#fb923c]/[0.10] blur-[130px]" />
        <div className="absolute right-0 top-1/4 h-[380px] w-[420px] rounded-full bg-[#ea580c]/[0.08] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 50% 0%, #000 35%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, #000 35%, transparent 78%)",
          }}
        />
      </div>

      {/* ── Painel da marca (desktop) ───────────────────────────────────────── */}
      <aside className="relative z-10 hidden flex-1 flex-col justify-between p-12 xl:p-16 lg:flex">
        <Link href="/" className="w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f97316]">
          <BrandLogo size="lg" tone="light" />
        </Link>

        <div className="max-w-lg">
          <h2 className="text-[2.6rem] font-bold leading-[1.08] tracking-[-0.035em] xl:text-[3.1rem]">
            Seu cadastro
            <br />
            termina no{" "}
            <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
              WhatsApp
            </span>
            .
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/55">
            Preencha três campos aqui e a Aurélia continua com você por lá.
            Em menos de um minuto sua conta está pronta.
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-3">
            {PILARES.map(({ icon: Icon, label, text }) => (
              <li
                key={label}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#f97316]/15 text-[#fb923c] ring-1 ring-inset ring-[#f97316]/20">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-white/45">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-white/30">
          &copy; {new Date().getFullYear()} {MARCA} — Enterprise Software Company
        </p>
      </aside>

      {/* ── Formulário ──────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex w-full items-center justify-center p-6 lg:w-[560px] lg:p-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Link href="/"><BrandLogo size="md" tone="light" /></Link>
          </div>

          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-7 backdrop-blur-xl sm:p-8">
            {done ? (
              <div className="py-4 text-center">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/15 text-[#4ade80] ring-1 ring-inset ring-[#22c55e]/25">
                  <CheckCircle2 className="h-7 w-7" aria-hidden />
                </span>
                <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Olha o WhatsApp!</h1>
                <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                  Mandei uma mensagem para <strong className="text-white/80">{mascaraFone(whatsapp)}</strong>.
                  É só responder por lá para terminar — leva menos de um minuto.
                </p>
                <p className="mt-5 text-[13px] text-white/35">
                  Não chegou? Confira se o número está certo e tente de novo daqui a pouco.
                </p>
                <Link
                  href="/login"
                  className="mt-7 inline-flex items-center gap-2 text-[14px] font-medium text-[#fb923c] hover:text-[#f97316]"
                >
                  Já tenho conta <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#22c55e]/15 text-[#4ade80] ring-1 ring-inset ring-[#22c55e]/25">
                  <MessageCircle className="h-5 w-5" aria-hidden />
                </span>
                <h1 className="mt-4 text-[24px] font-semibold tracking-tight">Criar minha conta</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-white/50">
                  Três campos e o resto a gente resolve no seu WhatsApp.
                </p>

                <form onSubmit={enviar} className="mt-7 space-y-4" noValidate>
                  <div>
                    <label htmlFor="nome" className="mb-1.5 block text-[13px] font-medium text-white/70">
                      Nome completo
                    </label>
                    <input
                      id="nome" value={nome} onChange={e => setNome(e.target.value)}
                      autoComplete="name" autoFocus
                      className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#f97316]/60 focus:bg-white/[0.06]"
                      placeholder="Maria Souza"
                    />
                  </div>

                  <div>
                    <label htmlFor="cpf" className="mb-1.5 block text-[13px] font-medium text-white/70">
                      CPF
                    </label>
                    <input
                      id="cpf" value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))}
                      inputMode="numeric" autoComplete="off"
                      className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 font-mono text-[15px] tracking-wide text-white outline-none transition placeholder:text-white/25 focus:border-[#f97316]/60 focus:bg-white/[0.06]"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label htmlFor="whatsapp" className="mb-1.5 block text-[13px] font-medium text-white/70">
                      WhatsApp
                    </label>
                    <input
                      id="whatsapp" value={whatsapp} onChange={e => setWhatsapp(mascaraFone(e.target.value))}
                      inputMode="tel" autoComplete="tel"
                      className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#f97316]/60 focus:bg-white/[0.06]"
                      placeholder="(11) 99999-9999"
                    />
                    <p className="mt-1.5 text-[12px] text-white/35">
                      É para este número que a Aurélia vai escrever.
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/10 px-3 py-2 text-[13px] text-[#fca5a5]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit" disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] px-4 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <>Continuar no WhatsApp <ArrowRight className="h-[18px] w-[18px]" aria-hidden /></>}
                  </button>
                </form>

                <p className="mt-6 text-center text-[13px] text-white/40">
                  Já tem conta?{" "}
                  <Link href="/login" className="font-medium text-[#fb923c] hover:text-[#f97316]">
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
