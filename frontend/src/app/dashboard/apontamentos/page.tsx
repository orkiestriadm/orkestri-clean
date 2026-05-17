"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Clock, Plus, Trash2, ChevronDown, ChevronUp, BarChart2, Users, Ticket, Calendar } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

type Apontamento = {
  id: string;
  chamadoId: string;
  userId: string;
  minutos: number;
  descricao: string | null;
  data: string;
  user: { id: string; nome: string; avatar?: string };
  chamado: { id: string; numero: number; titulo: string };
};

type RelatorioData = {
  totalMinutos: number;
  totalHoras: number;
  totalRegistros: number;
  porUsuario: { userId: string; nome: string; totalMinutos: number; qtd: number }[];
  porChamado: { chamadoId: string; numero: number; titulo: string; totalMinutos: number; qtd: number }[];
  registros: Apontamento[];
};

function minToH(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min > 0 ? min + "min" : ""}`.trim() : `${min}min`;
}

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Novo Apontamento Modal ────────────────────────────────────────────────────
function NovoApontamentoModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    chamadoId: "",
    chamadoSearch: "",
    horas: "0",
    minutos: "30",
    descricao: "",
    data: today(),
  });
  const [chamados, setChamados] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (form.chamadoSearch.length < 2) { setChamados([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/chamados?limit=20&search=" + encodeURIComponent(form.chamadoSearch));
        setChamados(Array.isArray(data) ? data : data.data || []);
        setShowDropdown(true);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [form.chamadoSearch]);

  const submit = async () => {
    const totalMin = Number(form.horas) * 60 + Number(form.minutos);
    if (!form.chamadoId) { setErr("Selecione um chamado"); return; }
    if (totalMin <= 0)    { setErr("Informe ao menos 1 minuto"); return; }
    setSaving(true);
    try {
      await api.post("/apontamentos", {
        chamadoId: form.chamadoId,
        minutos:   totalMin,
        descricao: form.descricao || null,
        data:      form.data,
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <h2 className="font-semibold text-base text-foreground">Apontar Horas</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Chamado search */}
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Chamado *</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="Buscar chamado..."
              value={form.chamadoSearch}
              onChange={e => { setForm(f => ({ ...f, chamadoSearch: e.target.value, chamadoId: "" })); }}
            />
            {showDropdown && chamados.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {chamados.map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent border-b border-border/50 last:border-0"
                    onClick={() => {
                      setForm(f => ({ ...f, chamadoId: c.id, chamadoSearch: `#${c.numero} ${c.titulo}` }));
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-mono text-primary mr-2">#{c.numero}</span>
                    {c.titulo}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tempo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tempo *</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number" min="0" max="99"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:border-primary"
                  value={form.horas}
                  onChange={e => setForm(f => ({ ...f, horas: e.target.value }))}
                />
                <div className="text-[10px] text-muted-foreground text-center mt-1">horas</div>
              </div>
              <div className="flex items-center text-muted-foreground text-lg pb-4">:</div>
              <div className="flex-1">
                <input
                  type="number" min="0" max="59"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:border-primary"
                  value={form.minutos}
                  onChange={e => setForm(f => ({ ...f, minutos: e.target.value }))}
                />
                <div className="text-[10px] text-muted-foreground text-center mt-1">minutos</div>
              </div>
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
            <input
              type="date"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <textarea
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
              placeholder="O que foi feito nesse período..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="p-5 flex flex-col gap-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-mono tracking-[0.08em]">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", color)}>
          <Icon size={15} />
        </div>
      </div>
      <div className="font-display text-3xl font-bold text-foreground leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApontamentosPage() {
  const { user } = useAuthStore();
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [from, setFrom] = useState(monthStart());
  const [to,   setTo]   = useState(today());
  const [filterUser, setFilterUser] = useState("");
  const [activeTab, setActiveTab] = useState<"registros" | "usuarios" | "chamados">("registros");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from)       params.set("from", from);
      if (to)         params.set("to",   to);
      if (filterUser) params.set("userId", filterUser);
      const { data } = await api.get("/apontamentos/relatorio?" + params.toString());
      setRelatorio(data);
    } catch {
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, filterUser]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este apontamento?")) return;
    try {
      await api.delete("/apontamentos/" + id);
      load();
    } catch {}
  };

  const tabs = [
    { key: "registros", label: "Registros", icon: Clock },
    { key: "usuarios",  label: "Por Usuário", icon: Users },
    { key: "chamados",  label: "Por Chamado", icon: Ticket },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Apontar Horas
        </button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">De</label>
          <input
            type="date"
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Até</label>
          <input
            type="date"
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setFrom(monthStart()); setTo(today()); }} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-accent">Mês atual</button>
          <button onClick={() => {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
            const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
            setFrom(`${y}-${m}-01`);
            const last = new Date(y, d.getMonth() + 1, 0);
            setTo(`${y}-${m}-${String(last.getDate()).padStart(2, "0")}`);
          }} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-accent">Mês anterior</button>
        </div>
      </div>

      {/* Stats */}
      {relatorio && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Clock}    label="TOTAL DE HORAS"  value={minToH(relatorio.totalMinutos)} sub={`${relatorio.totalMinutos}min totais`} color="text-primary bg-primary/10 border-primary/20" />
          <StatCard icon={BarChart2} label="REGISTROS"       value={relatorio.totalRegistros}       color="text-blue-400 bg-blue-500/10 border-blue-500/20" />
          <StatCard icon={Users}    label="COLABORADORES"    value={relatorio.porUsuario.length}    color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" />
          <StatCard icon={Ticket}   label="CHAMADOS"         value={relatorio.porChamado.length}    color="text-amber-400 bg-amber-500/10 border-amber-500/20" />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        )}

        {!loading && !relatorio && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Nenhum dado encontrado
          </div>
        )}

        {!loading && relatorio && (
          <>
            {/* Registros */}
            {activeTab === "registros" && (
              <div className="divide-y divide-border">
                {relatorio.registros.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                    Nenhum apontamento no período
                  </div>
                )}
                {relatorio.registros.map(ap => (
                  <div key={ap.id} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {ap.user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{ap.user.nome}</span>
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">#{ap.chamado.numero}</span>
                        <span className="text-xs text-muted-foreground truncate">{ap.chamado.titulo}</span>
                      </div>
                      {ap.descricao && <div className="text-xs text-muted-foreground mt-0.5 truncate">{ap.descricao}</div>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">{minToH(ap.minutos)}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(ap.data).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      {(ap.userId === user?.id || user?.isMaster) && (
                        <button
                          onClick={() => handleDelete(ap.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Por Usuário */}
            {activeTab === "usuarios" && (
              <div className="divide-y divide-border">
                {relatorio.porUsuario.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                    Nenhum dado
                  </div>
                )}
                {relatorio.porUsuario.map((u, i) => {
                  const pct = relatorio.totalMinutos > 0 ? (u.totalMinutos / relatorio.totalMinutos) * 100 : 0;
                  return (
                    <div key={u.userId}>
                      <button
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-accent/30 text-left"
                        onClick={() => setExpanded(e => ({ ...e, [u.userId]: !e[u.userId] }))}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{u.nome}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden w-full max-w-xs">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{minToH(u.totalMinutos)}</div>
                          <div className="text-[10px] text-muted-foreground">{u.qtd} registro{u.qtd !== 1 ? "s" : ""} · {pct.toFixed(0)}%</div>
                        </div>
                        {expanded[u.userId] ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </button>
                      {expanded[u.userId] && (
                        <div className="px-5 pb-3 divide-y divide-border/50 bg-accent/10">
                          {relatorio.registros.filter(r => r.userId === u.userId).map(r => (
                            <div key={r.id} className="flex items-center gap-3 py-2 text-xs">
                              <span className="font-mono text-primary">#{r.chamado.numero}</span>
                              <span className="flex-1 text-muted-foreground truncate">{r.chamado.titulo}</span>
                              {r.descricao && <span className="text-muted-foreground/70 truncate max-w-[180px]">{r.descricao}</span>}
                              <span className="font-medium text-foreground">{minToH(r.minutos)}</span>
                              <span className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Por Chamado */}
            {activeTab === "chamados" && (
              <div className="divide-y divide-border">
                {relatorio.porChamado.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                    Nenhum dado
                  </div>
                )}
                {relatorio.porChamado.map(c => {
                  const pct = relatorio.totalMinutos > 0 ? (c.totalMinutos / relatorio.totalMinutos) * 100 : 0;
                  return (
                    <div key={c.chamadoId}>
                      <button
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-accent/30 text-left"
                        onClick={() => setExpanded(e => ({ ...e, [c.chamadoId]: !e[c.chamadoId] }))}
                      >
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded flex-shrink-0">#{c.numero}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{c.titulo}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden w-full max-w-xs">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{minToH(c.totalMinutos)}</div>
                          <div className="text-[10px] text-muted-foreground">{c.qtd} registro{c.qtd !== 1 ? "s" : ""}</div>
                        </div>
                        {expanded[c.chamadoId] ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </button>
                      {expanded[c.chamadoId] && (
                        <div className="px-5 pb-3 divide-y divide-border/50 bg-accent/10">
                          {relatorio.registros.filter(r => r.chamadoId === c.chamadoId).map(r => (
                            <div key={r.id} className="flex items-center gap-3 py-2 text-xs">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {r.user.nome.charAt(0)}
                              </div>
                              <span className="flex-1 text-foreground">{r.user.nome}</span>
                              {r.descricao && <span className="text-muted-foreground/70 truncate max-w-[200px]">{r.descricao}</span>}
                              <span className="font-medium text-foreground">{minToH(r.minutos)}</span>
                              <span className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showNovo && (
        <NovoApontamentoModal
          onClose={() => setShowNovo(false)}
          onSaved={() => { setShowNovo(false); load(); }}
        />
      )}
    </div>
    </div>
  );
}
