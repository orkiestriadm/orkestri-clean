"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Shield, Zap, BarChart3, Eye, EyeOff } from "lucide-react";

const FEATURES = [
  { icon: Shield, label: "Segurança enterprise", desc: "Multi-tenant, JWT HttpOnly, OWASP nativo" },
  { icon: Zap, label: "Automações inteligentes", desc: "Fluxos e notificações via WhatsApp" },
  { icon: BarChart3, label: "Analytics em tempo real", desc: "KPIs, CSAT, SLA e dashboards executivos" },
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
    <div className="min-h-screen flex bg-[#070711] overflow-hidden">
      {/* ── Background decorations ── */}
      <div className="fixed inset-0 pointer-events-none select-none">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/6 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(167,139,250,1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ── Left panel — Brand (desktop only) ── */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative z-10 p-12 border-r border-white/[0.04]"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            <span className="font-display font-bold text-white text-base">O</span>
          </div>
          <div>
            <div className="font-display font-bold text-white text-[17px] leading-tight">Orkiestri</div>
            <div className="text-[10px] font-mono text-white/30 tracking-[0.12em] uppercase">Enterprise v2.0</div>
          </div>
        </div>

        {/* Main statement */}
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-[42px] font-bold leading-[1.1] tracking-tight text-white mb-4">
              Profundidade
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
                corporativa.
              </span>
              <br />
              Experiência
              <br />
              <span className="text-white/50">moderna.</span>
            </h1>
            <p className="text-[15px] text-white/40 leading-relaxed max-w-[340px]">
              Centralize CRM, projetos, chamados, financeiro e operações em uma única plataforma enterprise.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-violet-400" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/80">{label}</div>
                  <div className="text-[12px] text-white/30">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5">
            {['G','T','R','M','A'].map((l, i) => (
              <div key={i} className="w-6 h-6 rounded-full border border-[#070711] bg-gradient-to-br from-violet-500/60 to-violet-700/60 flex items-center justify-center text-[9px] font-bold text-white/70">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden justify-center">
            <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <span className="font-display font-bold text-white text-base">O</span>
            </div>
            <span className="font-display font-bold text-white text-[17px]">Orkiestri</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="font-display text-[28px] font-bold text-white mb-2 leading-tight">Bem-vindo de volta</h2>
            <p className="text-[14px] text-white/35">Acesse seu workspace enterprise.</p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-white/40 tracking-wide uppercase">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 text-[14px] text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-violet-500/[0.06] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-white/40 tracking-wide uppercase">Senha</label>
                  <Link href="/recuperar-senha" className="text-[12px] text-violet-400/70 hover:text-violet-400 transition-colors">
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
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3.5 pr-11 text-[14px] text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-violet-500/[0.06] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
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
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold text-[14px] hover:from-violet-500 hover:to-violet-400 transition-all shadow-[0_4px_16px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_24px_rgba(124,58,237,0.45)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
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
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-3">
            <Link href="/solicitar-acesso" className="text-[13px] text-white/30 hover:text-white/60 transition-colors">
              Não tem acesso? <span className="text-violet-400/70 hover:text-violet-400">Solicitar usuário →</span>
            </Link>
            <p className="text-[11px] text-white/15 font-mono">Orkiestri Enterprise · v2.0.4</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
