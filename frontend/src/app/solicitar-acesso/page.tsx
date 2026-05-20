"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/ui/logo";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";

interface Organization {
  id: string;
  nome: string;
}

const FEATURES = [
  { icon: Shield, label: "Segurança enterprise", desc: "Multi-tenant, JWT HttpOnly, OWASP nativo" },
  { icon: Zap, label: "Automações inteligentes", desc: "Fluxos e notificações via WhatsApp" },
  { icon: BarChart3, label: "Analytics em tempo real", desc: "KPIs, CSAT, SLA e dashboards executivos" },
];

const STATS = [
  { value: "+120", label: "empresas ativas" },
  { value: "4.9★", label: "satisfação" },
  { value: "99,9%", label: "disponibilidade" },
];

export default function SolicitarAcessoPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [form, setForm] = useState({
    nome: "", email: "", whatsapp: "", motivacao: "", organizationId: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    api.get("/auth/organizations")
      .then(r => {
        const orgs: Organization[] = r.data || [];
        setOrganizations(orgs);
        if (orgs.length === 1) setForm(f => ({ ...f, organizationId: orgs[0].id }));
      })
      .catch(() => {})
      .finally(() => setLoadingOrgs(false));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) { setError("Nome e e-mail são obrigatórios."); return; }
    if (!form.organizationId) { setError("Selecione a empresa à qual pertence."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/solicitar-acesso", form);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const selectedOrg = organizations.find(o => o.id === form.organizationId);

  if (!mounted) return null;

  return (
    <div className="bg-[var(--bg-primary)] overflow-hidden transition-colors duration-300" style={{height:'100dvh', display:'grid', gridTemplateColumns:'1fr 1fr'}}>
      
      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        {/* Primary orb */}
        <div className="absolute top-[-15%] left-[-8%] w-[800px] h-[800px] rounded-full bg-violet-600/10 dark:bg-violet-700/8 blur-[150px]" />
        {/* Cyan orb */}
        <div className="absolute bottom-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/6 blur-[130px]" />
        {/* Small accent */}
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-[80px] -translate-y-1/2" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.022]"
          style={{ backgroundImage: 'radial-gradient(circle, var(--accent-violet) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Vertical gradient separator */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[var(--border-strong)] to-transparent" />
      </div>

      {/* ── Left panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex flex-col justify-between relative z-10 p-14 xl:p-20"
      >
        <Link href="/">
          <BrandLogo size="xxl" />
        </Link>

        {/* Main statement */}
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--accent-violet)]/20 bg-[var(--accent-violet-dim)] text-[var(--accent-violet)] text-[11px] font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
              Sistema disponível · 99,9% uptime
            </div>
            <h1 className="font-display text-[44px] font-bold leading-[1.08] tracking-tight text-[var(--text-primary)] mb-5">
              Profundidade
              <br />
              <span className="bg-gradient-to-r from-violet-500 via-fuchsia-400 to-violet-500 dark:from-violet-400 dark:via-fuchsia-300 dark:to-violet-400 bg-clip-text text-transparent">
                corporativa.
              </span>
              <br />
              Experiência
              <br />
              <span className="text-[var(--text-muted)]">moderna.</span>
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-[340px]">
              Centralize CRM, projetos, chamados, financeiro e operações em uma única plataforma enterprise.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                className="flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[var(--bg-active)] group-hover:border-[var(--border-medium)] transition-all">
                  <Icon size={16} className="text-[var(--accent-violet)]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</div>
                  <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-3 text-center shadow-premium-sm"
              >
                <div className="font-display font-bold text-lg text-[var(--accent-violet)] leading-none">{stat.value}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Social proof footer */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {['G', 'T', 'R', 'M', 'A'].map((l, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-[var(--bg-primary)] bg-gradient-to-br from-violet-500/60 to-violet-700/60 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {l}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">+120 empresas confiam no Orkiestri</p>
        </div>
      </motion.div>

      {/* ── Right panel — Form ── */}
      <div className="flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <BrandLogo size="lg" />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-display text-[30px] font-bold text-[var(--text-primary)] mb-2 leading-tight tracking-tight">
              Solicitar Acesso
            </h2>
            <p className="text-[14px] text-[var(--text-secondary)]">O administrador revisará sua solicitação.</p>
          </div>

          {/* Form card */}
          <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-2xl p-8 shadow-premium-lg">
            {/* Top glow line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--accent-violet)]/40 to-transparent" />

            {done ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Solicitação enviada!</h2>
                <p className="text-[14px] text-[var(--text-secondary)] mb-2">
                  Seu pedido foi registrado para <strong className="text-[var(--text-primary)]">{selectedOrg?.nome}</strong>.
                </p>
                <p className="text-[13px] text-[var(--text-muted)] mb-8">
                  Você será notificado quando o administrador aprovar sua solicitação.
                </p>
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-primary text-white font-semibold text-[14px]"
                >
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* Seletor de empresa */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Empresa *</label>
                  {loadingOrgs ? (
                    <div className="input-o py-3.5 flex items-center gap-2 text-[var(--text-muted)]">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                      Carregando empresas...
                    </div>
                  ) : organizations.length === 0 ? (
                    <div className="input-o py-3.5 text-[var(--text-muted)] italic">
                      Nenhuma empresa disponível no momento.
                    </div>
                  ) : (
                    <select
                      value={form.organizationId}
                      onChange={e => set("organizationId", e.target.value)}
                      className={`input-o py-3.5 cursor-pointer appearance-none bg-[image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_14px_center] pr-10`}
                      required
                    >
                      <option value="">Selecione sua empresa...</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.nome}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Nome completo *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => set("nome", e.target.value)}
                    placeholder="Seu nome completo"
                    className="input-o py-3.5"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">E-mail *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set("email", e.target.value)}
                    placeholder="nome@empresa.com"
                    className="input-o py-3.5"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={e => set("whatsapp", e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="input-o py-3.5"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Motivo do acesso</label>
                  <textarea
                    value={form.motivacao}
                    onChange={e => set("motivacao", e.target.value)}
                    placeholder="Por que você precisa de acesso ao sistema?"
                    rows={2}
                    className="input-o py-3.5 resize-none"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="text-[13px] text-[var(--accent-red)] bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || loadingOrgs || organizations.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl btn-primary text-white font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verificando...
                    </>
                  ) : (
                    <>Enviar solicitação <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              ← Voltar ao login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
