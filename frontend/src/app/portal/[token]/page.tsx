"use client";
import { useEffect, useState, use } from "react";
import axios from "axios";
import {
  Headphones, Plus, X, Check, Clock, AlertTriangle,
  ChevronRight, Send, Star, FileText, Receipt,
  CheckCircle2, AlertCircle, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Uses its own axios instance with no auth interceptors
const BASE = typeof window !== "undefined" ? window.location.origin + "/api" : "http://localhost/api";
const portalApi = axios.create({ baseURL: BASE });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Cliente { id: string; nome: string; empresa?: string; email?: string; saudeScore?: number; }
interface Chamado {
  id: string; numero: number; titulo: string; status: string;
  prioridade: string; categoria?: string; criadoEm: string;
  resolvidoEm?: string; avaliacao?: number;
  atendente?: { nome: string };
}
interface Stats { total: number; abertos: number; resolvidos: number; }
interface Contrato {
  id: string; numero?: number; titulo: string; tipo?: string; status: string;
  vigenciaInicio?: string; vigenciaFim?: string; valor?: number;
  slaHoras?: number; plano?: string;
}
interface Fatura {
  id: string; numero: number; descricao?: string; valor: number;
  dataEmissao: string; dataVencimento: string; dataPagamento?: string;
  status: string; statusComputado: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto", em_atendimento: "Em atendimento", aguardando: "Aguardando",
  resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  aberto: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_atendimento: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  aguardando: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  resolvido: "bg-green-500/15 text-green-400 border-green-500/30",
  fechado: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  cancelado: "bg-red-500/15 text-red-400 border-red-500/30",
};
const PRIO_COLOR: Record<string, string> = {
  urgente: "text-red-400", alta: "text-orange-400", media: "text-yellow-400", baixa: "text-blue-400",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtCur(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FATURA_STATUS: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30"  },
  pago:      { label: "Pago",      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  vencido:   { label: "Vencido",   cls: "bg-red-500/10 text-red-400 border-red-500/30"       },
  cancelado: { label: "Cancelado", cls: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

const CONTRATO_STATUS: Record<string, string> = {
  ativo: "bg-green-500/10 text-green-400 border-green-500/30",
  EM_ANDAMENTO: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  CONCLUIDO: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  CANCELADO: "bg-red-500/10 text-red-400 border-red-500/30",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", STATUS_COLOR[status] || STATUS_COLOR.aberto)}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────
function NovoModal({
  token, onClose, onCreated,
}: { token: string; onClose: () => void; onCreated: (c: any) => void }) {
  const [form, setForm] = useState({
    titulo: "", descricao: "", categoria: "", prioridade: "media",
    nomeContato: "", emailContato: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) { setError("Título e descrição são obrigatórios"); return; }
    setLoading(true); setError("");
    try {
      const { data } = await portalApi.post(`/portal/${token}/chamado`, form);
      onCreated(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao abrir chamado");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">Abrir novo chamado</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Seu nome (opcional)</label>
            <input
              value={form.nomeContato}
              onChange={e => set("nomeContato", e.target.value)}
              placeholder="João Silva"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Seu e-mail (opcional)</label>
            <input
              type="email"
              value={form.emailContato}
              onChange={e => set("emailContato", e.target.value)}
              placeholder="joao@empresa.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Título <span className="text-red-400">*</span></label>
            <input
              value={form.titulo}
              onChange={e => set("titulo", e.target.value)}
              placeholder="Descreva o problema em poucas palavras"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Descrição detalhada <span className="text-red-400">*</span></label>
            <textarea
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              rows={4}
              placeholder="Descreva o problema com detalhes, incluindo passos para reproduzir, mensagens de erro, etc."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Categoria</label>
              <input
                value={form.categoria}
                onChange={e => set("categoria", e.target.value)}
                placeholder="Ex: Sistema, Financeiro..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={e => set("prioridade", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              {loading ? "Enviando..." : "Abrir chamado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────
function SuccessBanner({ chamado, onClose }: { chamado: any; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check size={16} className="text-green-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Chamado #{chamado.numero} aberto com sucesso</div>
          <div className="text-xs text-muted-foreground">{chamado.titulo}</div>
        </div>
      </div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData] = useState<{ cliente: Cliente; chamados: Chamado[]; stats: Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newChamado, setNewChamado] = useState<any>(null);
  const [filter, setFilter] = useState<"todos" | "abertos" | "resolvidos">("todos");
  const [mainTab, setMainTab] = useState<"chamados" | "contratos" | "faturas">("chamados");
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [loadingFaturas, setLoadingFaturas] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: d } = await portalApi.get(`/portal/${token}`);
      setData(d);
    } catch {
      setError("Portal não encontrado ou inativo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadContratos() {
    if (contratos.length) return;
    setLoadingContratos(true);
    try {
      const { data: d } = await portalApi.get(`/portal/${token}/contratos`);
      setContratos(Array.isArray(d) ? d : []);
    } catch {}
    setLoadingContratos(false);
  }

  async function loadFaturas() {
    if (faturas.length) return;
    setLoadingFaturas(true);
    try {
      const { data: d } = await portalApi.get(`/portal/${token}/faturas`);
      setFaturas(Array.isArray(d) ? d : []);
    } catch {}
    setLoadingFaturas(false);
  }

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (mainTab === "contratos") loadContratos();
    if (mainTab === "faturas")   loadFaturas();
  }, [mainTab]);

  function handleCreated(c: any) {
    setNewChamado(c);
    setShowModal(false);
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Portal não encontrado</h1>
          <p className="text-sm text-muted-foreground">{error || "Link inválido ou expirado."}</p>
        </div>
      </div>
    );
  }

  const { cliente, chamados, stats } = data;

  const filtered = chamados.filter(c => {
    if (filter === "abertos")    return ["aberto","em_atendimento","aguardando"].includes(c.status);
    if (filter === "resolvidos") return ["resolvido","fechado"].includes(c.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Headphones size={16} className="text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{cliente.empresa || cliente.nome}</div>
              <div className="text-[10px] text-muted-foreground font-mono tracking-wide uppercase">Portal de Atendimento</div>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            Novo chamado
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Success banner */}
        {newChamado && <SuccessBanner chamado={newChamado} onClose={() => setNewChamado(null)} />}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Headphones, color: "text-foreground" },
            { label: "Em aberto", value: stats.abertos, icon: Clock, color: "text-yellow-400" },
            { label: "Resolvidos", value: stats.resolvidos, icon: Check, color: "text-green-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </div>
          ))}
        </div>

        {/* Main section tabs */}
        <div className="flex gap-1 border-b border-border">
          {[
            { id: "chamados",  label: `Chamados (${stats.total})`, icon: Headphones },
            { id: "contratos", label: "Contratos", icon: FileText },
            { id: "faturas",   label: "Faturas",   icon: Receipt },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  mainTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── CHAMADOS TAB ── */}
        {mainTab === "chamados" && (
          <>
            {/* Sub-filter */}
            <div className="flex gap-1">
              {(["todos","abertos","resolvidos"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    filter === f
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "todos" ? `Todos (${stats.total})` : f === "abertos" ? `Em aberto (${stats.abertos})` : `Resolvidos (${stats.resolvidos})`}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Headphones size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">
                  {filter === "todos" ? "Nenhum chamado encontrado." : `Nenhum chamado ${filter}.`}
                </p>
                <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-primary hover:underline">
                  Abrir primeiro chamado
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(c => (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">#{c.numero}</span>
                          <Badge status={c.status} />
                          {c.prioridade !== "media" && (
                            <span className={cn("text-[10px] font-medium uppercase", PRIO_COLOR[c.prioridade])}>
                              {c.prioridade}
                            </span>
                          )}
                          {c.avaliacao && (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                              <Star size={10} className="fill-yellow-400" />
                              {c.avaliacao}/5
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-foreground truncate">{c.titulo}</div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>{fmt(c.criadoEm)}</span>
                          {c.categoria && <span>· {c.categoria}</span>}
                          {c.atendente && <span>· {c.atendente.nome}</span>}
                          {c.resolvidoEm && <span className="text-green-400">· Resolvido {fmt(c.resolvidoEm)}</span>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CONTRATOS TAB ── */}
        {mainTab === "contratos" && (
          loadingContratos ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contratos.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhum contrato ativo no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contratos.map(c => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {c.numero && <span className="text-[11px] font-mono text-muted-foreground">#{c.numero}</span>}
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo)}>
                          {c.status}
                        </span>
                        {c.plano && (
                          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                            {c.plano}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-foreground">{c.titulo}</div>
                      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
                        {c.tipo && <span>{c.tipo}</span>}
                        {c.valor != null && <span className="font-semibold text-foreground">{fmtCur(c.valor)}/mês</span>}
                        {c.vigenciaFim && <span>· Vigência até {fmtDate(c.vigenciaFim)}</span>}
                        {c.slaHoras && <span>· SLA {c.slaHoras}h</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── FATURAS TAB ── */}
        {mainTab === "faturas" && (
          loadingFaturas ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : faturas.length === 0 ? (
            <div className="text-center py-16">
              <Receipt size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {faturas.map(f => {
                const st = FATURA_STATUS[f.statusComputado] || FATURA_STATUS.pendente;
                return (
                  <div key={f.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">#{f.numero}</span>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", st.cls)}>{st.label}</span>
                        </div>
                        <div className="text-sm font-medium text-foreground">{f.descricao || `Fatura #${f.numero}`}</div>
                        <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span>Vencimento: {fmtDate(f.dataVencimento)}</span>
                          {f.dataPagamento && <span className="text-emerald-400">· Pago em {fmtDate(f.dataPagamento)}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-foreground font-mono">{fmtCur(f.valor)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <p className="text-center text-[11px] text-muted-foreground pb-6">
          Portal de atendimento · Orkestri
        </p>
      </main>

      {showModal && (
        <NovoModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
