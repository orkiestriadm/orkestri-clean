"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/logo";
import { CheckCircle2, CreditCard, Copy, Check, Loader2, QrCode, AlertTriangle } from "lucide-react";

/**
 * Página de pagamento da mensalidade.
 *
 * É PÚBLICA de propósito. Quem precisa pagar está com o acesso vencido e o
 * login barra antes de emitir sessão — uma página atrás de login seria uma
 * porta trancada. Quem identifica a conta é o token do endereço, que o
 * servidor assina e só serve para abrir esta tela.
 *
 * Usa `fetch` cru em vez do `api` (axios): o interceptor dele trata sessão
 * expirada e assinatura suspensa redirecionando, e aqui não há sessão nenhuma.
 */

const ACENTO = "var(--accent-violet, #f97316)";

/**
 * Cabeçalho CSRF dos POSTs.
 *
 * A API usa double-submit cookie: o `csrf_token` é emitido em qualquer request
 * (o GET do estado, que acontece antes de qualquer botão aparecer) e tem de
 * voltar no header. Sem isso o POST morre com 403 e a tela parece quebrada sem
 * explicação — foi o que aconteceu no primeiro teste real desta página.
 */
function cabecalhoCsrf(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? { "X-CSRF-Token": decodeURIComponent(m[1]) } : {};
}

type Estado = {
  nome: string;
  produto: string;
  valorCentavos: number;
  valorLabel: string;
  fase: "TESTE" | "MENSAL" | null;
  venceEm: string | null;
  vencido: boolean;
  podeRenovar: boolean;
  renovacaoAuto: boolean;
  proximoPeriodoAte: string | null;
  pix: { copiaECola: string; expiraEm: string | null } | null;
  ultimoPagamento: Pagamento | null;
};

type Pagamento = {
  pagoEm: string | null;
  valorCentavos: number;
  meio: string | null;
  liberouAte: string | null;
};

type Pix = { copiaECola: string; qrCodeBase64: string | null; expiraEm: string | null };

/**
 * Por quanto tempo o pagamento é a notícia da tela.
 *
 * Dentro da janela, quem abre o link vê "pagamento confirmado" em vez dos
 * botões: é a pessoa que acabou de pagar e voltou para conferir. Depois disso
 * a tela volta a ser a de pagar, com o último pagamento numa linha de apoio.
 */
const JANELA_CONFIRMACAO_MS = 24 * 60 * 60 * 1000;

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const comoPagou = (meio: string | null) => (meio === "pix" ? " no Pix" : meio === "cartao" ? " no cartão" : "");

/** O pagamento ainda sustenta o acesso? É o que torna um novo pagamento desnecessário. */
const aindaVale = (p: Pagamento | null, agora = Date.now()) =>
  !!p?.liberouAte && new Date(p.liberouAte).getTime() > agora;

const recemPago = (p: Pagamento | null, agora = Date.now()) =>
  !!p?.pagoEm && agora - new Date(p.pagoEm).getTime() < JANELA_CONFIRMACAO_MS;

export default function AssinaturaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<"cartao" | "pix" | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pago, setPago] = useState(false);

  // Vencimento de quando o Pix foi mostrado. Quando ele ANDA, o pagamento caiu
  // — é o sinal mais honesto que temos sem inventar outro endpoint.
  const venceEmNoPix = useRef<string | null>(null);

  const carregar = useCallback(async (): Promise<Estado | null> => {
    const res = await fetch(`/api/assinatura/checkout/${encodeURIComponent(token)}`);
    if (!res.ok) {
      setErro(res.status === 404 ? "Este link não é válido. Peça um novo pelo WhatsApp." : "Não conseguimos carregar os seus dados agora.");
      return null;
    }
    const data: Estado = await res.json();
    setEstado(data);
    setErro(null);
    return data;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    carregar()
      .then((d) => {
        if (!d) return;
        // Quem pagou e recarregou cai aqui. Sem isto, a tela volta a pedir
        // pagamento e o passo natural de quem acha que falhou é pagar de novo.
        if (recemPago(d.ultimoPagamento)) { setPago(true); return; }
        if (d.pix) { setPix({ ...d.pix, qrCodeBase64: null }); venceEmNoPix.current = d.venceEm; }
      })
      .finally(() => setCarregando(false));
  }, [token, carregar]);

  // Enquanto há Pix na tela, fica de olho na confirmação.
  useEffect(() => {
    if (!pix || pago) return;
    const t = setInterval(async () => {
      const d = await carregar().catch(() => null);
      if (d && d.venceEm && d.venceEm !== venceEmNoPix.current) {
        setPago(true);
        clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [pix, pago, carregar]);

  const pagarNoCartao = async () => {
    setOcupado("cartao");
    try {
      const res = await fetch(`/api/assinatura/checkout/${encodeURIComponent(token)}/cartao`, { method: "POST", headers: cabecalhoCsrf() });
      const data = await res.json();
      if (!res.ok || !data.initPoint) throw new Error(data?.message || "Não foi possível abrir o cartão.");
      window.location.href = data.initPoint;
    } catch (e: any) {
      setErro(e?.message || "Não foi possível abrir o pagamento no cartão. Tente o Pix.");
      setOcupado(null);
    }
  };

  const pagarNoPix = async () => {
    setOcupado("pix");
    try {
      const res = await fetch(`/api/assinatura/checkout/${encodeURIComponent(token)}/pix`, { method: "POST", headers: cabecalhoCsrf() });
      const data = await res.json();
      if (!res.ok || !data.copiaECola) throw new Error(data?.message || "Não foi possível gerar o Pix.");
      setPix(data);
      venceEmNoPix.current = estado?.venceEm ?? null;
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar o Pix. Tente o cartão.");
    } finally {
      setOcupado(null);
    }
  };

  const copiar = async () => {
    if (!pix?.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não consegui copiar automaticamente — selecione o código e copie à mão.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary, #0f0f13)" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-subtle, #1e1e2a)" }}>
        <Link href="/"><BrandLogo size="md" /></Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border p-8" style={{ background: "var(--bg-card, #1a1a22)", borderColor: "var(--border-medium, #2a2a3a)" }}>
          {carregando ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin mx-auto mb-4" color="#f97316" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando…</p>
            </div>
          ) : pago ? (
            <Confirmado
              estado={estado}
              onAdiantar={estado?.podeRenovar && !estado?.renovacaoAuto ? () => setPago(false) : undefined}
            />
          ) : !estado ? (
            <Aviso titulo="Link indisponível" texto={erro || "Não conseguimos abrir esta página."} />
          ) : estado.renovacaoAuto && !pix ? (
            <Aviso
              icone="ok"
              titulo="Sua assinatura está no cartão"
              texto={`A cobrança de ${estado.valorLabel} é automática todo mês. Seu acesso ao ${estado.produto} vale até ${dia(estado.venceEm)} — não precisa fazer nada.`}
            />
          ) : !estado.podeRenovar ? (
            <Aviso
              titulo="Prazo encerrado"
              texto="Faz mais de 15 dias que o acesso venceu, então o pagamento por aqui não vale mais. Nossa equipe vai falar com você pelo WhatsApp para liberar."
            />
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {estado.fase === "TESTE" ? "Continuar no Orkiestri" : "Renovar a mensalidade"}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Olá, {estado.nome.split(" ")[0]}! {estado.produto} e todos os outros módulos por{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{estado.valorLabel} por mês</strong>.
                </p>
                <p className="text-xs mt-2" style={{ color: estado.vencido ? "#f59e0b" : "var(--text-muted)" }}>
                  {estado.vencido
                    ? `Seu acesso venceu em ${dia(estado.venceEm)}.`
                    : `Seu acesso vale até ${dia(estado.venceEm)}.`}
                  {estado.proximoPeriodoAte ? ` Pagando, segue até ${dia(estado.proximoPeriodoAte)}.` : ""}
                </p>
              </div>

              {erro && (
                <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  {erro}
                </div>
              )}

              {!pix && aindaVale(estado.ultimoPagamento) && (
                <JaPago pagamento={estado.ultimoPagamento!} />
              )}

              {pix ? (
                <PixAberto pix={pix} copiado={copiado} onCopiar={copiar} />
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={pagarNoCartao}
                    disabled={!!ocupado}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: ACENTO }}
                  >
                    {ocupado === "cartao" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    Assinar no cartão — renova sozinho
                  </button>

                  <button
                    onClick={pagarNoPix}
                    disabled={!!ocupado}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-medium, #2a2a3a)" }}
                  >
                    {ocupado === "pix" ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                    Pagar este mês no Pix
                  </button>

                  <p className="text-xs text-center pt-1" style={{ color: "var(--text-muted)" }}>
                    No cartão, a cobrança se repete todo mês e você pode cancelar quando quiser.
                    No Pix, você paga um mês de cada vez.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Orkiestri · orkiestri.com
      </footer>
    </div>
  );
}

function PixAberto({ pix, copiado, onCopiar }: { pix: Pix; copiado: boolean; onCopiar: () => void }) {
  return (
    <div className="text-center">
      {pix.qrCodeBase64 && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code do Pix"
          className="mx-auto mb-4 rounded-xl"
          style={{ width: 200, height: 200, background: "#fff", padding: 8 }}
        />
      )}

      <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
        Abra o app do seu banco, escolha <strong style={{ color: "var(--text-primary)" }}>Pix copia e cola</strong> e use o código abaixo.
      </p>

      <div
        className="rounded-xl p-3 mb-3 text-[11px] font-mono break-all text-left"
        style={{ background: "var(--bg-primary, #0f0f13)", border: "1px solid var(--border-medium, #2a2a3a)", color: "var(--text-secondary)" }}
      >
        {pix.copiaECola}
      </div>

      <button
        onClick={onCopiar}
        className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
        style={{ background: ACENTO }}
      >
        {copiado ? <Check size={16} /> : <Copy size={16} />}
        {copiado ? "Código copiado" : "Copiar código Pix"}
      </button>

      <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={12} className="animate-spin" />
        Esperando o pagamento cair. Pode deixar esta tela aberta.
      </div>

      {pix.expiraEm && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Este código vale até {dia(pix.expiraEm)}.
        </p>
      )}
    </div>
  );
}

function Confirmado({ estado, onAdiantar }: { estado: Estado | null; onAdiantar?: () => void }) {
  const p = estado?.ultimoPagamento ?? null;
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)" }}>
        <CheckCircle2 size={36} color="#22c55e" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Pagamento confirmado!</h1>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {p?.pagoEm && (
          <>
            Recebemos {reais(p.valorCentavos)}{comoPagou(p.meio)} em {dia(p.pagoEm)}.{" "}
          </>
        )}
        Seu acesso está liberado{estado?.venceEm ? ` até ${dia(estado.venceEm)}` : ""}. Já pode entrar.
      </p>
      <Link
        href="/login"
        className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
        style={{ background: ACENTO }}
      >
        Entrar no sistema →
      </Link>

      {onAdiantar && (
        <button
          onClick={onAdiantar}
          className="mt-4 text-xs underline underline-offset-2 transition-opacity hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          Quero adiantar o próximo mês
        </button>
      )}
    </div>
  );
}

/**
 * Linha de apoio quando o pagamento já saiu da janela de notícia mas ainda
 * sustenta o acesso. Existe para quem volta ao link dias depois não achar que
 * o pagamento se perdeu — e pagar o mesmo mês outra vez.
 */
function JaPago({ pagamento }: { pagamento: Pagamento }) {
  return (
    <div
      className="rounded-xl p-3 mb-4 text-xs flex items-start gap-2"
      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}
    >
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      <span>
        Seu pagamento de {reais(pagamento.valorCentavos)}
        {comoPagou(pagamento.meio)} entrou{pagamento.pagoEm ? ` em ${dia(pagamento.pagoEm)}` : ""} e liberou o
        acesso até {dia(pagamento.liberouAte)}. Só pague de novo se quiser adiantar o mês seguinte.
      </span>
    </div>
  );
}

function Aviso({ titulo, texto, icone }: { titulo: string; texto: string; icone?: "ok" }) {
  const ok = icone === "ok";
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: ok ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
          border: `2px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
        }}
      >
        {ok ? <CheckCircle2 size={36} color="#22c55e" /> : <AlertTriangle size={32} color="#f59e0b" />}
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{titulo}</h1>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{texto}</p>
    </div>
  );
}
