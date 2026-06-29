"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, cnhStatus } from "../_components/crud";
import { Plus, Pencil, Trash2, Eye, X, Search, User, Download, Filter, ChevronLeft, Users } from "lucide-react";

type Motorista = any;
const STATUS_OPTS = [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "afastado", label: "Afastado" }];
const CNH_OPTS = ["A", "B", "AB", "C", "D", "E"].map(v => ({ value: v, label: v }));
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

// ── Modal de cadastro/edição ────────────────────────────────────────────────────
function MotoristaForm({ motorista, onSaved, onClose }: { motorista?: Motorista; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>(motorista || { status: "ativo" });
  const [linkUser, setLinkUser] = useState<boolean>(!!motorista?.userId);
  const [users, setUsers] = useState<{ id: string; nome: string; email?: string }[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const isEdit = !!motorista?.id;

  useEffect(() => {
    if (linkUser && users.length === 0)
      api.get("/users").then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
  }, [linkUser, users.length]);

  const selectUser = async (u: { id: string; nome: string }) => {
    setUserQuery(u.nome);
    try {
      const { data } = await api.get(`/frota/motoristas/lookup/${u.id}`);
      setD((p: any) => ({
        ...p, userId: u.id,
        nome: data.nome ?? p.nome, email: data.email ?? p.email,
        telefone: data.telefone ?? p.telefone, cargo: data.cargo ?? p.cargo,
        departamento: data.departamento ?? p.departamento,
      }));
    } catch { set("userId", u.id); }
  };

  const save = async () => {
    if (!d.nome?.trim()) { setErr("Nome obrigatório"); return; }
    setSaving(true); setErr("");
    const payload = { ...d, userId: linkUser ? d.userId || null : null };
    try {
      if (isEdit) await api.put(`/frota/motoristas/${motorista.id}`, payload);
      else await api.post("/frota/motoristas", payload);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); setSaving(false); }
  };

  const F = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
    <div style={full ? { gridColumn: "1/-1" } : undefined}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
  const SH = ({ label }: { label: string }) => (
    <div style={{ gridColumn: "1/-1", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginTop: 6 }}>{label}</div>
  );

  const filtered = users.filter(u => !userQuery || u.nome?.toLowerCase().includes(userQuery.toLowerCase()) || u.email?.toLowerCase().includes(userQuery.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 680, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{isEdit ? "Editar motorista" : "Novo motorista"}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, marginBottom: 14 }}>{err}</div>}

        {/* Vincular a usuário */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 12, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={linkUser} onChange={e => { setLinkUser(e.target.checked); if (!e.target.checked) { set("userId", null); setUserQuery(""); } }} style={{ width: 16, height: 16 }} />
          Vincular a usuário existente
        </label>
        {linkUser && (
          <div style={{ marginBottom: 14, position: "relative" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
              <input className="input-o" style={{ paddingLeft: 34 }} placeholder="Pesquisar usuário por nome ou e-mail..." value={userQuery} onChange={e => { setUserQuery(e.target.value); if (d.userId) set("userId", null); }} />
            </div>
            {userQuery && !d.userId && (
              <div className="card" style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 20, maxHeight: 200, overflowY: "auto", padding: 4 }}>
                {filtered.length === 0 && <div style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>Nenhum usuário encontrado.</div>}
                {filtered.slice(0, 30).map(u => (
                  <button key={u.id} onClick={() => selectUser(u)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, background: "none", textAlign: "left", fontSize: 13 }} className="hover:bg-[var(--bg-hover)]">
                    <User size={14} style={{ color: "var(--text-muted)" }} />
                    <span style={{ flex: 1 }}>{u.nome}</span>
                    {u.email && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</span>}
                  </button>
                ))}
              </div>
            )}
            {d.userId && <div style={{ fontSize: 11, color: "var(--accent-green)", marginTop: 6 }}>✓ Usuário vinculado — campos preenchidos automaticamente (CPF e matrícula manuais).</div>}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: "58vh", overflowY: "auto", paddingRight: 4 }}>
          <SH label="DADOS PESSOAIS" />
          <F label="NOME *" full><input className="input-o" value={d.nome || ""} onChange={e => set("nome", e.target.value)} /></F>
          <F label="CPF"><input className="input-o" value={d.cpf || ""} onChange={e => set("cpf", e.target.value)} /></F>
          <F label="MATRÍCULA"><input className="input-o" value={d.matricula || ""} onChange={e => set("matricula", e.target.value)} /></F>
          <F label="TELEFONE"><input className="input-o" value={d.telefone || ""} onChange={e => set("telefone", e.target.value)} /></F>
          <F label="E-MAIL"><input className="input-o" value={d.email || ""} onChange={e => set("email", e.target.value)} /></F>
          <F label="DEPARTAMENTO"><input className="input-o" value={d.departamento || ""} onChange={e => set("departamento", e.target.value)} /></F>
          <F label="CARGO"><input className="input-o" value={d.cargo || ""} onChange={e => set("cargo", e.target.value)} /></F>
          <F label="STATUS">
            <select className="input-o" value={d.status || "ativo"} onChange={e => set("status", e.target.value)}>
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </F>

          <SH label="DADOS DA CNH" />
          <F label="NÚMERO"><input className="input-o" value={d.cnh || ""} onChange={e => set("cnh", e.target.value)} /></F>
          <F label="CATEGORIA">
            <select className="input-o" value={d.categoriaCnh || ""} onChange={e => set("categoriaCnh", e.target.value || null)}>
              <option value="">—</option>
              {CNH_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </F>
          <F label="EMISSÃO"><input className="input-o" type="date" value={d.cnhEmissao ? String(d.cnhEmissao).slice(0, 10) : ""} onChange={e => set("cnhEmissao", e.target.value || null)} /></F>
          <F label="VALIDADE"><input className="input-o" type="date" value={d.validadeCnh ? String(d.validadeCnh).slice(0, 10) : ""} onChange={e => set("validadeCnh", e.target.value || null)} /></F>
          <F label="ÓRGÃO EMISSOR"><input className="input-o" value={d.orgaoEmissor || ""} onChange={e => set("orgaoEmissor", e.target.value)} placeholder="Ex: DETRAN-SP" /></F>
          <F label="OBSERVAÇÕES" full><textarea className="input-o" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} style={{ minHeight: 70, resize: "vertical" }} /></F>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-premium" style={{ padding: "12px 14px", borderLeft: `3px solid ${color}`, minWidth: 110, flex: "1 1 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "var(--font-display)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>{label}</div>
    </div>
  );
}

export default function MotoristasPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<Motorista[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const bloqueio = !!dash?.bloqueioCnhVencida;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/frota/motoristas", { params: { q, status: fStatus, limit: 100 } });
      setItems(data.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [q, fStatus]);

  const loadDash = useCallback(() => { api.get("/frota/motoristas/cnh/dashboard").then(r => setDash(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDash(); }, [loadDash]);

  const onSaved = () => { setCreating(false); setEditing(null); load(); loadDash(); showMsg("Motorista salvo!"); };
  const remove = async (m: Motorista) => {
    if (!confirm("Excluir este motorista? (exclusão lógica)")) return;
    try { await api.delete(`/frota/motoristas/${m.id}`); load(); loadDash(); showMsg("Motorista excluído"); }
    catch { showMsg("Erro ao excluir"); }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const headers = ["Nome", "CPF", "Matrícula", "Telefone", "E-mail", "Departamento", "Cargo", "CNH", "Categoria CNH", "Validade CNH", "Status"];
    const rows = items.map(m => {
      return [
        m.nome || "", m.cpf || "", m.matricula || "", m.telefone || "", m.email || "", 
        m.departamento || "", m.cargo || "", m.cnh || "", m.categoriaCnh || "", 
        m.validadeCnh ? new Date(m.validadeCnh).toLocaleDateString("pt-BR") : "", m.status || ""
      ].map(val => `"${val.replace(/"/g, '""')}"`);
    });
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-motoristas-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              <Users size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Motoristas</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                {items.length} motorista(s) encontrado(s)
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowFilters(s => !s)} className={`btn ${showFilters ? 'btn-violet' : 'btn-ghost'}`} style={{ fontSize: 12, gap: 6 }}>
                <Filter size={14} /> Filtros
              </button>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <button className="btn btn-violet" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo motorista
                </button>
              )}
            </div>
          </div>

          {/* CNH Dashboard stats */}
          {dash && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8, letterSpacing: "0.08em" }}>DASHBOARD DA CNH</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Stat label="Vencidas" value={dash.vencida} color="var(--accent-red)" />
                <Stat label="≤ 7 dias" value={dash.vence7} color="var(--accent-red)" />
                <Stat label="≤ 15 dias" value={dash.vence15} color="var(--accent-amber)" />
                <Stat label="≤ 30 dias" value={dash.vence30} color="var(--accent-amber)" />
                <Stat label="≤ 60 dias" value={dash.vence60} color="#eab308" />
                <Stat label="≤ 90 dias" value={dash.vence90} color="#eab308" />
                <Stat label="Válidas" value={dash.validas} color="var(--accent-green)" />
                <Stat label="Sem CNH" value={dash.semCnh} color="var(--text-muted)" />
              </div>
            </div>
          )}

          {/* Search + Filter Row */}
          <div className="card-premium" style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "14px 18px", marginBottom: 20, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                className="input-o" 
                placeholder="Pesquisar por motorista..." 
                value={q} 
                onChange={e => setQ(e.target.value)} 
                style={{ paddingLeft: 34, width: "100%" }} 
              />
            </div>
            {showFilters && (
              <select className="input-o" style={{ minWidth: 160 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">Status: todos</option>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </div>

          {/* Table Card */}
          <div className="card-premium overflow-hidden">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    {["Nome", "Matrícula", "CNH", "Validade CNH", "Vínculo", "Status", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                  {!loading && items.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum motorista encontrado.</td></tr>}
                  {!loading && items.map(m => {
                    const cnh = cnhStatus(m.validadeCnh, bloqueio);
                    return (
                      <tr key={m.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{m.nome}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{m.matricula || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)" }}>{m.cnh ? `${m.cnh}${m.categoriaCnh ? " · " + m.categoriaCnh : ""}` : "—"}</td>
                        <td style={{ padding: "12px 16px" }}><Badge color={cnh.color}>{cnh.label}</Badge></td>
                        <td style={{ padding: "12px 16px" }}>{m.userId ? <Badge color="var(--accent-cyan)">Usuário</Badge> : <span style={{ color: "var(--text-muted)" }}>Externo</span>}</td>
                        <td style={{ padding: "12px 16px" }}>{STATUS_OPTS.find(s => s.value === m.status)?.label || m.status}</td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button className="btn-icon" title="Detalhe" onClick={() => router.push(`/dashboard/frota/motoristas/${m.id}`)}><Eye size={14} /></button>
                            {canEdit && <button className="btn-icon" title="Editar" onClick={() => setEditing(m)}><Pencil size={14} /></button>}
                            {canDelete && <button className="btn-icon" title="Excluir" onClick={() => remove(m)} style={{ color: "var(--accent-red)" }}><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {(creating || editing) && <MotoristaForm motorista={editing || undefined} onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />}
    </div>
  );
}
