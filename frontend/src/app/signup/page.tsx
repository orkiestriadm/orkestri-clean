"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/logo";
import { Check, ArrowRight, ArrowLeft, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

// ─── Planos (espelho do backend) ─────────────────────────────────────────────

const PLANS = {
  business_cloud: {
    nome: "Business Cloud",
    preco: "R$ 99,90",
    color: "#a78bfa",
    maxUsers: "5 usuários operacionais + 1 admin",
    features: ["Service Desk", "Projetos e tarefas", "Agenda integrada", "Dashboards executivos", "Controle orçamentário"],
  },
  business_plus: {
    nome: "Business Plus",
    preco: "R$ 199,90",
    color: "#7c3aed",
    maxUsers: "10 usuários operacionais + 2 admins",
    features: ["Tudo do Business Cloud", "Automações avançadas", "WhatsApp integrado", "Gestão de contratos", "SLA avançado"],
  },
} as const;

type PlanKey = keyof typeof PLANS;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function PasswordInput({
  label, value, onChange, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[var(--bg-secondary)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 transition pr-10
            ${error ? "border-red-500 focus:ring-red-500/30" : "border-[var(--border-subtle)] focus:ring-violet-500/30 focus:border-violet-500"}`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── Conteúdo principal ───────────────────────────────────────────────────────

function SignupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const planFromUrl = params.get("plano") as PlanKey | null;

  const [step, setStep] = useState<1 | 2>(planFromUrl && PLANS[planFromUrl] ? 2 : 1);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(
    planFromUrl && PLANS[planFromUrl] ? planFromUrl : "business_cloud"
  );

  // Form state
  const [orgNome, setOrgNome] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSenha, setAdminSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auto-gera slug a partir do nome da org (a menos que o usuário edite manualmente)
  useEffect(() => {
    if (!slugEdited && orgNome) setOrgSlug(toSlug(orgNome));
  }, [orgNome, slugEdited]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!orgNome.trim()) errs.orgNome = "Nome da empresa é obrigatório";
    if (!orgSlug.trim() || !/^[a-z0-9-]+$/.test(orgSlug)) errs.orgSlug = "Slug inválido (use apenas letras minúsculas, números e hífens)";
    if (!adminNome.trim()) errs.adminNome = "Seu nome é obrigatório";
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) errs.adminEmail = "E-mail inválido";
    if (adminSenha.length < 8) errs.adminSenha = "A senha deve ter pelo menos 8 caracteres";
    if (adminSenha !== confirmSenha) errs.confirmSenha = "As senhas não coincidem";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano: selectedPlan,
          orgNome: orgNome.trim(),
          orgSlug: orgSlug.trim(),
          adminNome: adminNome.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          adminSenha,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erro ao iniciar cadastro. Tente novamente.");
      }

      if (data.status === "completed") {
        // MP não configurado: conta já criada em trial
        router.push(`/signup/success?token=${data.token}&direct=1`);
        return;
      }

      // Redireciona para o checkout do Mercado Pago
      if (data.checkoutUrl) {
        // Armazena token localmente para a página de sucesso
        sessionStorage.setItem("signup_token", data.token);
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Link de pagamento não disponível. Contate o suporte.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS[selectedPlan];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary, #0f0f13)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle, #1e1e2a)" }}>
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--accent-violet, #7c3aed)" }}>
            Entrar
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-4xl">

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[
              { n: 1, label: "Escolha o plano" },
              { n: 2, label: "Seus dados" },
              { n: 3, label: "Pagamento" },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= n ? "var(--accent-violet, #7c3aed)" : "var(--bg-secondary)",
                    color: step >= n ? "#fff" : "var(--text-muted)",
                    border: step >= n ? "none" : "1px solid var(--border-subtle)",
                  }}
                >
                  {step > n ? <Check size={12} strokeWidth={3} /> : n}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: step >= n ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {label}
                </span>
                {n < 3 && <div className="w-8 h-px hidden sm:block" style={{ background: "var(--border-subtle)" }} />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Escolha do plano ──────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>
                Escolha seu plano
              </h1>
              <p className="text-sm text-center mb-8" style={{ color: "var(--text-muted)" }}>
                Comece com 14 dias de trial gratuito. Cancele quando quiser.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {(Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className="text-left rounded-2xl p-6 border-2 transition-all"
                    style={{
                      background: selectedPlan === key ? `${p.color}10` : "var(--bg-card)",
                      borderColor: selectedPlan === key ? p.color : "var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>{p.nome}</div>
                        <div className="text-2xl font-extrabold mt-1" style={{ color: p.color }}>{p.preco}<span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>/mês</span></div>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 transition-all"
                        style={{ borderColor: selectedPlan === key ? p.color : "var(--border-medium)", background: selectedPlan === key ? p.color : "transparent" }}>
                        {selectedPlan === key && <Check size={10} strokeWidth={4} color="#fff" />}
                      </div>
                    </div>
                    <div className="text-xs mb-4 font-medium" style={{ color: "var(--text-muted)" }}>{p.maxUsers}</div>
                    <ul className="space-y-1.5">
                      {p.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <Check size={11} strokeWidth={3} style={{ color: p.color, flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              {/* Enterprise */}
              <div className="rounded-2xl p-5 border mb-8 flex items-center justify-between"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
                <div>
                  <div className="font-bold" style={{ color: "var(--text-primary)" }}>Enterprise</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Usuários ilimitados, SSO, ambiente dedicado, SLA corporativo</div>
                </div>
                <a
                  href="/#contato"
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-80"
                  style={{ borderColor: "#22d3ee40", color: "#22d3ee", background: "#22d3ee10" }}
                >
                  Falar com especialista
                </a>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: "var(--accent-violet, #7c3aed)" }}
              >
                Continuar com {plan.nome}
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 2: Dados da empresa e do admin ───────────────────── */}
          {step === 2 && (
            <div className="grid md:grid-cols-5 gap-8">
              {/* Formulário */}
              <div className="md:col-span-3">
                <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs mb-6 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                  <ArrowLeft size={13} /> Voltar
                </button>

                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Seus dados</h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Preencha os dados da empresa e do administrador principal.</p>

                {error && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl p-3 text-sm"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Empresa</h3>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Nome da empresa *</label>
                    <input
                      type="text"
                      value={orgNome}
                      onChange={e => setOrgNome(e.target.value)}
                      placeholder="Ex: Acme Tecnologia"
                      className={`w-full bg-[var(--bg-secondary)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 transition
                        ${fieldErrors.orgNome ? "border-red-500 focus:ring-red-500/30" : "border-[var(--border-subtle)] focus:ring-violet-500/30 focus:border-violet-500"}`}
                    />
                    {fieldErrors.orgNome && <p className="text-red-400 text-xs mt-1">{fieldErrors.orgNome}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      URL da empresa (slug) *
                      <span className="normal-case font-normal ml-1">— usado no acesso: app.orkiestri.com/<strong>{orgSlug || "sua-empresa"}</strong></span>
                    </label>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={e => { setOrgSlug(toSlug(e.target.value)); setSlugEdited(true); }}
                      placeholder="acme-tecnologia"
                      className={`w-full bg-[var(--bg-secondary)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 transition font-mono
                        ${fieldErrors.orgSlug ? "border-red-500 focus:ring-red-500/30" : "border-[var(--border-subtle)] focus:ring-violet-500/30 focus:border-violet-500"}`}
                    />
                    {fieldErrors.orgSlug && <p className="text-red-400 text-xs mt-1">{fieldErrors.orgSlug}</p>}
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-widest pt-2" style={{ color: "var(--text-muted)" }}>Administrador</h3>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Seu nome *</label>
                    <input
                      type="text"
                      value={adminNome}
                      onChange={e => setAdminNome(e.target.value)}
                      placeholder="João Silva"
                      className={`w-full bg-[var(--bg-secondary)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 transition
                        ${fieldErrors.adminNome ? "border-red-500 focus:ring-red-500/30" : "border-[var(--border-subtle)] focus:ring-violet-500/30 focus:border-violet-500"}`}
                    />
                    {fieldErrors.adminNome && <p className="text-red-400 text-xs mt-1">{fieldErrors.adminNome}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">E-mail *</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="joao@acme.com"
                      className={`w-full bg-[var(--bg-secondary)] border rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 transition
                        ${fieldErrors.adminEmail ? "border-red-500 focus:ring-red-500/30" : "border-[var(--border-subtle)] focus:ring-violet-500/30 focus:border-violet-500"}`}
                    />
                    {fieldErrors.adminEmail && <p className="text-red-400 text-xs mt-1">{fieldErrors.adminEmail}</p>}
                  </div>

                  <PasswordInput label="Senha *" value={adminSenha} onChange={setAdminSenha} placeholder="Mínimo 8 caracteres" error={fieldErrors.adminSenha} />
                  <PasswordInput label="Confirmar senha *" value={confirmSenha} onChange={setConfirmSenha} placeholder="Repita a senha" error={fieldErrors.confirmSenha} />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full mt-6 py-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent-violet, #7c3aed)" }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Processando...</>
                  ) : (
                    <>Ir para pagamento <ArrowRight size={16} /></>
                  )}
                </button>

                <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>
                  Ao continuar, você concorda com os{" "}
                  <a href="/termos" className="underline">Termos de Uso</a>{" "}e a{" "}
                  <a href="/privacidade" className="underline">Política de Privacidade</a>.
                </p>
              </div>

              {/* Resumo lateral */}
              <div className="md:col-span-2">
                <div className="sticky top-6 rounded-2xl p-6 border" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Resumo do pedido</div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{plan.nome}</span>
                    <span className="font-bold text-lg" style={{ color: plan.color }}>{plan.preco}</span>
                  </div>
                  <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>cobrado mensalmente</div>

                  <div className="border-t pt-4 space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Check size={11} strokeWidth={3} style={{ color: plan.color, flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-xl p-3 text-xs" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                    🎁 <strong>14 dias grátis</strong> — sem cobrança até o fim do trial. Cancele quando quiser.
                  </div>

                  <button
                    onClick={() => setStep(1)}
                    className="mt-4 text-xs transition-opacity hover:opacity-70 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Trocar plano
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}
