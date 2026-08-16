"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, cnhStatus } from "../_components/crud";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard,
  Toolbar, SearchInput, TableCard, RowActions, RowAction, EmptyState, LoadingRows,
} from "../_components/ui";
import { Plus, Pencil, Trash2, Eye, X, Search, User, Download, Filter, ChevronLeft, Users, CheckCircle2 } from "lucide-react";

type Motorista = any;
const STATUS_OPTS = [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "afastado", label: "Afastado" }];
const CNH_OPTS = ["A", "B", "AB", "C", "D", "E"].map(v => ({ value: v, label: v }));
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

function getMotoristaCnhGroup(validade?: string | null) {
  if (!validade) return "semCnh";
  const dias = Math.ceil((new Date(validade).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "vencida";
  if (dias <= 7) return "vence7";
  if (dias <= 15) return "vence15";
  if (dias <= 30) return "vence30";
  if (dias <= 60) return "vence60";
  if (dias <= 90) return "vence90";
  return "validas";
}

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
      api.get("/users/picklist", { silent: true }).then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
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

export default function MotoristasPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<Motorista[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  
  const canCreate = hasPerms(user, "frota:criar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const bloqueio = !!dash?.bloqueioCnhVencida;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/frota/motoristas", { params: { limit: 500 } });
      setItems(data.items || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  const loadDash = useCallback(() => { api.get("/frota/motoristas/cnh/dashboard").then(r => setDash(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDash(); }, [loadDash]);

  const onSaved = () => { setCreating(false); setEditing(null); load(); showMsg("Motorista salvo!"); };
  const remove = async (m: Motorista) => {
    if (!confirm("Excluir este motorista? (exclusão lógica)")) return;
    try { await api.delete(`/frota/motoristas/${m.id}`); load(); showMsg("Motorista excluído"); }
    catch { showMsg("Erro ao excluir"); }
  };

  /**
   * Quem saiu da empresa não é problema de CNH.
   *
   * "Vencidas" contava a frota inteira, inclusive desligados e afastados, e o
   * número virava uma dívida que ninguém podia pagar — renovar a CNH de quem
   * não dirige mais aqui não é tarefa de ninguém. A base de trabalho passa a ser
   * só quem está ativo; o inativo aparece quando for pedido, clicando o card
   * "Inativos" ou marcando a caixa ao lado da busca.
   */
  const verInativos = mostrarInativos || activeFilter === "inativos";
  const base = verInativos ? items : items.filter(m => m.status === "ativo");

  const filteredItems = base.filter(m => {
    if (q && !`${m.nome} ${m.matricula} ${m.cnh}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (activeFilter === "vencidas") return getMotoristaCnhGroup(m.validadeCnh) === "vencida";
    if (activeFilter === "validas") return getMotoristaCnhGroup(m.validadeCnh) === "validas";
    if (activeFilter === "ativos") return m.status === "ativo";
    if (activeFilter === "inativos") return m.status !== "ativo";
    return true;
  });

  const counts = {
    // Vencidas/Válidas seguem a base visível; Ativos/Inativos contam sempre a
    // lista inteira, senão o card "Inativos" mostraria 0 e não haveria como
    // chegar neles.
    vencidas: base.filter(m => getMotoristaCnhGroup(m.validadeCnh) === "vencida").length,
    validas: base.filter(m => getMotoristaCnhGroup(m.validadeCnh) === "validas").length,
    ativos: items.filter(m => m.status === "ativo").length,
    inativos: items.filter(m => m.status !== "ativo").length,
  };

  const exportCSV = () => {
    if (!filteredItems.length) return;
    const headers = ["Nome", "CPF", "Matrícula", "Telefone", "E-mail", "Departamento", "Cargo", "CNH", "Categoria CNH", "Validade CNH", "Status"];
    const rows = filteredItems.map(m => {
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
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
      </Topbar>

      <main className="flex-1 overflow-y-auto page-content">
        <PageBody>
          <BackLink href="/dashboard/frota" label="Voltar para o Dashboard de Frota" />

          <PageHeader
            icon={<Users size={22} />}
            title="Motoristas"
            subtitle={<><span className="num">{filteredItems.length}</span> de <span className="num">{items.length}</span> motorista(s)</>}
            actions={<>
              <button onClick={exportCSV} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                <Download size={14} /> Exportar CSV
              </button>
              {canCreate && (
                <button className="btn btn-violet" onClick={() => setCreating(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo motorista
                </button>
              )}
            </>}
          />

          <StatGrid>
            {[
              { key: "vencidas", label: "Vencidas", color: "var(--accent-red)", critical: true },
              { key: "validas", label: "Válidas", color: "var(--accent-green)" },
              { key: "ativos", label: "Ativos", color: "var(--accent-cyan)" },
              { key: "inativos", label: "Inativos", color: "var(--text-muted)" },
            ].map((f, i) => (
              <StatCard
                key={f.key}
                index={i}
                label={f.label}
                value={counts[f.key as keyof typeof counts] || 0}
                color={f.color}
                total={items.length}
                critical={f.critical}
                active={activeFilter === f.key}
                onClick={() => setActiveFilter(activeFilter === f.key ? "" : f.key)}
              />
            ))}
          </StatGrid>

          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por motorista, matrícula ou CNH..." />
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
              title="Desligados e afastados ficam fora da conta de CNH até serem pedidos aqui."
            >
              <input
                type="checkbox"
                checked={verInativos}
                disabled={activeFilter === "inativos"}
                onChange={e => setMostrarInativos(e.target.checked)}
              />
              Incluir inativos
              {counts.inativos > 0 && !verInativos && (
                <span className="num" style={{ color: "var(--text-faint)" }}>({counts.inativos} ocultos)</span>
              )}
            </label>
            {(q || activeFilter || mostrarInativos) && (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQ(""); setActiveFilter(""); setMostrarInativos(false); }}>
                Limpar filtros
              </button>
            )}
          </Toolbar>

          <TableCard>
            <thead>
              <tr>
                {["Nome", "Matrícula", "CNH", "Validade CNH", "Vínculo", "Status"].map(h => <th key={h}>{h}</th>)}
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {loading && <LoadingRows colSpan={7} />}
              {!loading && filteredItems.length === 0 && (
                <EmptyState
                  colSpan={7}
                  icon={<Users size={20} />}
                  title="Nenhum motorista encontrado"
                  hint={q || activeFilter ? "Ajuste a busca ou remova os filtros ativos." : "Cadastre o primeiro motorista para começar."}
                />
              )}
              {!loading && filteredItems.map(m => {
                const cnh = cnhStatus(m.validadeCnh, bloqueio);
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.nome}</td>
                    <td className="font-mono num" style={{ color: "var(--text-muted)" }}>{m.matricula || "—"}</td>
                    <td className="font-mono num">{m.cnh ? `${m.cnh}${m.categoriaCnh ? " · " + m.categoriaCnh : ""}` : "—"}</td>
                    <td><Badge color={cnh.color}>{cnh.label}</Badge></td>
                    <td>{m.userId ? <Badge color="var(--accent-cyan)">Usuário</Badge> : <span style={{ color: "var(--text-faint)" }}>Externo</span>}</td>
                    <td>{STATUS_OPTS.find(s => s.value === m.status)?.label || m.status}</td>
                    <td style={{ textAlign: "right" }}>
                      <RowActions>
                        <RowAction tone="view" title="Detalhe" onClick={() => router.push(`/dashboard/frota/motoristas/${m.id}`)}><Eye size={15} /></RowAction>
                        {canEdit && <RowAction tone="edit" title="Editar" onClick={() => setEditing(m)}><Pencil size={15} /></RowAction>}
                        {canDelete && <RowAction tone="danger" title="Excluir" onClick={() => remove(m)}><Trash2 size={15} /></RowAction>}
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        </PageBody>
      </main>

      {(creating || editing) && <MotoristaForm motorista={editing || undefined} onSaved={onSaved} onClose={() => { setCreating(false); setEditing(null); }} />}
    </div>
  );
}
