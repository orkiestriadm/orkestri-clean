"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { OrkestriLogo } from "@/components/ui/logo";

type Step = "whatsapp" | "otp" | "nova-senha" | "ok";

function PasswordStrength({ senha }: { senha: string }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: senha.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(senha) },
    { label: "Letra minúscula", ok: /[a-z]/.test(senha) },
    { label: "Número", ok: /[0-9]/.test(senha) },
  ];
  if (!senha) return null;
  return (
    <div className="flex flex-col gap-1 mt-2">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-2 text-[12px]">
          <span className={c.ok ? "text-green-500" : "text-zinc-400"}>{c.ok ? "✓" : "○"}</span>
          <span className={c.ok ? "text-green-600 dark:text-green-400" : "text-zinc-400 dark:text-zinc-500"}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function RecuperarSenhaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("whatsapp");
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputClass = "w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3.5 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600";

  const handleEnviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp) { setError("Informe seu número de WhatsApp."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/enviar-otp", { whatsapp });
      setStep("otp");
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao enviar código.");
    } finally { setLoading(false); }
  };

  const handleVerificarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError("Digite o código de 6 dígitos."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/verificar-otp", { whatsapp, codigo: otp });
      setResetToken(data.resetToken);
      setStep("nova-senha");
    } catch (err: any) {
      setError(err.response?.data?.message || "Código inválido ou expirado.");
    } finally { setLoading(false); }
  };

  const isValid = novaSenha.length >= 8 && /[A-Z]/.test(novaSenha) && /[a-z]/.test(novaSenha) && /[0-9]/.test(novaSenha);

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setError("A senha não atende aos requisitos."); return; }
    if (novaSenha !== confirmar) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/redefinir-senha", { resetToken, novaSenha });
      setStep("ok");
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao redefinir senha.");
    } finally { setLoading(false); }
  };

  const stepLabel = { whatsapp: "1/3", otp: "2/3", "nova-senha": "3/3", ok: "" }[step];

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center font-display">
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[800px] h-[800px] bg-black/[0.02] dark:bg-white/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-8">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5 shadow-xl rounded-[30px] overflow-hidden">
            <OrkestriLogo size={48} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">
            Recuperar senha
          </h1>
          {stepLabel && (
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500 font-medium">Etapa {stepLabel}</p>
          )}
        </div>

        <div className="bg-white/70 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-8 shadow-2xl">

          {step === "whatsapp" && (
            <form onSubmit={handleEnviarOtp} className="flex flex-col gap-5">
              <div>
                <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-5">
                  Informe o número de WhatsApp cadastrado na sua conta. Enviaremos um código de verificação.
                </p>
                <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">WhatsApp</label>
                <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" className={inputClass} />
              </div>
              {error && <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-md">
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerificarOtp} className="flex flex-col gap-5">
              <div>
                <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-5">
                  Digite o código de 6 dígitos enviado para seu WhatsApp. Ele expira em 5 minutos.
                </p>
                <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Código de verificação</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={inputClass + " tracking-[0.5em] text-center text-2xl font-mono"}
                />
              </div>
              {error && <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">{error}</div>}
              <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-md">
                {loading ? "Verificando..." : "Verificar código"}
              </button>
              <button type="button" onClick={() => { setStep("whatsapp"); setOtp(""); setError(""); }} className="text-[13px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors text-center">
                ← Usar outro número
              </button>
            </form>
          )}

          {step === "nova-senha" && (
            <form onSubmit={handleRedefinir} className="flex flex-col gap-5">
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400">
                Crie sua nova senha. Escolha algo seguro e fácil de lembrar.
              </p>
              <div>
                <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Nova senha</label>
                <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="••••••••" className={inputClass + " tracking-widest"} />
                <PasswordStrength senha={novaSenha} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Confirmar senha</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="••••••••" className={inputClass + " tracking-widest"} />
                {confirmar && novaSenha !== confirmar && (
                  <p className="text-[12px] text-red-500 mt-1.5">As senhas não coincidem.</p>
                )}
              </div>
              {error && <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">{error}</div>}
              <button type="submit" disabled={loading || !isValid || novaSenha !== confirmar} className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-md">
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          )}

          {step === "ok" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Senha redefinida!</h2>
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-8">
                Sua senha foi alterada com sucesso. Faça login com a nova senha.
              </p>
              <Link href="/login" className="inline-block w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-center shadow-md">
                Ir para o login
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
