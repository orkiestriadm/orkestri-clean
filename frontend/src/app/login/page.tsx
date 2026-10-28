"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

const RED = "#D32F2F";
const RED_HOVER = "#B71C1C";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);
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
      setLocalError(err?.response?.data?.message || "Credenciais invalidas. Verifique seus dados.");
      setLocalLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ height: '100dvh' }}>
      {/* Background rodovia full-bleed */}
      <img
        src="/branding/rodovia.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay forte pra escurecer (foto e diurna) e dar ar noturno */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/30" />

      {/* Conteudo */}
      <div className="relative z-10 h-full grid" style={{ gridTemplateColumns: '1fr min(38%, 560px)' }}>
        {/* Lado esquerdo: vazio na maior parte, texto descritivo embaixo */}
        <div className="hidden lg:flex flex-col justify-end p-10 xl:p-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <p className="text-white/85 text-[15px] xl:text-[16px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              HUB Operacional &middot; Triunfo Transbrasiliana
            </p>
          </motion.div>
        </div>

        {/* Lado direito: painel escuro com form */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col h-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(2px)' }}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-8 sm:px-12 py-10">
            {/* Logo Triunfo */}
            <motion.img
              src="/branding/logo-ttbr-branca.png"
              alt="Triunfo Transbrasiliana"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="w-full max-w-[280px] mb-6 drop-shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
            />

            {/* Welcome */}
            <h2 className="text-white text-[22px] sm:text-[24px] font-medium text-center mb-8 tracking-tight">
              Bem Vindo ao HUB Operacional
            </h2>

            <form onSubmit={handleLogin} className="w-full max-w-[380px] flex flex-col gap-3.5">
              {/* Email com badge vermelho */}
              <div className="flex items-stretch rounded-md overflow-hidden bg-white shadow-sm">
                <div
                  className="flex items-center justify-center px-3.5"
                  style={{ backgroundColor: RED }}
                  aria-hidden
                >
                  <Mail size={18} className="text-white" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="E-mail"
                  autoComplete="email"
                  className="flex-1 px-3.5 py-3 text-[14px] text-gray-800 placeholder:text-gray-500 outline-none bg-white"
                />
              </div>

              {/* Senha com badge vermelho */}
              <div className="flex items-stretch rounded-md overflow-hidden bg-white shadow-sm">
                <div
                  className="flex items-center justify-center px-3.5"
                  style={{ backgroundColor: RED }}
                  aria-hidden
                >
                  <Lock size={18} className="text-white" />
                </div>
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Senha"
                    autoComplete="current-password"
                    className="w-full px-3.5 py-3 pr-10 text-[14px] text-gray-800 placeholder:text-gray-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors"
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
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="text-[13px] text-red-100 bg-red-700/40 border border-red-500/40 rounded-md px-3.5 py-2.5 text-center"
                  >
                    {localError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botao Entrar */}
              <button
                type="submit"
                disabled={localLoading || !email || !senha}
                className="w-full py-3.5 mt-1 rounded-md text-white font-semibold text-[15px] tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: localLoading ? RED_HOVER : RED }}
                onMouseEnter={(e) => { if (!localLoading && email && senha) e.currentTarget.style.backgroundColor = RED_HOVER; }}
                onMouseLeave={(e) => { if (!localLoading) e.currentTarget.style.backgroundColor = RED; }}
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
                  <span>Entrar</span>
                )}
              </button>

              {/* Link senha */}
              <div className="text-center mt-1">
                <Link
                  href="/recuperar-senha"
                  className="text-[12px] text-white/70 hover:text-white transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          </div>

          {/* Footer painel */}
          <div className="px-8 pb-5 text-center">
            <p className="text-[11px] text-white/50">
              &copy; Triunfo Transbrasiliana &middot; Sistema interno
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
