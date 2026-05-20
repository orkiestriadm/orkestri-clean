"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { FileText, Plus, Pencil, Trash2, Search, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Topbar from "@/components/layout/Topbar";

type Contrato = {
  id: string; numero: number; titulo: string;
  clienteId: string; tipo: string; plano: string | null; status: string; statusComputado: string;
  slaHoras: number | null; vigenciaInicio: string | null; vigenciaFim: string | null;
  valor: number | null; responsavelId: string | null; ativo: boolean; observacoes: string | null;
  criadoEm: string;
  cliente: { id: string; nome: string; empresa: string | null };
  responsavel: { id: string; nome: string } | null;
};

type Stats = { total: number; vigentes: number; vencendo: number; vencidos: number; suspensos: number; valorTotal: number };
type Anexo = { id: string; nome: string; url: string; tamanho: number | null; tipo: string | null; criadoEm: string };

const TIPOS    = ["servico","manutencao","suporte","licenca","consultoria","outro"];
const STATUSES = ["vigente","vencendo","vencido","suspenso","rescindido"];

function statusBadge(s: string) {
  switch (s) {
    case "vigente":    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "vencendo":   return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "vencido":    return "bg-red-500/10 text-red-400 border-red-500/20";
    case "suspenso":   return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    case "rescindido": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default:           return "bg-muted text-muted-foreground border-border";
  }
}

function statusIcon(s: string) {
  switch (s) {
    case "vigente":    return <CheckCircle size={12} className="text-emerald-400" />;
    case "vencendo":   return <AlertTriangle size={12} className="text-amber-400" />;
    case "vencido":    return <XCircle size={12} className="text-red-400" />;
    case "suspenso":   return <Clock size={12} className="text-slate-400" />;
    case "rescindido": return <XCircle size={12} className="text-rose-400" />;
    default: return null;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtMoney(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantes(vigenciaFim: string | null) {
  if (!vigenciaFim) return null;
  const diff = Math.ceil((new Date(vigenciaFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border", color)}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xl font-bold text-foreground font-display">{value}</div>
        <div className="text-[11px] text-muted-foreground font-mono tracking-[0.08em] uppercase">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
      </div>
    </div>
  );
}

// ── ContratoForm ──────────────────────────────────────────────────────────────
function ContratoForm({
  initial, clientes, users, onSave, onCancel, saving,
}: {
  initial?: Partial<Contrato>;
  clientes: { id: string; nome: string; empresa: string | null }[];
  users: { id: string; nome: string }[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    titulo:         initial?.titulo         || "",
    clienteId:      initial?.clienteId      || "",
    tipo:           initial?.tipo           || "servico",
    plano:          initial?.plano          || "",
    status:         initial?.status         || "vigente",
    slaHoras:       String(initial?.slaHoras  ?? ""),
    vigenciaInicio: initial?.vigenciaInicio ? initial.vigenciaInicio.slice(0,10) : "",
    vigenciaFim:    initial?.vigenciaFim    ? initial.vigenciaFim.slice(0,10)    : "",
    valor:          String(initial?.valor   ?? ""),
    responsavelId:  initial?.responsavelId  || "",
    observacoes:    initial?.observacoes    || "",
  });

  const F = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">{initial?.id ? "Editar Contrato" : "Novo Contrato"}</h2>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {/* Título */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.titulo} onChange={F("titulo")} placeholder="Ex: Contrato de Suporte Anual" />
          </div>
          {/* Cliente */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
            <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.clienteId} onChange={F("clienteId")}>
              <option value="">Selecionar...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ""}</option>)}
            </select>
          </div>
          {/* Tipo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.tipo} onChange={F("tipo")}>
              {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          {/* Plano */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Plano / Nível</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.plano} onChange={F("plano")} placeholder="Ex: Platinum, Gold..." />
          </div>
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.status} onChange={F("status")}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          {/* Início vigência */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Início da Vigência</label>
            <input type="date" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.vigenciaInicio} onChange={F("vigenciaInicio")} />
          </div>
          {/* Fim vigência */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim da Vigência</label>
            <input type="date" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.vigenciaFim} onChange={F("vigenciaFim")} />
          </div>
          {/* Valor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor (R$)</label>
            <input type="number" min="0" step="0.01" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.valor} onChange={F("valor")} placeholder="0,00" />
          </div>
          {/* SLA Horas */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">SLA (horas)</label>
            <input type="number" min="0" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.slaHoras} onChange={F("slaHoras")} placeholder="Ex: 8" />
          </div>
          {/* Responsável */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsável</label>
            <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.responsavelId} onChange={F("responsavelId")}>
              <option value="">Nenhum</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          {/* Observações */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
            <textarea rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary"
              value={form.observacoes} onChange={F("observacoes")} placeholder="Detalhes adicionais..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 pt-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AnexosModal ───────────────────────────────────────────────────────────────
function AnexosModal({ contrato, onClose }: { contrato: Contrato; onClose: () => void }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/contratos/${contrato.id}/anexos`); setAnexos(r.data); }
    catch {} finally { setLoading(false); }
  }, [contrato.id]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/contratos/${contrato.id}/anexos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
    } catch (ex: any) { setErr(ex?.response?.data?.message || "Erro ao enviar arquivo"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const remove = async (anexoId: string) => {
    if (!confirm("Remover este anexo?")) return;
    try { await api.delete(`/contratos/${contrato.id}/anexos/${anexoId}`); load(); }
    catch {}
  };

  const fmtSize = (b: number | null) => {
    if (!b) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Anexos do Contrato</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{contrato.titulo || `CT-${String(contrato.numero).padStart(4, "0")}`}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

          {/* Upload area */}
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors">
            {uploading ? (
              <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            ) : (
              <Plus size={20} className="text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">{uploading ? "Enviando..." : "Clique para anexar um arquivo"}</span>
            <input type="file" className="hidden" onChange={upload} disabled={uploading} />
          </label>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-4 text-muted-foreground text-sm">Carregando...</div>
          ) : anexos.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">Nenhum anexo ainda</div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {anexos.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-3">
                  <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{a.nome}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{fmtSize(a.tamanho)} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={`${process.env.NEXT_PUBLIC_API_URL || ""}${a.url}`} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Download">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                    <button onClick={() => remove(a.id)}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RenovarModal ─────────────────────────────────────────────────────────────
function RenovarModal({ contrato, onClose, onRenovado }: { contrato: Contrato; onClose: () => void; onRenovado: () => void }) {
  const nextYear = (d: string | null) => {
    if (!d) return "";
    const dt = new Date(d);
    dt.setFullYear(dt.getFullYear() + 1);
    return dt.toISOString().slice(0,10);
  };
  const [inicio, setInicio] = useState(contrato.vigenciaFim ? contrato.vigenciaFim.slice(0,10) : "");
  const [fim,    setFim]    = useState(nextYear(contrato.vigenciaFim));
  const [valor,  setValor]  = useState(String(contrato.valor ?? ""));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/contratos/${contrato.id}/renovar`, { vigenciaInicio: inicio, vigenciaFim: fim, valor: valor ? Number(valor) : undefined });
      onRenovado();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Renovar Contrato</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{contrato.titulo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Início da nova vigência</label>
              <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Fim da nova vigência</label>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Valor (opcional)</label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Mesmo valor se vazio"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Renovar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ContratosPage() {
  const { user } = useAuthStore();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [saving, setSaving] = useState(false);
  const [renovando, setRenovando] = useState<Contrato | null>(null);
  const [verAnexos, setVerAnexos] = useState<Contrato | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterTipo)   params.set("tipo",   filterTipo);
      const [cRes, sRes] = await Promise.all([
        api.get("/contratos?" + params.toString()),
        api.get("/contratos/stats"),
      ]);
      setContratos(cRes.data);
      setStats(sRes.data);
    } catch {
      setContratos([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterTipo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      api.get("/clientes?limit=200"),
      api.get("/users?limit=200"),
    ]).then(([cRes, uRes]) => {
      setClientes(Array.isArray(cRes.data) ? cRes.data : cRes.data.data || []);
      setUsers(Array.isArray(uRes.data) ? uRes.data : uRes.data.data || []);
    }).catch(() => {});
  }, []);

  const handleSave = async (form: any) => {
    if (!form.titulo?.trim() || !form.clienteId) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put("/contratos/" + editing.id, form);
      } else {
        await api.post("/contratos", form);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover contrato? Esta ação é irreversível.")) return;
    try {
      await api.delete("/contratos/" + id);
      load();
    } catch {}
  };

  const openEdit = (c: Contrato) => { setEditing(c); setShowForm(true); };
  const openNew  = () => { setEditing(null); setShowForm(true); };

  const topbarActions = (
    <button onClick={openNew}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
      <Plus size={13} /> Novo Contrato
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={FileText}      label="Total"       value={stats.total}    color="bg-primary/10 text-primary border-primary/20" />
          <StatCard icon={CheckCircle}   label="Vigentes"    value={stats.vigentes} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />
          <StatCard icon={AlertTriangle} label="Vencendo"    value={stats.vencendo} color="bg-amber-500/10 text-amber-400 border-amber-500/20" sub="em 30 dias" />
          <StatCard icon={XCircle}       label="Vencidos"    value={stats.vencidos} color="bg-red-500/10 text-red-400 border-red-500/20" />
          <StatCard icon={DollarSign}    label="Valor Total" value={fmtMoney(stats.valorTotal)} color="bg-violet-500/10 text-violet-400 border-violet-500/20" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="Buscar contratos..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">Todos os status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Carregando...</div>
        )}
        {!loading && contratos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileText size={32} className="opacity-30" />
            <p className="text-sm">Nenhum contrato encontrado</p>
            <button onClick={openNew} className="text-primary text-sm hover:underline">Criar primeiro contrato</button>
          </div>
        )}
        {!loading && contratos.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Título / Cliente</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Vigência</th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Valor</th>
                <th className="text-right px-4 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contratos.map(c => {
                const dias = diasRestantes(c.vigenciaFim);
                return (
                  <tr key={c.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground">
                        {c.numero ? `CT-${String(c.numero).padStart(4,"0")}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">{c.titulo || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.cliente.nome}{c.cliente.empresa ? ` · ${c.cliente.empresa}` : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-accent px-2 py-1 rounded text-muted-foreground capitalize">{c.tipo}</span>
                      {c.plano && <div className="text-[10px] text-muted-foreground mt-0.5">{c.plano}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border capitalize", statusBadge(c.statusComputado))}>
                        {statusIcon(c.statusComputado)} {c.statusComputado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-foreground">{fmtDate(c.vigenciaFim)}</div>
                      {dias !== null && dias >= 0 && dias <= 30 && (
                        <div className="text-[10px] text-amber-400 font-medium mt-0.5">{dias}d restantes</div>
                      )}
                      {dias !== null && dias < 0 && (
                        <div className="text-[10px] text-red-400 font-medium mt-0.5">Vencido há {Math.abs(dias)}d</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{fmtMoney(c.valor)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setVerAnexos(c)} title="Anexos"
                          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10">
                          <FileText size={13} />
                        </button>
                        <button onClick={() => setRenovando(c)} title="Renovar contrato"
                          className="p-1.5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10">
                          <RefreshCw size={13} />
                        </button>
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                          <Pencil size={13} />
                        </button>
                        {user?.isMaster && (
                          <button onClick={() => handleDelete(c.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ContratoForm
          initial={editing || undefined}
          clientes={clientes}
          users={users}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          saving={saving}
        />
      )}
      {renovando && (
        <RenovarModal
          contrato={renovando}
          onClose={() => setRenovando(null)}
          onRenovado={() => { setRenovando(null); load(); }}
        />
      )}
      {verAnexos && (
        <AnexosModal
          contrato={verAnexos}
          onClose={() => setVerAnexos(null)}
        />
      )}
      </div>
    </div>
  );
}
