"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/ui/logo";
import { Loader2, Mail, Check, ArrowLeft, MessageCircle, ShieldAlert, X } from "lucide-react";
import { LOGIN_FUNDO } from "@/lib/marca";

/**
 * Recuperação de senha.
 *
 * A apresentação acompanha o /login — mesmo fundo do planeta, mesma paleta —
 * para que sair do login e cair aqui não pareça outro produto.
 *
 * DOIS caminhos, e isso não é enfeite: o link por e-mail depende de SMTP, que
 * nem todo ambiente tem configurado. Quando falta, o backend engole o erro
 * (`.catch(() => {})`) e esta tela dizia "verifique seu e-mail" para uma
 * mensagem que nunca chegava — deixando a conta sem nenhuma saída. O código
 * por WhatsApp usa a integração que já está no ar e não depende de SMTP.
 */

type Step = "escolha" | "email" | "enviado" | "whatsapp" | "codigo" | "nova-senha" | "ok";

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

export default function RecuperarSenhaPage() {
  const [step, setStep] = useState<Step>("escolha");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** Número sem conta: abre o aviso em vez de mandar esperar um código. */
  const [semCadastro, setSemCadastro] = useState(false);

  /**
   * Token pela URL lido de `window.location`, e não de `useSearchParams()`.
   *
   * `useSearchParams()` tira a página do render estático e joga a árvore
   * inteira para dentro de um Suspense do lado do cliente. O `<Suspense>` aqui
   * estava sem `fallback`, então o HTML servido vinha VAZIO e a tela ficava
   * branca até o JS executar — e branca para sempre se ele não executasse.
   * Nenhum esqueleto, nenhum erro, nada em que se agarrar para diagnosticar.
   *
   * Lendo de `window.location` a página volta a ser pré-renderizada: o HTML já
   * chega com a moldura e o formulário. O JS só decide qual passo mostrar.
   */
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      setResetToken(token);
      setStep("nova-senha");
    }
  }, []);

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

  /** Só dígitos: o backend compara o número cru que está no perfil. */
  const whatsappLimpo = whatsapp.replace(/\D/g, "");

  const handleEnviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (whatsappLimpo.length < 10) { setError("Informe o número com DDD."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/enviar-otp", { whatsapp: whatsappLimpo });
      // Sem WhatsApp cadastrado não adianta ir para a tela de código: a pessoa
      // ficaria esperando um código que nunca chega, sem saber por quê. Sete das
      // doze contas desta organização estão nessa situação.
      if (data?.semCadastro) { setSemCadastro(true); return; }
      setStep("codigo");
    } catch (err: any) {
      setError(err.response?.data?.message || "Não foi possível enviar o código.");
    } finally { setLoading(false); }
  };

  const handleVerificarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.length !== 6) { setError("O código tem 6 dígitos."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/verificar-otp", { whatsapp: whatsappLimpo, codigo });
      // O token vale 3 minutos — daí ir direto para a senha, sem tela no meio.
      setResetToken(data.resetToken);
      setStep("nova-senha");
    } catch (err: any) {
      setError(err.response?.data?.message || "Código inválido ou expirado.");
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
      : step === "codigo" ? "Digite o código"
      : "Recuperar senha";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#08090c] px-5 py-10 text-white">
      {/* Mesma atmosfera do login: o planeta continua ao fundo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img src={LOGIN_FUNDO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#08090c]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(8,9,12,0.85)_80%)]" />
      </div>

      {semCadastro && (
        <AvisoSemCadastro numero={whatsapp} onFechar={() => setSemCadastro(false)} />
      )}

      <div className="relative z-10 w-full max-w-[430px]">
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <BrandLogo size="lg" tone="light" />
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.03em]">{titulo}</h1>
        </div>

        <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-xl sm:p-8">
          {/* PASSO 0 — escolher por onde receber */}
          {step === "escolha" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-relaxed text-white/55">
                Como você prefere receber a instrução para redefinir a senha?
              </p>

              <button
                type="button"
                onClick={() => { setStep("whatsapp"); setError(""); }}
                className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.10] bg-white/[0.04] p-4 text-left transition-all hover:border-[#f97316]/50 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-400">
                  <MessageCircle size={19} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-white">Código por WhatsApp</span>
                  <span className="block text-[12.5px] text-white/50">
                    Chega em segundos no número cadastrado
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); }}
                className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.10] bg-white/[0.04] p-4 text-left transition-all hover:border-[#f97316]/50 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f97316]/12 text-[#fb923c]">
                  <Mail size={19} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-white">Link por e-mail</span>
                  <span className="block text-[12.5px] text-white/50">
                    Depende do servidor de e-mail estar ativo
                  </span>
                </span>
              </button>
            </div>
          )}

          {/* PASSO 1a — número do WhatsApp */}
          {step === "whatsapp" && (
            <form onSubmit={handleEnviarOtp} className="flex flex-col gap-5">
              <p className="text-[14px] leading-relaxed text-white/55">
                Informe o WhatsApp cadastrado na sua conta. Enviaremos um código
                de 6 dígitos, válido por 5 minutos.
              </p>
              <div>
                <label htmlFor="whatsapp" className="mb-1.5 block text-[13px] font-medium text-white/70">
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="DDD + número"
                  className={INPUT}
                  autoFocus
                />
              </div>
              {error && <Erro texto={error} />}
              <button type="submit" disabled={loading} className={BOTAO}>
                {loading
                  ? <><Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> Enviando...</>
                  : "Enviar código"}
              </button>
              <Voltar onClick={() => { setStep("escolha"); setError(""); }} />
            </form>
          )}

          {/* PASSO 2a — digitar o código */}
          {step === "codigo" && (
            <form onSubmit={handleVerificarOtp} className="flex flex-col gap-5">
              <p className="text-[14px] leading-relaxed text-white/55">
                Digite o código de 6 dígitos enviado para o WhatsApp terminado em{" "}
                <strong className="text-white/85">{whatsappLimpo.slice(-4)}</strong>.
              </p>
              <div>
                <label htmlFor="codigo" className="mb-1.5 block text-[13px] font-medium text-white/70">
                  Código
                </label>
                <input
                  id="codigo"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  // Só dígitos: colar com espaço ou traço não pode invalidar.
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={`${INPUT} text-center text-[22px] tracking-[0.5em]`}
                  autoFocus
                />
              </div>
              {error && <Erro texto={error} />}
              <button type="submit" disabled={loading || codigo.length !== 6} className={BOTAO}>
                {loading
                  ? <><Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> Verificando...</>
                  : "Verificar código"}
              </button>
              <Voltar
                rotulo="Enviar outro código"
                onClick={() => { setStep("whatsapp"); setCodigo(""); setError(""); }}
              />
            </form>
          )}

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
              <Voltar
                rotulo="Usar outro e-mail"
                onClick={() => { setStep("email"); setError(""); }}
              />
              {/* Sem SMTP configurado o e-mail nunca chega, e o backend não
                  tem como avisar daqui. Oferecer a saída é melhor que deixar
                  a pessoa esperando por algo que não vem. */}
              <Voltar
                rotulo="Receber por WhatsApp"
                onClick={() => { setStep("whatsapp"); setError(""); }}
              />
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

/** Link discreto de retorno, repetido em várias etapas. */
function Voltar({ onClick, rotulo = "Voltar" }: { onClick: () => void; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded text-[13px] font-medium text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
    >
      ← {rotulo}
    </button>
  );
}

/**
 * Aviso de número sem cadastro.
 *
 * Existe porque a alternativa era pior: mandar a pessoa para a tela de código e
 * deixá-la esperando um SMS que nunca chega, sem nada explicando o motivo. Sete
 * das doze contas desta organização não têm WhatsApp cadastrado.
 *
 * Diz o que fazer, não só o que deu errado — "procure o administrador" é a
 * única saída real de quem não tem canal de recuperação, ainda mais com o
 * e-mail fora do ar.
 */
function AvisoSemCadastro({ numero, onFechar }: { numero: string; onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sem-cadastro-titulo"
      onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="relative w-full max-w-[420px] rounded-[20px] border border-white/[0.10] bg-[#12141a] p-7 text-white shadow-2xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white/80"
        >
          <X size={18} />
        </button>

        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/12 text-amber-400">
          <ShieldAlert size={22} />
        </span>

        <h2 id="sem-cadastro-titulo" className="mb-2.5 text-[19px] font-bold leading-tight tracking-[-0.02em]">
          Número não cadastrado
        </h2>

        <p className="mb-3 text-[14px] leading-relaxed text-white/60">
          Não encontramos nenhuma conta com o WhatsApp{" "}
          <strong className="font-semibold text-white/85">{numero}</strong>.
        </p>
        <p className="mb-6 text-[14px] leading-relaxed text-white/60">
          Se você tem acesso ao sistema mas nunca cadastrou seu WhatsApp,{" "}
          <strong className="font-semibold text-white/85">procure o administrador</strong>. Ele pode
          cadastrar seu número ou redefinir sua senha diretamente.
        </p>

        <button
          type="button"
          onClick={onFechar}
          className="w-full rounded-[12px] bg-[#f97316] px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#ea6a0c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
        >
          Entendi
        </button>
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
