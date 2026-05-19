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
    <div className="min-h-screen flex bg-[#06060f] overflow-hidden">

      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        {/* Primary orb */}
        <div className="absolute top-[-15%] left-[-8%] w-[800px] h-[800px] rounded-full bg-violet-700/8 blur-[150px]" />
        {/* Cyan orb */}
        <div className="absolute bottom-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full bg-cyan-500/6 blur-[130px]" />
        {/* Small accent */}
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full bg-violet-500/5 blur-[80px] -translate-y-1/2" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.022]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(167,139,250,1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Vertical gradient separator */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-[480px] w-px bg-gradient-to-b from-transparent via-[rgba(162,130,255,0.12)] to-transparent" />
      </div>

      {/* ── Left panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative z-10 p-14"
      >
        {/* Logo */}
        <Link href="/">
          <img src="/logo-orkiestri-dark.png" alt="Logo Orkiestri" className="h-9 w-auto object-contain" />
        </Link>

        {/* Main statement */}
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(167,139,250,0.25)] bg-[rgba(167,139,250,0.08)] text-[#a78bfa] text-[11px] font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              Sistema disponível · 99,9% uptime
            </div>
            <h1 className="font-display text-[44px] font-bold leading-[1.08] tracking-tight text-white mb-5">
              Profundidade
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
                corporativa.
              </span>
              <br />
              Experiência
              <br />
              <span className="text-white/40">moderna.</span>
            </h1>
            <p className="text-[15px] text-white/40 leading-relaxed max-w-[340px]">
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
                <div className="w-9 h-9 rounded-[10px] bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-white/[0.07] group-hover:border-white/[0.12] transition-all">
                  <Icon size={16} className="text-violet-400" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/80">{label}</div>
                  <div className="text-[12px] text-white/30 mt-0.5">{desc}</div>
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
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center"
              >
                <div className="font-display font-bold text-lg text-violet-400 leading-none">{stat.value}</div>
                <div className="text-[10px] text-white/25 mt-1 font-mono">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Social proof footer */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {['G', 'T', 'R', 'M', 'A'].map((l, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-[#06060f] bg-gradient-to-br from-violet-500/60 to-violet-700/60 flex items-center justify-center text-[9px] font-bold text-white/70">
                {l}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-white/25">+120 empresas confiam no Orkiestri</p>
        </div>
      </motion.div>

      {/* ── Right panel — Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <img src="/logo-orkiestri-dark.png" alt="Logo Orkiestri" className="h-9 w-auto object-contain" />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-display text-[30px] font-bold text-white mb-2 leading-tight tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-[14px] text-white/35">Acesse seu workspace enterprise.</p>
          </div>

          {/* Form card */}
          <div className="relative rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-2xl p-8 shadow-[0_40px_100px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]">
            {/* Top glow line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.4)] to-transparent" />

            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-white/35 tracking-widest uppercase">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[14px] text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:bg-violet-500/[0.07] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-white/35 tracking-widest uppercase">Senha</label>
                  <Link href="/recuperar-senha" className="text-[12px] text-violet-400/60 hover:text-violet-400 transition-colors">
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
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 pr-11 text-[14px] text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:bg-violet-500/[0.07] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
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
                    className="text-[13px] text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-center"
                  >
                    {localError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={localLoading || !email || !senha}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-[14px] hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_28px_rgba(124,58,237,0.55)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
              >
                {localLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
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
                    <CheckCircle2 size={10} className="text-[#34d399] shrink-0" />
                    <span className="text-[10px] text-white/20">{t}</span>
                  </div>
                ))}
              </div>
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-3">
            <Link href="/solicitar-acesso" className="text-[13px] text-white/25 hover:text-white/55 transition-colors">
              Não tem acesso?{' '}
              <span className="text-violet-400/60 hover:text-violet-400">Solicitar usuário →</span>
            </Link>
            <p className="text-[11px] text-white/12 font-mono">Orkiestri Enterprise · v2.0.4</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
