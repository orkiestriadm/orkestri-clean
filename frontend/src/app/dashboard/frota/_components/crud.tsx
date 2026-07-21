"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { 
  History, Plus, Pencil, Trash2, X, Eye,
  Search, Download, ChevronLeft,
  Truck, Users, Disc, CalendarDays, Wrench, FileText, Zap, Settings, HelpCircle
} from "lucide-react";

const TABELA_ICONS: Record<string, any> = {
  veiculos: Truck,
  motoristas: Users,
  motorista: Users,
  pneus: Disc,
  revisoes: CalendarDays,
  revisoes_veiculo: CalendarDays,
  manutencoes_veiculo: Wrench,
  documentos_veiculo: FileText,
  abastecimentos: Zap,
  categorias_veiculo: Settings,
};


// ── Tipos de configuração ──────────────────────────────────────────────────────
export type Option = { value: string; label: string };
export type SourceKey = "veiculos" | "motoristas" | "categorias" | "setores" | "users" | "centrosCusto";
export type FieldType = "text" | "number" | "date" | "textarea" | "select" | "checkbox";

export type Field = {
  key: string; label: string; type?: FieldType;
  options?: Option[]; source?: SourceKey;
  required?: boolean; placeholder?: string; step?: number; full?: boolean;
};
export type Lookups = Record<SourceKey, Option[]>;
export type Column = {
  key: string; label: string;
  render?: (row: any, lk: Lookups) => React.ReactNode;
  align?: "left" | "right" | "center";
};
export type Filter = { key: string; label: string; options?: Option[]; source?: SourceKey };
export type CrudConfig = {
  endpoint: string;   // ex.: "/frota/veiculos"
  tabela: string;     // ex.: "veiculos" (para histórico/auditoria)
  singular: string;   // ex.: "veículo"
  plural: string;     // ex.: "Veículos"
  columns: Column[];
  fields: Field[];
  filters?: Filter[];
  defaults?: Record<string, any>;
  detailHref?: (row: any) => string;   // se definido, mostra ação "abrir detalhe"
  searchPlaceholder?: string; // custom placeholder for search input
};

// ── Helpers visuais ────────────────────────────────────────────────────────────
export const fmtDate  = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
export const fmtMoney = (v?: number | null) => (v != null) ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

// Status da CNH por proximidade de vencimento (compartilhado lista/detalhe)
export function cnhStatus(validade?: string | null, bloqueio = false) {
  if (!validade) return { label: "Sem CNH", color: "var(--text-muted)", dias: null as number | null };
  const dias = Math.ceil((new Date(validade).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: bloqueio ? `Bloqueado (vencida ${-dias}d)` : `Vencida há ${-dias}d`, color: "var(--accent-red)", dias };
  if (dias <= 7) return { label: `Vence em ${dias}d`, color: "var(--accent-red)", dias };
  if (dias <= 30) return { label: `Vence em ${dias}d`, color: "var(--accent-amber)", dias };
  if (dias <= 90) return { label: `Vence em ${dias}d`, color: "#eab308", dias };
  return { label: "Válida", color: "var(--accent-green)", dias };
}
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

export function Badge({ children, color = "var(--text-muted)" }: { children: React.ReactNode; color?: string }) {
  return <span className="badge" style={{ fontSize: 11, background: color + "18", color, border: `1px solid ${color}30` }}>{children}</span>;
}

const SOURCE_EP: Record<SourceKey, string> = {
  veiculos:     "/frota/veiculos",
  motoristas:   "/frota/motoristas",
  categorias:   "/frota/categorias",
  setores:      "/setores",
  users:        "/users",
  centrosCusto: "/orcamento/centros-custo",
};
function sourceLabel(key: SourceKey, row: any): string {
  if (key === "veiculos")     return `${row.placa || row.codigo}${row.modelo ? " — " + row.modelo : ""}${row.descricao ? " · " + String(row.descricao).slice(0, 30) : ""}`;
  if (key === "centrosCusto") return `${row.codigo ? row.codigo + " — " : ""}${row.nome}`;
  return row.nome || row.placa || row.id;
}

// ── Drawer de histórico (alterações + auditoria de usuário) ─────────────────────
export function HistoricoDrawer({ tabela, id, onClose }: { tabela: string; id: string; onClose: () => void }) {
  const [logs, setLogs] = useState<any[] | null>(null);
  useEffect(() => {
    api.get(`/frota/historico/${tabela}/${id}`).then(r => setLogs(r.data)).catch(() => setLogs([]));
  }, [tabela, id]);

  const ACAO: Record<string, { label: string; color: string }> = {
    criar:   { label: "Criação",  color: "var(--accent-green)" },
    editar:  { label: "Edição",   color: "var(--accent-cyan)" },
    excluir: { label: "Exclusão", color: "var(--accent-red)" },
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div className="card" style={{ width: 460, maxWidth: "100%", height: "100%", borderRadius: 0, padding: "20px 22px", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Histórico de alterações</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {logs === null && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Carregando...</div>}
        {logs?.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sem registros de auditoria.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {logs?.map((l) => {
            const a = ACAO[l.acao] || { label: l.acao, color: "var(--text-muted)" };
            return (
              <div key={l.id} className="card" style={{ padding: "12px 14px", borderLeft: `3px solid ${a.color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Badge color={a.color}>{a.label}</Badge>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {new Date(l.criadoEm).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {l.user?.nome || "Sistema"}{l.descricao ? ` — ${l.descricao}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Modal de formulário ─────────────────────────────────────────────────────────
export function FormModal({ config, lookups, initial, onSaved, onClose }: {
  config: CrudConfig; lookups: Lookups; initial: any;
  onSaved: () => void; onClose: () => void;
}) {
  const [d, setD] = useState<any>(initial || { ...config.defaults });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const isEdit = !!initial?.id;

  const optionsFor = (f: Field): Option[] =>
    f.source ? (lookups[f.source] || []) : (f.options || []);

  const save = async () => {
    for (const f of config.fields) {
      if (f.required && (d[f.key] === undefined || d[f.key] === null || String(d[f.key]).trim() === "")) {
        setErr(`Campo obrigatório: ${f.label}`); return;
      }
    }
    setSaving(true); setErr("");
    try {
      if (isEdit) await api.put(`${config.endpoint}/${initial.id}`, d);
      else        await api.post(config.endpoint, d);
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Erro ao salvar"); setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>
            {isEdit ? `Editar ${config.singular}` : `Novo ${config.singular}`}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: "68vh", overflowY: "auto", paddingRight: 4 }}>
          {config.fields.map((f) => {
            const type = f.type || "text";
            const wrap = (child: React.ReactNode) => (
              <div key={f.key} style={f.full || type === "textarea" ? { gridColumn: "1/-1" } : undefined}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {f.label}{f.required ? " *" : ""}
                </label>
                {child}
              </div>
            );
            if (type === "select") return wrap(
              <select className="input-o" value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value || null)}>
                <option value="">—</option>
                {optionsFor(f).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
            if (type === "textarea") return wrap(
              <textarea className="input-o" value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} style={{ minHeight: 80, resize: "vertical" }} placeholder={f.placeholder} />
            );
            if (type === "checkbox") return wrap(
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, paddingTop: 4 }}>
                <input type="checkbox" checked={!!d[f.key]} onChange={e => set(f.key, e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ color: "var(--text-secondary)" }}>{f.placeholder || "Sim"}</span>
              </label>
            );
            if (type === "date") return wrap(
              <input className="input-o" type="date" value={d[f.key] ? String(d[f.key]).slice(0, 10) : ""} onChange={e => set(f.key, e.target.value || null)} />
            );
            if (type === "number") return wrap(
              <input className="input-o" type="number" step={f.step ?? 1} value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value === "" ? null : Number(e.target.value))} placeholder={f.placeholder} />
            );
            return wrap(
              <input className="input-o" value={d[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── CrudView principal ──────────────────────────────────────────────────────────
export default function CrudView({ config, intro }: { config: CrudConfig; intro?: React.ReactNode }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [lookups, setLookups] = useState<Lookups>({ veiculos: [], motoristas: [], categorias: [], setores: [], users: [], centrosCusto: [] });
  const router = useRouter();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [histId, setHistId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const limit = 30;
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit   = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // Carrega listas auxiliares usadas pelos selects do formulário e pelos filtros
  useEffect(() => {
    const used = new Set<SourceKey>();
    config.fields.forEach(f => f.source && used.add(f.source));
    config.filters?.forEach(f => f.source && used.add(f.source));
    used.forEach((key) => {
      api.get(SOURCE_EP[key], { params: { limit: 200 } })
        .then(r => {
          const rows = r.data?.items ?? r.data?.users ?? r.data ?? [];
          setLookups(prev => ({ ...prev, [key]: rows.map((row: any) => ({ value: row.id, label: sourceLabel(key, row) })) }));
        })
        .catch(() => {});
    });
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(config.endpoint, { params: { q, page, limit, ...filterVals } });
      setItems(data.items || []); setTotal(data.total || 0);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [config.endpoint, q, page, filterVals]);

  useEffect(() => { setPage(1); }, [q, filterVals]);
  useEffect(() => { load(); }, [load]);

  const onSaved = () => { setCreating(false); setEditing(null); load(); showMsg("Registro salvo!"); };

  const remove = async (row: any) => {
    if (!confirm(`Excluir este ${config.singular}? (exclusão lógica)`)) return;
    try { await api.delete(`${config.endpoint}/${row.id}`); load(); showMsg("Registro excluído"); }
    catch { showMsg("Erro ao excluir"); }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const headers = config.columns.map(c => c.label).join(";");
    const rows = items.map(row => {
      return config.columns.map(c => {
        let val = "";
        if (c.render) {
          val = row[c.key] != null ? String(row[c.key]) : "";
        } else {
          val = row[c.key] != null ? String(row[c.key]) : "";
        }
        return `"${val.replace(/"/g, '""')}"`;
      }).join(";");
    });
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-${config.tabela}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pages = Math.ceil(total / limit);
  const IconComponent = TABELA_ICONS[config.tabela] || HelpCircle;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
      </Topbar>

      <main className="flex-1 overflow-y-auto page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>
          
          {/* Back link */}
          <Link href="/dashboard/frota" className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-3" style={{ textDecoration: "none", transition: "colors 0.2s" }}>
            <ChevronLeft size={12} /> Voltar para o Dashboard de Frota
          </Link>

          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-violet)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(99,102,241,0.6)", flexShrink: 0 }}>
              <IconComponent size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{config.plural}</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                {total} {config.singular}{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <button className="btn btn-violet" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo {config.singular}
                </button>
              )}
            </div>
          </div>

          {intro}

          {/* Busca + filtros (sempre visíveis) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "center" }}>
            <div style={{ flex: "1 1 260px", minWidth: 220, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input className="input-o" placeholder={config.searchPlaceholder || `Pesquisar por ${config.singular}...`} value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 34, width: "100%" }} />
            </div>
            {(config.filters || []).map(flt => {
              const opts = flt.source ? (lookups[flt.source] || []) : (flt.options || []);
              return (
                <select key={flt.key} className="input-o" style={{ minWidth: 150, flex: "0 0 auto" }}
                  value={filterVals[flt.key] || ""} onChange={e => setFilterVals(v => ({ ...v, [flt.key]: e.target.value }))}>
                  <option value="">{flt.label}: todos</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              );
            })}
            {(q || Object.values(filterVals).some(Boolean)) && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQ(""); setFilterVals({}); }}>Limpar</button>}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{total} {config.singular}{total !== 1 ? "s" : ""}</span>
          </div>

          <style>{`
            @keyframes crudIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
            .crud-row { animation: crudIn .3s ease both; }
            .crud-row:hover { background: var(--bg-hover); box-shadow: inset 2px 0 0 var(--accent-violet); }
          `}</style>
          {/* Table Card */}
          <div className="card-premium overflow-hidden" style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--accent-violet), transparent 55%)", zIndex: 1 }} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "linear-gradient(180deg, var(--bg-hover), transparent)" }}>
                    {config.columns.map(c => (
                      <th key={c.key} style={{ textAlign: c.align || "left", padding: "13px 16px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{c.label}</th>
                    ))}
                    <th style={{ width: 1 }} />
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={config.columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                  {!loading && items.length === 0 && <tr><td colSpan={config.columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum registro encontrado.</td></tr>}
                  {!loading && items.map((row, ri) => (
                    <tr key={row.id} className="crud-row border-b border-[var(--border-subtle)] transition-colors" style={{ animationDelay: `${Math.min(ri, 16) * 22}ms` }}>
                      {config.columns.map(c => (
                        <td key={c.key} style={{ padding: "12px 16px", textAlign: c.align || "left", color: "var(--text-primary)", verticalAlign: "middle" }}>
                          {c.render ? c.render(row, lookups) : (row[c.key] ?? "—")}
                        </td>
                      ))}
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {config.detailHref && <button className="btn-icon" title="Abrir detalhe" onClick={() => router.push(config.detailHref!(row))}><Eye size={14} /></button>}
                          <button className="btn-icon" title="Histórico" onClick={() => setHistId(row.id)}><History size={14} /></button>
                          {canEdit && <button className="btn-icon" title="Editar" onClick={() => setEditing(row)}><Pencil size={14} /></button>}
                          {canDelete && <button className="btn-icon" title="Excluir" onClick={() => remove(row)} style={{ color: "var(--accent-red)" }}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, alignItems: "center" }}>
              <button className="btn btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{page} / {pages}</span>
              <button className="btn btn-ghost text-xs" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
            </div>
          )}
        </div>
      </main>

      {(creating || editing) && (
        <FormModal config={config} lookups={lookups} initial={editing}
          onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      {histId && <HistoricoDrawer tabela={config.tabela} id={histId} onClose={() => setHistId(null)} />}
    </div>
  );
}

