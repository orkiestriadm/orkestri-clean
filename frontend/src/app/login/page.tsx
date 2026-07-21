"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Shield, Zap, BarChart3, Eye, EyeOff, CheckCircle2 } from "lucide-react";

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

export default function LoginPage() {
  const router = useRouter();
  const { loading, error, clearError, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => { setMounted(true); }, []);
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
    <div className="bg-[var(--bg-primary)] overflow-hidden transition-colors duration-300" style={{ height: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none select-none z-0">
        <div className="absolute inset-y-0 left-0 w-full lg:w-1/2 bg-cover bg-center" style={{ backgroundImage: 'url(/branding/rodovia.jpg)' }}>
          <div className="absolute inset-0 bg-red-900/80 mix-blend-multiply" />
        </div>
        
        {/* Orbs right side (login side) */}
        <div className="hidden lg:block absolute top-[-15%] right-[-8%] w-[800px] h-[800px] rounded-full bg-red-600/10 dark:bg-red-700/8 blur-[150px]" />
        <div className="hidden lg:block absolute bottom-[-15%] right-[20%] w-[700px] h-[700px] rounded-full bg-orange-500/10 dark:bg-orange-500/6 blur-[130px]" />
        
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
        {/* Logo */}
        <Link href="/">
          <img src="/branding/logo-ttbr-branca.png" alt="Triunfo TBR" className="h-16 w-auto" />
        </Link>

        {/* Main statement */}
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/40 bg-red-500/20 text-white text-[11px] font-medium mb-6 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Sistema disponível · 99,9% uptime
            </div>
            <h1 className="font-display text-[44px] font-bold leading-[1.08] tracking-tight text-white mb-5">
              Profundidade
              <br />
              <span className="bg-gradient-to-r from-red-400 via-orange-300 to-red-400 bg-clip-text text-transparent">
                corporativa.
              </span>
              <br />
              Experiência
              <br />
              <span className="text-white/70">moderna.</span>
            </h1>
            <p className="text-[15px] text-white/80 leading-relaxed max-w-[340px]">
              Transforme tarefas, chamados, projetos e indicadores em uma única operação inteligente.
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
                <div className="w-9 h-9 rounded-[10px] bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-white/20 transition-all">
                  <Icon size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{label}</div>
                  <div className="text-[12px] text-white/70 mt-0.5">{desc}</div>
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
                className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-3 text-center"
              >
                <div className="font-display font-bold text-lg text-white leading-none">{stat.value}</div>
                <div className="text-[10px] text-white/70 mt-1 font-mono">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Social proof footer */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {['T', 'R', 'I', 'U', 'N', 'F', 'O'].map((l, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-red-900 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                {l}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-white/70">Triunfo Transbrasiliana</p>
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
            <img src="/branding/logo-ttbr-colorida.png" alt="Triunfo TBR" className="h-16 w-auto" />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-display text-[30px] font-bold text-[var(--text-primary)] mb-2 leading-tight tracking-tight">
              Bem Vindo ao seu HUB Operacional
            </h2>
          </div>

          {/* Form card */}
          <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-2xl p-8 shadow-premium-lg">
            {/* Top glow line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  className="input-o py-3.5"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] tracking-widest uppercase">Senha</label>
                  <Link href="/recuperar-senha" className="text-[12px] text-red-500 opacity-80 hover:opacity-100 transition-opacity">
                    Esqueci a senha
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    className="input-o py-3.5 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {localError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="text-[13px] text-[var(--accent-red)] bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center"
                  >
                    {localError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={localLoading || !email || !senha}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {localLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>Entrar no workspace <ArrowRight size={16} /></>
                )}
              </button>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-4 pt-1">
                {['Dados criptografados', 'LGPD compliant', 'Multi-tenant'].map((t, i) => (
                  <div key={t} className="flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-[var(--accent-green)] shrink-0" />
                    <span className="text-[10px] text-[var(--text-faint)]">{t}</span>
                  </div>
                ))}
              </div>
            </form>
          </div>

          <div className="mt-6 text-center space-y-3 relative z-10">
            <Link href="/solicitar-acesso" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Problemas para acessar?{' '}
              <span className="text-red-500 opacity-80 hover:opacity-100">Fale com o suporte →</span>
            </Link>
            <p className="text-[11px] text-[var(--text-faint)] font-mono">Orkiestri HUB Operacional</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
