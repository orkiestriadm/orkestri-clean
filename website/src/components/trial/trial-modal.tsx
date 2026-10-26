"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, Check, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { products } from "@/config/products";
import { useTrialModal } from "@/lib/trial-modal";
import { cn } from "@/lib/utils";

const TESTAVEIS = products.filter((p) => !p.comingSoon);
type Passo = "dados" | "codigo" | "ok";

/**
 * Modal de teste rápido. Passo 1: e-mail + WhatsApp + 1 módulo → envia código
 * no WhatsApp. Passo 2: digitar o código → cria o acesso de 7 dias (credenciais
 * chegam no WhatsApp). Fala com o backend por `/api/auth/trial/*` (mesmo
 * domínio; o nginx roteia para a API).
 */
export function TrialModal() {
  const aberto = useTrialModal((s) => s.aberto);
  const fechar = useTrialModal((s) => s.fechar);

  const [passo, setPasso] = useState<Passo>("dados");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [produto, setProduto] = useState("");
  const [codigoIndicacao, setCodigoIndicacao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Reseta ao fechar para a próxima abertura começar limpa.
  useEffect(() => {
    if (!aberto) {
      const t = setTimeout(() => {
        setPasso("dados"); setEmail(""); setWhatsapp(""); setProduto("");
        setCodigoIndicacao(""); setCodigo(""); setErro(""); setCarregando(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [aberto]);

  // Fecha no Esc.
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, fechar]);

  if (!aberto) return null;

  async function iniciar() {
    setErro("");
    if (email.trim().length < 5 || !email.includes("@")) return setErro("Informe um e-mail válido.");
    if (whatsapp.replace(/\D/g, "").length < 10) return setErro("Informe um WhatsApp com DDD.");
    if (!produto) return setErro("Escolha um módulo para testar.");
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/trial/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), whatsapp: whatsapp.trim(), produto, codigoIndicacao: codigoIndicacao.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Não foi possível enviar o código.");
      setPasso("codigo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    setErro("");
    if (codigo.replace(/\D/g, "").length < 6) return setErro("Digite o código de 6 dígitos.");
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/trial/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: whatsapp.trim(), codigo: codigo.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Código inválido.");
      setPasso("ok");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao confirmar o código.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      onClick={fechar}
      role="dialog"
      aria-modal="true"
      aria-label="Teste grátis"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-(--radius-card) bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-chalk-faint transition-colors hover:bg-white/[0.06] hover:text-chalk-dim"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 md:p-8">
          {passo === "ok" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
              <h3 className="text-xl font-semibold text-chalk">Seu teste está pronto! 🎉</h3>
              <p className="text-chalk-dim">
                Enviamos o e-mail e a senha de acesso no seu WhatsApp. São{" "}
                <strong>7 dias</strong> para explorar. Bom teste!
              </p>
              <Button onClick={fechar} className="mt-2 w-full">Entendi</Button>
            </div>
          ) : passo === "codigo" ? (
            <>
              <button
                onClick={() => { setPasso("dados"); setErro(""); }}
                className="mb-4 inline-flex items-center gap-1 text-sm text-chalk-dim hover:text-chalk"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <h3 className="text-xl font-bold text-chalk">Confirme o código</h3>
              <p className="mt-1 text-sm text-chalk-dim">
                Enviamos um código no WhatsApp <strong>{whatsapp}</strong>. Digite-o abaixo.
              </p>
              <div className="mt-5 flex flex-col gap-1.5">
                <Label htmlFor="trial-codigo">Código de 6 dígitos</Label>
                <Input
                  id="trial-codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.4em]"
                  autoFocus
                />
              </div>
              {erro && <p role="alert" className="mt-3 text-sm text-error">{erro}</p>}
              <Button onClick={confirmar} disabled={carregando} size="lg" className="mt-5 w-full">
                {carregando ? <><Loader2 className="h-5 w-5 animate-spin" /> Confirmando…</> : "Ativar meu teste"}
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-chalk">Teste grátis por 7 dias</h3>
              <p className="mt-1 text-sm text-chalk-dim">
                Sem cartão. Você recebe o acesso no WhatsApp e já começa a usar.
              </p>

              <div className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trial-email" required>E-mail</Label>
                  <Input
                    id="trial-email" type="email" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trial-whats" required>WhatsApp (com DDD)</Label>
                  <Input
                    id="trial-whats" type="tel" autoComplete="tel"
                    value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                  <span className="text-xs text-chalk-faint">É por aqui que enviamos suas credenciais.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trial-produto" required>Qual módulo quer testar?</Label>
                  <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {TESTAVEIS.map((p) => {
                      const on = produto === p.slug;
                      return (
                        <button
                          key={p.slug} type="button" onClick={() => setProduto(p.slug)}
                          aria-pressed={on}
                          className={cn(
                            "flex items-center gap-2 rounded-(--radius-input) border p-2.5 text-left text-sm transition-colors",
                            on ? "border-primary bg-flame/10" : "border-white/[0.08] hover:border-white/20"
                          )}
                        >
                          <span className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            on ? "border-primary bg-primary text-white" : "border-white/[0.14] text-transparent"
                          )}>
                            <Check className="h-3 w-3" />
                          </span>
                          <span className="truncate font-medium text-chalk">{p.name.replace("Orkiestri ", "")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trial-indicacao">Código de indicação (opcional)</Label>
                  <Input
                    id="trial-indicacao"
                    value={codigoIndicacao}
                    onChange={(e) => setCodigoIndicacao(e.target.value.toUpperCase())}
                    placeholder="ORK-XXXXXX"
                  />
                  <span className="text-xs text-chalk-faint">Recebeu um código de quem te indicou? Cole aqui.</span>
                </div>
              </div>

              {erro && <p role="alert" className="mt-3 text-sm text-error">{erro}</p>}

              <Button onClick={iniciar} disabled={carregando} size="lg" className="mt-5 w-full">
                {carregando ? <><Loader2 className="h-5 w-5 animate-spin" /> Enviando código…</> : "Começar meu teste grátis"}
              </Button>
              <p className="mt-4 text-center text-xs text-chalk-faint">
                Prefere uma demonstração guiada com a nossa equipe?{" "}
                <Link href="/demo" onClick={fechar} className="text-flame-soft underline-offset-2 hover:underline">
                  Solicitar demonstração
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
