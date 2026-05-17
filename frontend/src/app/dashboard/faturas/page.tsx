"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import CsvImportModal from "@/components/ui/CsvImportModal";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { api } from "@/lib/api";
import {
  Plus, X, Search, Receipt, CheckCircle2, AlertCircle, Clock,
  Ban, DollarSign, FileText, Layers, RefreshCw, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Fatura = {
  id: string; numero: number;
  clienteId: string; contratoId?: string;
  descricao?: string; valor: number;
  dataEmissao: string; dataVencimento: string; dataPagamento?: string;
  status: string; statusComputado: string; observacoes?: string;
  cliente: { id: string; nome: string; empresa?: string };
  contrato?: { id: string; titulo: string; numero?: number };
};
type Stats = { total: number; pendentes: number; pagas: number; vencidas: number; canceladas: number; valorTotal: number; valorPendente: number; valorVencido: number };
type AgingBucket = { bucket: string; label: string; count: number; valor: number };
type Cliente = { id: string; nome: string; empresa?: string };
type Contrato = { id: string; titulo: string; numero?: number; clienteId: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const STATUS_MAP: Record<string, { label: string; icon: any; cls: string; bg: string }> = {
  pendente:  { label: "Pendente",  icon: Clock,         cls: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/30"  },
  pago:      { label: "Pago",      icon: CheckCircle2,  cls: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30"},
  vencido:   { label: "Vencido",   icon: AlertCircle,   cls: "text-red-400",    bg: "bg-red-500/10 border-red-500/30"      },
  cancelado: { label: "Cancelado", icon: Ban,           cls: "text-slate-400",  bg: "bg-slate-500/10 border-slate-500/30"  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pendente;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium", s.cls, s.bg)}>
      <Icon size={10} />
      {s.label}
    </span>
  );
}

// ── Nova Fatura Modal ─────────────────────────────────────────────────────────
function NovaFaturaModal({
  onClose, onCreated, editando,
}: { onClose: () => void; onCreated: () => void; editando?: Fatura }) {
  const [form, setForm] = useState({
    clienteId: editando?.clienteId || "",
    contratoId: editando?.contratoId || "",
    descricao: editando?.descricao || "",
    valor: editando?.valor?.toString() || "",
    dataEmissao: editando?.dataEmissao?.slice(0,10) || new Date().toISOString().slice(0,10),
    dataVencimento: editando?.dataVencimento?.slice(0,10) || "",
    status: editando?.status || "pendente",
    observacoes: editando?.observacoes || "",
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/clientes").then(r => setClientes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/contratos").then(r => setContratos(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const contratosFiltrados = form.clienteId
    ? contratos.filter(c => c.clienteId === form.clienteId)
    : contratos;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clienteId || !form.valor || !form.dataVencimento) {
      setError("Cliente, valor e data de vencimento são obrigatórios");
      return;
    }
    setSaving(true); setError("");
    try {
      if (editando) {
        await api.put(`/faturas/${editando.id}`, { ...form, valor: Number(form.valor), contratoId: form.contratoId || undefined });
      } else {
        await api.post("/faturas", { ...form, valor: Number(form.valor), contratoId: form.contratoId || undefined });
      }
      onCreated(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao salvar fatura");
    } finally {
      setSaving(false);
    }
  }

  const STATUS_OPTIONS = ["pendente", "pago", "cancelado"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{editando ? "Editar Fatura" : "Nova Fatura"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Cliente *</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.clienteId}
                onChange={e => setForm(f => ({ ...f, clienteId: e.target.value, contratoId: "" }))}
              >
                <option value="">Selecionar cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.empresa || c.nome}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Contrato (opcional)</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.contratoId}
                onChange={e => setForm(f => ({ ...f, contratoId: e.target.value }))}
              >
                <option value="">Sem contrato vinculado</option>
                {contratosFiltrados.map(c => <option key={c.id} value={c.id}>{c.titulo}{c.numero ? ` #${c.numero}` : ""}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <input
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                placeholder="Ex: Mensalidade abril/2026, Serviços de suporte..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$) *</label>
              <input
                type="number" step="0.01" min="0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                placeholder="0,00"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_MAP[s]?.label || s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data emissão</label>
              <input type="date"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.dataEmissao}
                onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vencimento *</label>
              <input type="date"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.dataVencimento}
                onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
              <textarea rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 resize-none"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? "Salvando..." : editando ? "Atualizar" : "Criar Fatura"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FaturasPage() {
  const { user } = useAuthStore();
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showNova, setShowNova] = useState(false);
  const [editando, setEditando] = useState<Fatura | undefined>();
  const [pagarId, setPagarId] = useState<string | null>(null);
  const [showLote, setShowLote] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteResult, setLoteResult] = useState<{ geradas: number; ignoradas: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, sRes, aRes] = await Promise.all([
        api.get("/faturas"),
        api.get("/faturas/stats"),
        api.get("/faturas/aging"),
      ]);
      setFaturas(fRes.data);
      setStats(sRes.data);
      setAging(Array.isArray(aRes.data) ? aRes.data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = faturas.filter(f => {
    const matchStatus = filtroStatus === "todos" || f.statusComputado === filtroStatus;
    const q = search.toLowerCase();
    const matchSearch = !search || (
      f.cliente?.nome?.toLowerCase().includes(q) ||
      f.cliente?.empresa?.toLowerCase().includes(q) ||
      f.descricao?.toLowerCase().includes(q) ||
      f.numero?.toString().includes(q)
    );
    return matchStatus && matchSearch;
  });

  async function marcarPago(id: string) {
    try {
      await api.patch(`/faturas/${id}/pagar`);
      useToastStore.getState().success("Fatura marcada como paga");
      load();
    } catch {
      useToastStore.getState().error("Erro", "Não foi possível atualizar");
    }
    setPagarId(null);
  }

  async function deletar(id: string) {
    if (!user?.isMaster) return;
    if (!confirm("Remover esta fatura?")) return;
    try {
      await api.delete(`/faturas/${id}`);
      useToastStore.getState().success("Fatura removida");
      load();
    } catch {}
  }

  async function gerarLote() {
    setGerandoLote(true);
    try {
      const r = await api.post("/faturas/gerar-lote");
      setLoteResult(r.data);
      load();
    } catch (err: any) {
      useToastStore.getState().error("Erro", err?.response?.data?.message || "Falha ao gerar faturas");
    }
    setGerandoLote(false);
  }

  const AGING_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    em_dia:  { label: "Em dia",    color: "text-emerald-400", bg: "bg-emerald-500" },
    "1_30":  { label: "1–30 dias", color: "text-amber-400",   bg: "bg-amber-500"   },
    "31_60": { label: "31–60 dias",color: "text-orange-400",  bg: "bg-orange-500"  },
    "61_90": { label: "61–90 dias",color: "text-red-400",     bg: "bg-red-500"     },
    "90_mais":{ label: "+90 dias", color: "text-red-500",     bg: "bg-red-600"     },
  };

  const FILTROS = [
    { key: "todos",    label: "Todas" },
    { key: "pendente", label: "Pendentes" },
    { key: "vencido",  label: "Vencidas" },
    { key: "pago",     label: "Pagas" },
    { key: "cancelado",label: "Canceladas" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              <Receipt size={20} className="text-primary" /> Faturas
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">Cobranças e pagamentos de clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border text-sm rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            >
              <Layers size={15} /> Importar CSV
            </button>
            <button
              onClick={() => setShowLote(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border text-sm rounded-lg text-muted-foreground hover:bg-accent transition-colors"
            >
              <Zap size={15} /> Gerar em Lote
            </button>
            <button
              onClick={() => { setEditando(undefined); setShowNova(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Nova Fatura
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pendentes", value: stats?.pendentes ?? 0, sub: stats ? fmt(stats.valorPendente) : "—", icon: Clock, cls: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
            { label: "Vencidas",  value: stats?.vencidas ?? 0,  sub: stats ? fmt(stats.valorVencido) : "—",  icon: AlertCircle, cls: "text-red-500 bg-red-500/10 border-red-500/20" },
            { label: "Pagas",     value: stats?.pagas ?? 0,     sub: "este ciclo",                           icon: CheckCircle2, cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
            { label: "Total",     value: stats?.total ?? 0,     sub: stats ? fmt(stats.valorTotal) : "—",    icon: DollarSign, cls: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
          ].map(card => (
            <div key={card.label} className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-mono tracking-[0.08em]">{card.label.toUpperCase()}</span>
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", card.cls)}>
                  <card.icon size={14} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
              <div className="text-[11px] text-muted-foreground">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Aging report */}
        {aging.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Aging de Faturas</span>
              <span className="text-[11px] text-muted-foreground ml-1">— inadimplência por faixa de vencimento</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {aging.map(b => {
                const cfg = AGING_CONFIG[b.bucket] || { label: b.bucket, color: "text-muted-foreground", bg: "bg-muted" };
                const totalValor = aging.reduce((s, x) => s + x.valor, 0);
                const pct = totalValor > 0 ? Math.round(b.valor / totalValor * 100) : 0;
                return (
                  <div key={b.bucket} className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className={cn("text-[10px] font-mono uppercase tracking-wide font-semibold", cfg.color)}>
                      {cfg.label}
                    </div>
                    <div className="text-xl font-bold text-foreground">{b.count}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{fmt(b.valor || 0)}</div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", cfg.bg)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros + busca */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              placeholder="Buscar por cliente, descrição ou número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {FILTROS.map(f => (
              <button key={f.key}
                onClick={() => setFiltroStatus(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  filtroStatus === f.key
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt size={32} className="mx-auto mb-3 text-muted opacity-40" />
              <p className="text-[13px] text-muted-foreground">Nenhuma fatura encontrada</p>
              <button onClick={() => setShowNova(true)}
                className="mt-3 text-[12px] text-primary hover:underline">
                Criar primeira fatura
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">CLIENTE</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">DESCRIÇÃO</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">VALOR</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">VENCIMENTO</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">STATUS</th>
                    <th className="text-left px-4 py-3 text-[11px] font-mono text-muted-foreground">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(f => (
                    <tr key={f.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-[12px] font-mono text-muted-foreground">#{f.numero}</td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-foreground">{f.cliente?.empresa || f.cliente?.nome}</div>
                        {f.cliente?.empresa && <div className="text-[11px] text-muted-foreground">{f.cliente.nome}</div>}
                        {f.contrato && (
                          <div className="text-[10px] text-primary/70 flex items-center gap-1 mt-0.5">
                            <FileText size={10} /> {f.contrato.titulo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground max-w-[200px] truncate">{f.descricao || "—"}</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground font-mono">{fmt(f.valor)}</td>
                      <td className="px-4 py-3">
                        <div className="text-[12px] text-foreground">{fmtDate(f.dataVencimento)}</div>
                        {f.dataPagamento && (
                          <div className="text-[10px] text-emerald-400">Pago: {fmtDate(f.dataPagamento)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.statusComputado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(f.statusComputado === "pendente" || f.statusComputado === "vencido") && (
                            <button
                              onClick={() => setPagarId(f.id)}
                              className="text-[11px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                              Marcar pago
                            </button>
                          )}
                          <button
                            onClick={() => { setEditando(f); setShowNova(true); }}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Editar
                          </button>
                          {user?.isMaster && (
                            <button
                              onClick={() => deletar(f.id)}
                              className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal nova/editar fatura */}
      {showNova && (
        <NovaFaturaModal
          onClose={() => { setShowNova(false); setEditando(undefined); }}
          onCreated={load}
          editando={editando}
        />
      )}

      {/* Confirm pagar */}
      {pagarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold text-foreground mb-2">Confirmar pagamento</h3>
            <p className="text-[13px] text-muted-foreground mb-4">Marcar esta fatura como paga na data de hoje?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPagarId(null)}
                className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button onClick={() => marcarPago(pagarId)}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors">
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gerar em Lote modal */}
      {showLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {loteResult ? (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={24} className="text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-center mb-1">Faturas geradas</h3>
                <p className="text-[13px] text-muted-foreground text-center mb-4">
                  {loteResult.geradas} fatura{loteResult.geradas !== 1 ? "s" : ""} criada{loteResult.geradas !== 1 ? "s" : ""}
                  {loteResult.ignoradas > 0 && ` · ${loteResult.ignoradas} ignorada${loteResult.ignoradas !== 1 ? "s" : ""} (já existiam)`}
                </p>
                <button
                  onClick={() => { setShowLote(false); setLoteResult(null); }}
                  className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Gerar faturas em lote</h3>
                    <p className="text-[11px] text-muted-foreground">Para todos os contratos ativos com valor</p>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground mb-5">
                  Isso irá gerar uma fatura para cada contrato ativo que possui valor configurado, com vencimento em 30 dias a partir de hoje.
                  Contratos que já possuem fatura pendente no mês atual serão ignorados.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowLote(false)}
                    className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={gerarLote}
                    disabled={gerandoLote}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {gerandoLote ? <><RefreshCw size={14} className="animate-spin" /> Gerando...</> : <><Zap size={14} /> Gerar agora</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showImport && <CsvImportModal type="faturas" onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}
