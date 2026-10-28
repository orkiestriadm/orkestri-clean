"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Wallet, Search, RefreshCw, Gift, Link2, Check, X, AlertTriangle, FilterX } from "lucide-react";

/**
 * Billing do Super Admin: quem paga, quem não paga, quem está no teste.
 *
 * O estado de cada conta vem PRONTO do backend, derivado das mesmas funções
 * que barram a pessoa no login. A tela não recalcula nada — se ela tivesse a
 * sua própria regra de "inadimplente", mais cedo ou mais tarde diria uma coisa
 * enquanto a porta do sistema diz outra.
 */

type Conta = {
  id: string; nome: string; email: string; whatsapp: string | null;
  organizacao: string | null; produto: string;
  estado: "EM_DIA" | "EM_TESTE" | "INADIMPLENTE" | "ENCERRADO" | "FORA_DO_CICLO";
  fase: string | null; venceEm: string | null;
  criadoEm: string; clienteDesde: string | null; renovacaoAuto: boolean;
  ultimoPagamento: { pagoEm: string | null; valorCentavos: number; meio: string | null } | null;
  cobrancaPendente: { ciclo: string; meio: string | null; expiraEm: string | null } | null;
  totalPagoCentavos: number;
};

type Painel = {
  valorMensalLabel: string;
  resumo: {
    emDia: number; emTeste: number; inadimplentes: number; encerrados: number;
    foraDoCiclo: number; noCartao: number; recebidoCentavos: number;
  };
  contas: Conta[];
};

const ESTADOS: { id: Conta["estado"]; label: string; cor: string }[] = [
  { id: "EM_DIA",        label: "Em dia",          cor: "#22c55e" },
  { id: "EM_TESTE",      label: "Em teste",        cor: "#f97316" },
  { id: "INADIMPLENTE",  label: "Inadimplentes",   cor: "#ef4444" },
  { id: "ENCERRADO",     label: "Encerrados",      cor: "#a1a1aa" },
  { id: "FORA_DO_CICLO", label: "Fora do ciclo",   cor: "#8b5cf6" },
];

const campo = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]";
const botao = campo + " inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40";
const primary = botao + " !bg-orange-500 !border-orange-500 !text-white";
const panel = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const rotulo = (e: Conta["estado"]) => ESTADOS.find(s => s.id === e)?.label ?? e;
const cor = (e: Conta["estado"]) => ESTADOS.find(s => s.id === e)?.cor ?? "var(--text-muted)";

export default function BillingPainel() {
  const { user } = useAuthStore();
  const [dados, setDados] = useState<Painel | null>(null);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<"" | Conta["estado"]>("");
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [cortesia, setCortesia] = useState<Conta | null>(null);
  const [meses, setMeses] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [erroModal, setErroModal] = useState("");

  const erro = (e: any) => {
    const m = e?.response?.data?.message;
    return Array.isArray(m) ? m.join(" · ") : String(m || e?.message || "Não foi possível concluir.");
  };

  const carregar = useCallback(async () => {
    try { const r = await api.get("/superadmin/billing"); setDados(r.data); }
    catch (e) { setFeedback(erro(e)); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (user?.isSuperAdmin) void carregar(); }, [user?.isSuperAdmin, carregar]);

  const contas = dados?.contas ?? [];
  const filtradas = useMemo(() => contas.filter(c =>
    (!estado || c.estado === estado) &&
    `${c.nome} ${c.email} ${c.organizacao ?? ""} ${c.whatsapp ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  ), [contas, estado, busca]);

  async function confirmarCortesia() {
    if (!cortesia) return; setBusy(true); setErroModal("");
    try {
      const r = await api.post(`/superadmin/billing/${cortesia.id}/cortesia`, { meses, motivo: motivo.trim() || undefined });
      setCortesia(null); setMotivo(""); setMeses(1); await carregar();
      setFeedback(`${r.data.meses} mês(es) liberados para ${cortesia.nome}, sem cobrança. Acesso até ${dia(r.data.validaAte)}.`);
    } catch (e) { setErroModal(erro(e)); } finally { setBusy(false); }
  }

  async function copiarLink(c: Conta) {
    try {
      const r = await api.get(`/superadmin/billing/${c.id}/link`);
      await navigator.clipboard.writeText(r.data.link);
      setFeedback(`Link de pagamento de ${c.nome} copiado.`);
    } catch (e) { setFeedback(erro(e)); }
  }

  if (!user?.isSuperAdmin) return <div className="p-8">Acesso exclusivo do Super Admin.</div>;

  return <><Topbar>Billing</Topbar>
    <main aria-label="Painel de billing" tabIndex={0} className="flex-1 min-h-0 w-full overflow-y-auto p-4 md:p-8 space-y-5 max-w-[1600px] mx-auto text-[var(--text-primary)]">
      <header className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-orange-500 mb-2">Plataforma / Billing</p>
          <h1 className="text-3xl font-semibold">Quem está pagando</h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Mensalidade única de <strong>{dados?.valorMensalLabel ?? "R$ 11,90"}</strong>, com todos os módulos. Não há planos.
          </p>
        </div>
        <button className={botao} onClick={() => void carregar()}><RefreshCw size={15} /> Atualizar</button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ESTADOS.map(s => {
          const ativo = estado === s.id;
          const n = contas.filter(c => c.estado === s.id).length;
          return <button key={s.id} type="button" aria-pressed={ativo} onClick={() => setEstado(ativo ? "" : s.id)}
            className={panel + " p-4 text-left transition " + (ativo ? "!border-orange-500 bg-orange-500/5" : "hover:border-orange-500/40")}>
            <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
            <p className="text-3xl font-semibold mt-2" style={{ color: n ? s.cor : "var(--text-muted)" }}>{n}</p>
          </button>;
        })}
        <div className={panel + " p-4"}>
          <p className="text-xs text-[var(--text-muted)]">Recebido até hoje</p>
          <p className="text-3xl font-semibold mt-2">{reais(dados?.resumo.recebidoCentavos ?? 0)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{dados?.resumo.noCartao ?? 0} no cartão</p>
        </div>
      </div>

      {feedback && <div role="status" className={campo + " border-orange-500/50 flex justify-between gap-3"}>
        <span>{feedback}</span><button onClick={() => setFeedback("")} aria-label="Fechar aviso"><X size={16} /></button>
      </div>}

      <section className={panel + " p-4 space-y-4"}>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search size={17} />
            <input aria-label="Buscar conta" className={campo + " w-full"} placeholder="Buscar nome, e-mail, organização ou WhatsApp"
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <span className="text-xs text-[var(--text-muted)]">{filtradas.length} de {contas.length}</span>
          {(busca || estado) && <button className={botao + " !py-1 text-xs"} onClick={() => { setBusca(""); setEstado(""); }}><FilterX size={13} /> Limpar</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs text-[var(--text-muted)]">
              <tr><th className="p-2">Conta</th><th className="p-2">Organização</th><th className="p-2">Situação</th>
                <th className="p-2">Vence em</th><th className="p-2">Último pagamento</th><th className="p-2">Total pago</th><th className="p-2">Ações</th></tr>
            </thead>
            <tbody>{filtradas.map(c => <tr key={c.id} className="border-t border-[var(--border-subtle)]">
              <td className="p-3">
                <p className="font-medium">{c.nome}</p>
                <p className="text-xs text-[var(--text-muted)]">{c.email}</p>
                {c.whatsapp && <p className="text-xs text-[var(--text-muted)]">{c.whatsapp}</p>}
              </td>
              <td className="p-2">{c.organizacao || "—"}</td>
              <td className="p-2">
                <span className="font-medium" style={{ color: cor(c.estado) }}>{rotulo(c.estado)}</span>
                {c.renovacaoAuto && <p className="text-xs text-emerald-500 mt-1">Cartão automático</p>}
                {c.cobrancaPendente && <p className="text-xs text-amber-500 mt-1">Cobrança aberta ({c.cobrancaPendente.ciclo})</p>}
              </td>
              <td className="p-2">{dia(c.venceEm)}</td>
              <td className="p-2">{c.ultimoPagamento
                ? <><p>{reais(c.ultimoPagamento.valorCentavos)}</p><p className="text-xs text-[var(--text-muted)]">{dia(c.ultimoPagamento.pagoEm)} · {c.ultimoPagamento.meio ?? "—"}</p></>
                : <span className="text-[var(--text-muted)]">Nunca pagou</span>}</td>
              <td className="p-2">{reais(c.totalPagoCentavos)}</td>
              <td className="p-2"><div className="flex gap-2">
                <button className={botao} aria-label={"Liberar acesso para " + c.nome} onClick={() => { setErroModal(""); setCortesia(c); }}><Gift size={14} /> Liberar</button>
                <button className={botao} aria-label={"Copiar link de pagamento de " + c.nome} onClick={() => void copiarLink(c)}><Link2 size={14} /></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>

        {!filtradas.length && <div className="text-center py-14 space-y-3 text-[var(--text-muted)]">
          <Wallet className="mx-auto" size={30} />
          <p>{carregando ? "Carregando contas…" : "Nenhuma conta nesta situação."}</p>
        </div>}
      </section>

      {cortesia && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3">
        <section role="dialog" aria-modal="true" aria-label="Liberar acesso sem cobrança" className={panel + " p-5 max-w-lg w-full space-y-4"}>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Gift size={20} className="text-orange-500 shrink-0" /> Liberar acesso para {cortesia.nome}</h2>
          {erroModal && <p role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{erroModal}</p>}
          <p className="text-sm">
            O acesso é estendido <strong>sem cobrança</strong>, contando do vencimento atual ({dia(cortesia.venceEm)}).
            A pessoa recebe a confirmação no WhatsApp, igual a quem paga.
          </p>
          <label className="block text-sm">Por quantos meses?
            <select className={campo + " block w-full mt-1"} value={meses} onChange={e => setMeses(Number(e.target.value))}>
              {[1, 2, 3, 6, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? "mês" : "meses"}</option>)}
            </select>
          </label>
          <label className="block text-sm">Motivo (fica no registro)
            <input className={campo + " block w-full mt-1"} maxLength={500} placeholder="ex.: cliente desde o começo"
              value={motivo} onChange={e => setMotivo(e.target.value)} />
          </label>
          <p className="text-xs text-[var(--text-muted)] flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Fica registrado como cobrança de valor zero, com o meio “cortesia” — aparece no histórico como qualquer pagamento.
          </p>
          <div className="flex justify-end gap-2">
            <button disabled={busy} className={botao} onClick={() => setCortesia(null)}>Cancelar</button>
            <button disabled={busy} className={primary} onClick={() => void confirmarCortesia()}><Check size={15} /> {busy ? "Liberando…" : "Liberar acesso"}</button>
          </div>
        </section>
      </div>}
    </main></>;
}
