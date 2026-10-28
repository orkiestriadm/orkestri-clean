"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { History, Plus, Pencil, Trash2, X } from "lucide-react";

// ── Tipos de configuração ──────────────────────────────────────────────────────
export type Option = { value: string; label: string };
export type SourceKey = "veiculos" | "motoristas" | "categorias" | "setores";
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
export type Filter = { key: string; label: string; options: Option[] };
export type CrudConfig = {
  endpoint: string;   // ex.: "/frota/veiculos"
  tabela: string;     // ex.: "veiculos" (para histórico/auditoria)
  singular: string;   // ex.: "veículo"
  plural: string;     // ex.: "Veículos"
  columns: Column[];
  fields: Field[];
  filters?: Filter[];
  defaults?: Record<string, any>;
};

// ── Helpers visuais ────────────────────────────────────────────────────────────
export const fmtDate  = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
export const fmtMoney = (v?: number | null) => (v != null) ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

export function Badge({ children, color = "var(--text-muted)" }: { children: React.ReactNode; color?: string }) {
  return <span className="badge" style={{ fontSize: 11, background: color + "18", color, border: `1px solid ${color}30` }}>{children}</span>;
}

const SOURCE_EP: Record<SourceKey, string> = {
  veiculos:   "/frota/veiculos",
  motoristas: "/frota/motoristas",
  categorias: "/frota/categorias",
  setores:    "/setores",
};
function sourceLabel(key: SourceKey, row: any): string {
  if (key === "veiculos")   return `${row.placa || row.codigo}${row.modelo ? " — " + row.modelo : ""}`;
  return row.nome || row.placa || row.id;
}

// ── Drawer de histórico (alterações + auditoria de usuário) ─────────────────────
function HistoricoDrawer({ tabela, id, onClose }: { tabela: string; id: string; onClose: () => void }) {
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
function FormModal({ config, lookups, initial, onSaved, onClose }: {
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div className="card" style={{ padding: "24px 28px", maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)" }}>
            {isEdit ? `Editar ${config.singular}` : `Novo ${config.singular}`}
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {config.fields.map((f) => {
            const type = f.type || "text";
            const wrap = (child: React.ReactNode) => (
              <div key={f.key} style={f.full || type === "textarea" ? { gridColumn: "1/-1" } : undefined}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>
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

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
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
  const [lookups, setLookups] = useState<Lookups>({ veiculos: [], motoristas: [], categorias: [], setores: [] });
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [histId, setHistId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const limit = 30;
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit   = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // Carrega listas auxiliares usadas pelos selects do formulário
  useEffect(() => {
    const used = new Set<SourceKey>();
    config.fields.forEach(f => f.source && used.add(f.source));
    used.forEach((key) => {
      api.get(SOURCE_EP[key], { params: { limit: 200 } })
        .then(r => {
          const rows = r.data?.items ?? r.data ?? [];
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

  const pages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
        {canCreate && (
          <button className="btn btn-violet text-xs" onClick={() => setCreating(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo
          </button>
        )}
      </Topbar>

      <main className="flex-1 overflow-y-auto p-6">
        {intro}

        {/* Busca + filtros */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <input className="input-o" placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          {(config.filters || []).map(flt => (
            <select key={flt.key} className="input-o" style={{ maxWidth: 200 }}
              value={filterVals[flt.key] || ""} onChange={e => setFilterVals(v => ({ ...v, [flt.key]: e.target.value }))}>
              <option value="">{flt.label}: todos</option>
              {flt.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{total} registro(s)</span>
        </div>

        {/* Tabela */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {config.columns.map(c => (
                    <th key={c.key} style={{ textAlign: c.align || "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c.label}</th>
                  ))}
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={config.columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                {!loading && items.length === 0 && <tr><td colSpan={config.columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum registro.</td></tr>}
                {!loading && items.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--border-subtle)" }} className="hover:bg-[var(--bg-hover)]">
                    {config.columns.map(c => (
                      <td key={c.key} style={{ padding: "10px 14px", textAlign: c.align || "left", color: "var(--text-primary)", verticalAlign: "middle" }}>
                        {c.render ? c.render(row, lookups) : (row[c.key] ?? "—")}
                      </td>
                    ))}
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
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

        {/* Paginação */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, alignItems: "center" }}>
            <button className="btn btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{page} / {pages}</span>
            <button className="btn btn-ghost text-xs" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
          </div>
        )}
      </main>

      {(creating || editing) && (
        <FormModal config={config} lookups={lookups} initial={editing}
          onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      {histId && <HistoricoDrawer tabela={config.tabela} id={histId} onClose={() => setHistId(null)} />}
    </div>
  );
}
