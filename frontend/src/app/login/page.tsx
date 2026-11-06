"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { homeRoute } from "@/lib/modules";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CalendarDays,
  Wallet,
  MessageCircle,
  FolderKanban,
  Check,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/logo";
import { MARCA } from "@/lib/marca";

const WHATSAPP_CADASTRO =
  "https://wa.me/5514991661688?text=CADASTRO";

const MODULOS_ORBITA = [
  {
    icon: CalendarDays,
    label: "Agenda e rotina",
    text: "Compromissos e lembretes sincronizados com o WhatsApp",
  },
  {
    icon: Wallet,
    label: "Meus gastos",
    text: "Despesas, categorias e metas anotadas por mensagem",
  },
  {
    icon: FolderKanban,
    label: "Projetos e tarefas",
    text: "Prazos, quadros e acompanhamento da semana inteira",
  },
  {
    icon: MessageCircle,
    label: "Chamados e notas",
    text: "Pedidos, base de conhecimento e anotações rápidas",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [etapa, setEtapa] = useState<"entrar" | "trocar">("entrar");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [aviso, setAviso] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) router.replace(homeRoute(user));
  }, [user, router]);

  useEffect(() => {
    setLocalError("");
  }, [email, senha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha || localLoading) return;
    setLocalLoading(true);
    setLocalError("");
    try {
      const result = await authApi.login(email, senha);

      if ((result as any)?.precisaTrocarSenha) {
        setEtapa("trocar");
        setAviso(
          (result as any).mensagem || "Enviamos um código para o seu e-mail.",
        );
        setLocalLoading(false);
        return;
      }

      useAuthStore.setState({
        user: result.user,
        token: result.accessToken,
        loading: false,
      });
      router.replace(homeRoute(result.user));
    } catch (err: any) {
      setLocalError(
        err?.response?.data?.message ||
          "Credenciais inválidas. Confira o e-mail e a senha e tente novamente.",
      );
      setLocalLoading(false);
    }
  };

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    if (novaSenha.length < 8) {
      setLocalError("A nova senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setLocalError("As senhas não conferem.");
      return;
    }
    setLocalLoading(true);
    setLocalError("");
    try {
      const result = await authApi.confirmarPrimeiroAcesso(
        email,
        senha,
        codigo,
        novaSenha,
      );
      useAuthStore.setState({
        user: result.user,
        token: result.accessToken,
        loading: false,
      });
      router.replace(homeRoute(result.user));
    } catch (err: any) {
      setLocalError(
        err?.response?.data?.message ||
          "Não consegui confirmar. Confira o código e tente de novo.",
      );
      setLocalLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    setLocalError("");
    setAviso("");
    try {
      const r = await authApi.reenviarCodigoPrimeiroAcesso(email, senha);
      setAviso(r?.mensagem || "Enviamos um código novo.");
    } catch {
      setAviso("Enviamos um código novo, se os dados estiverem certos.");
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-[#090a0d] text-[#f4f6f9]">
      {/* ── Atmosfera quente do Orkiestri + Órbitas da Aurélia ─────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 95% at 0% 0%, rgba(255, 106, 26, 0.17), transparent 72%), radial-gradient(ellipse 85% 95% at 100% 100%, rgba(255, 121, 48, 0.13), transparent 72%), radial-gradient(ellipse 65% 80% at 55% 48%, rgba(255, 150, 85, 0.045), transparent 80%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 65% 60% at 28% 35%, #000 20%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 65% 60% at 28% 35%, #000 20%, transparent 75%)",
          }}
        />
      </div>

      {/* ── Painel da marca e órbita da Aurélia (desktop) ───────────────────── */}
      <aside className="relative z-10 hidden flex-1 flex-col justify-between p-12 xl:p-16 lg:flex">
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff6a1a]"
          >
            <BrandLogo size="lg" tone="light" />
          </a>
        </div>

        <div className=" my-auto grid max-w-2xl gap-10 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#ff8a3d]">
              <span className="h-px w-6 bg-[#ff6a1a]/80" aria-hidden />
              Sua rotina, no ritmo certo
            </p>
            <h2 className="mt-4 text-[2.45rem] font-bold leading-[1.06] tracking-[-0.035em] text-[#f4f6f9] xl:text-[2.95rem]">
              Uma conversa no WhatsApp.
              <br />
              Tudo organizado{" "}
              <span className="bg-gradient-to-r from-[#ff6a1a] via-[#ff8a3d] to-[#ffc48a] bg-clip-text text-transparent">
                no seu painel.
              </span>
            </h2>
            <p className="mt-5 text-[16px] leading-[1.7] text-[#adb4c2]">
              O que você combina com a <strong className="font-semibold text-white">Aurélia</strong>{" "}
              pelo celular aparece aqui em tela grande: agenda da semana, gastos,
              anotações, projetos e chamados sincronizados em tempo real.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-3">
              {MODULOS_ORBITA.map((p) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.label}
                    className="rounded-2xl border border-white/[0.08] bg-[#15181f]/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#ff6a1a]/15 text-[#ff8a3d] ring-1 ring-inset ring-[#ff6a1a]/25">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {p.label}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#adb4c2]">
                      {p.text}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Card visual da Aurélia em órbita */}
          <div className="relative mx-auto hidden w-full max-w-[270px] xl:block">
            {/* Anéis de órbita */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-7 rounded-full border border-dashed border-[#ff8a3d]/20 animate-[spin_42s_linear_infinite]"
            >
              <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#ff8a3d] shadow-[0_0_14px_2px_rgba(255,138,61,0.75)]" />
              <span className="absolute -bottom-1 left-1/3 h-2 w-2 rounded-full bg-[#ffc48a] shadow-[0_0_10px_2px_rgba(255,196,138,0.65)]" />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-14 rounded-full border border-white/[0.05] animate-[spin_60s_linear_infinite_reverse]"
            >
              <span className="absolute top-1/4 -right-1 h-2.5 w-2.5 rounded-full bg-[#ff6a1a] shadow-[0_0_12px_2px_rgba(255,106,26,0.7)]" />
            </div>

            <div className="relative rounded-[26px] border border-white/[0.11] bg-[#14171f]/90 p-5 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#9c6444] bg-[radial-gradient(circle_at_30%_20%,#805039,#221920)] font-serif text-lg italic text-[#ffdfc6]">
                  A
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#14171f] bg-[#25d366]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    Aurélia
                  </p>
                  <p className="text-[11px] text-[#adb4c2]">
                    Assistente do Orkiestri · online
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-[#ff8a3d]" aria-hidden />
              </div>

              <div className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-snug">
                <div className="self-end rounded-2xl rounded-tr-sm bg-[#25d366]/20 border border-[#25d366]/30 px-3.5 py-2.5 text-[#eff7f1]">
                  Marca reunião com a equipe amanhã às 10h.
                </div>
                <div className="self-start rounded-2xl rounded-tl-sm border border-white/[0.08] bg-[#1c2029] px-3.5 py-2.5 text-[#dbe0e8]">
                  <span className="mb-1 block text-[11px] font-semibold text-[#ffc48a]">
                    Aurélia
                  </span>
                  Pronto! Reunião salva na sua agenda para amanhã às 10h. Eu te
                  aviso antes pelo WhatsApp.
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-[#ff8a3d]/25 bg-[#ff6a1a]/[0.08] px-3 py-2 text-[11px] text-[#ffc48a]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Check className="h-3.5 w-3.5 text-[#ff8a3d]" aria-hidden />
                  Sincronizado com o painel
                </span>
                <span className="font-mono text-[10px] opacity-80">09:41</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-[#868e9d]">
          &copy; {new Date().getFullYear()} {MARCA} · Sua rotina em harmonia.
        </p>
      </aside>

      {/* ── Painel de acesso ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex w-full items-center justify-center px-6 py-12 sm:px-10 lg:w-[540px] lg:px-12">
        <div className="w-full max-w-[410px]">
          {/* Marca no mobile */}
          <div className="mb-8 lg:hidden">
            <a href="/" className="inline-block">
              <BrandLogo size="lg" tone="light" />
            </a>
          </div>

          <div className="rounded-[24px] border border-white/[0.1] bg-[#15181f]/80 p-7 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6a1a]/30 bg-[#ff6a1a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#ff8a3d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a1a]" aria-hidden />
              Painel Web · {MARCA}
            </div>
            <h1 className="mt-3.5 text-[26px] font-bold tracking-tight text-white">
              Acesse sua conta
            </h1>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#adb4c2]">
              Entre com o e-mail e a senha que você recebeu ao concluir seu
              cadastro com a Aurélia.
            </p>

            {etapa === "trocar" ? (
              <form
                onSubmit={handleTrocarSenha}
                className="mt-7 flex flex-col gap-5"
                noValidate
              >
                <div className="rounded-[14px] border border-[#ff6a1a]/30 bg-[#ff6a1a]/10 px-4 py-3 text-[13px] leading-relaxed text-orange-200">
                  Esta é a sua primeira entrada. Para sua segurança, escolha
                  agora a sua senha definitiva usando o código enviado ao seu
                  e-mail.
                  {aviso ? <> {aviso}</> : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="codigo"
                    className="text-[13px] font-medium text-white/75"
                  >
                    Código enviado ao seu e-mail
                  </label>
                  <input
                    id="codigo"
                    name="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    className="h-[52px] rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-center font-mono text-[22px] tracking-[0.5em] text-white outline-none transition placeholder:tracking-[0.3em] placeholder:text-white/20 focus:border-[#ff6a1a]/70 focus:bg-white/[0.06]"
                  />
                  <button
                    type="button"
                    onClick={reenviarCodigo}
                    className="self-start text-[13px] font-medium text-[#ff8a3d] hover:text-[#ff6a1a]"
                  >
                    Não recebeu o código? Enviar novamente
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="nova-senha"
                    className="text-[13px] font-medium text-white/75"
                  >
                    Nova senha
                  </label>
                  <input
                    id="nova-senha"
                    name="nova-senha"
                    type="password"
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="h-[52px] rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white outline-none transition focus:border-[#ff6a1a]/70 focus:bg-white/[0.06]"
                  />
                  <span className="text-[12px] text-[#868e9d]">
                    Mínimo de 8 caracteres.
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="confirma-senha"
                    className="text-[13px] font-medium text-white/75"
                  >
                    Confirme a nova senha
                  </label>
                  <input
                    id="confirma-senha"
                    name="confirma-senha"
                    type="password"
                    autoComplete="new-password"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    className="h-[52px] rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white outline-none transition focus:border-[#ff6a1a]/70 focus:bg-white/[0.06]"
                  />
                </div>

                {localError && (
                  <p
                    role="alert"
                    className="rounded-[14px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300"
                  >
                    {localError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    localLoading ||
                    codigo.length < 6 ||
                    !novaSenha ||
                    !confirmaSenha
                  }
                  className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff6a1a] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(255,106,26,0.55)] transition-all hover:bg-[#ff8a3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a1a] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {localLoading ? (
                    <>
                      <Loader2
                        className="h-[18px] w-[18px] animate-spin"
                        aria-hidden
                      />{" "}
                      Confirmando…
                    </>
                  ) : (
                    <>
                      Salvar senha e entrar{" "}
                      <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleLogin}
                className="mt-7 flex flex-col gap-5"
                noValidate
              >
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="email"
                    className="text-[13px] font-medium text-white/75"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    aria-invalid={!!localError}
                    className="h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#ff6a1a] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#ff6a1a]/15"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="senha"
                      className="text-[13px] font-medium text-white/75"
                    >
                      Senha
                    </label>
                    <Link
                      href="/recuperar-senha"
                      className="rounded text-[13px] font-medium text-[#ff8a3d] transition-colors hover:text-[#ff6a1a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a1a]"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="senha"
                      name="senha"
                      type={showSenha ? "text" : "password"}
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      aria-invalid={!!localError}
                      className="h-[52px] w-full rounded-[14px] border border-white/[0.10] bg-white/[0.04] px-4 pr-12 text-[15px] text-white outline-none transition-all placeholder:text-white/25 focus:border-[#ff6a1a] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#ff6a1a]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showSenha}
                      className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-white/40 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a1a]"
                    >
                      {showSenha ? (
                        <EyeOff className="h-[18px] w-[18px]" aria-hidden />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                {localError && (
                  <p
                    role="alert"
                    className="rounded-[14px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-300"
                  >
                    {localError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={localLoading || !email || !senha}
                  className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff6a1a] text-[15px] font-semibold text-white shadow-[0_8px_24px_-6px_rgba(255,106,26,0.55)] transition-all hover:bg-[#ff8a3d] hover:shadow-[0_12px_32px_-6px_rgba(255,106,26,0.65)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a1a] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {localLoading ? (
                    <>
                      <Loader2
                        className="h-[18px] w-[18px] animate-spin"
                        aria-hidden
                      />
                      Entrando…
                    </>
                  ) : (
                    <>
                      Entrar no painel
                      <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Chamada para criar conta com a Aurélia no WhatsApp (substitui o antigo Solicitar acesso) */}
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <p className="text-center text-[13px] text-[#adb4c2]">
                Ainda não tem uma conta no {MARCA}?
              </p>
              <a
                href={WHATSAPP_CADASTRO}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#25d366]/35 bg-[#25d366]/10 px-4 text-[13.5px] font-semibold text-[#4ade80] transition-all hover:border-[#25d366]/60 hover:bg-[#25d366]/18 hover:text-white"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Começar teste grátis com a Aurélia
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-[12px] text-[#868e9d] lg:hidden">
            &copy; {new Date().getFullYear()} {MARCA} · Sua rotina em harmonia.
          </p>
        </div>
      </main>
    </div>
  );
}
