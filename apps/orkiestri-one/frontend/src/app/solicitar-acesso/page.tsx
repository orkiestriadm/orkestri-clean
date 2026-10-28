"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/ui/logo";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Cloud, Sparkles, Network } from "lucide-react";
import { MARCA } from "@/lib/marca";

interface Organization {
  id: string;
  nome: string;
  slug: string;
}

/* Mesmos pilares da tela de login — uma só promessa de marca. */
const PILARES = [
  { icon: ShieldCheck, label: "Segurança", text: "MFA, criptografia e auditoria" },
  { icon: Sparkles, label: "IA nativa", text: "Copilotos em toda a plataforma" },
  { icon: Cloud, label: "Cloud Native", text: "99,9% de disponibilidade" },
  { icon: Network, label: "API First", text: "Integrações sem retrabalho" },
];

export default function SolicitarAcessoPage() {
  const [form, setForm] = useState({
    nome: "", email: "", whatsapp: "", motivacao: "", organizationId: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Busca orgs e auto-seleciona a org "Default" (ambiente de trial)
  useEffect(() => {
    api.get("/auth/organizations")
      .then(r => {
        const orgs: Organization[] = r.data || [];
        const defaultOrg = orgs.find(o =>
          o.slug?.toLowerCase() === "default" || o.nome?.toLowerCase() === "default"
        ) || orgs[0];
        if (defaultOrg) {
          setForm(f => ({ ...f, organizationId: defaultOrg.id }));
        }
      })
      .catch(() => { });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) { setError("Informe seu nome e e-mail para continuar."); return; }
    if (!form.organizationId) { setError("Não foi possível carregar o ambiente. Recarregue a página e tente novamente."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/solicitar-acesso", form);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Não foi possível enviar sua solicitação. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const inputCls =
    "h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#f97316] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#f97316]/15";

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
            Uma plataforma.
            <br />
            Toda a sua{" "}
            <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
              operação
            </span>
            .
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/55">
            Chamados, projetos, frota, ativos e indicadores em um único ambiente —
            com automação e inteligência artificial nativas.
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

      {/* ── Painel do formulário ────────────────────────────────────────────── */}
      <main className="relative z-10 flex w-full items-center justify-center px-6 py-12 sm:px-10 lg:w-[560px] lg:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Link href="/">
              <BrandLogo size="lg" tone="light" />
            </Link>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-8">
            {done ? (
              <div className="flex flex-col items-center py-4 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/25">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" aria-hidden />
                </span>
                <h1 className="mt-5 text-[22px] font-bold tracking-tight text-white">
                  Solicitação enviada
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-white/55">
                  Recebemos seu pedido de acesso. Assim que for aprovado, você
                  receberá as credenciais no e-mail informado.
                </p>
                <Link
                  href="/login"
                  className="mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#f97316] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)] transition-all hover:bg-[#ea580c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
                >
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-[26px] font-bold tracking-tight text-white">
                  Solicitar acesso
                </h1>
                <p className="mt-1.5 text-[15px] text-white/50">
                  Preencha seus dados. Um administrador libera seu acesso.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="nome" className="text-[13px] font-medium text-white/70">
                      Nome completo <span className="text-[#fb923c]">*</span>
                    </label>
                    <input
                      id="nome"
                      name="nome"
                      type="text"
                      autoComplete="name"
                      autoFocus
                      value={form.nome}
                      onChange={e => set("nome", e.target.value)}
                      placeholder="Seu nome completo"
                      aria-invalid={!!error && !form.nome}
                      className={inputCls}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-[13px] font-medium text-white/70">
                      E-mail corporativo <span className="text-[#fb923c]">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={e => set("email", e.target.value)}
                      placeholder="nome@empresa.com"
                      aria-invalid={!!error && !form.email}
                      className={inputCls}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="whatsapp" className="text-[13px] font-medium text-white/70">
                      WhatsApp <span className="text-white/30">(opcional)</span>
                    </label>
                    <input
                      id="whatsapp"
                      name="whatsapp"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.whatsapp}
                      onChange={e => set("whatsapp", e.target.value)}
                      placeholder="(11) 99999-9999"
                      className={inputCls}
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-[14px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#f97316] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)] transition-all hover:bg-[#ea580c] hover:shadow-[0_12px_32px_-6px_rgba(249,115,22,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                        Enviando…
                      </>
                    ) : (
                      <>
                        Enviar solicitação
                        <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {!done && (
            <p className="mt-7 text-center text-[13px] text-white/35">
              Já tem acesso?{" "}
              <Link
                href="/login"
                className="inline-flex items-center gap-1 rounded font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Voltar ao login
              </Link>
            </p>
          )}

          <p className="mt-8 text-center text-[12px] text-white/25 lg:hidden">
            &copy; {new Date().getFullYear()} {MARCA}
          </p>
        </div>
      </main>
    </div>
  );
}
