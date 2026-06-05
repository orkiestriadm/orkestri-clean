"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type Categoria = { id: string; nome: string; icone: string; cor: string; totalAtivos?: number; };
type Ativo = {
  id: string; codigo: string; nome: string; descricao?: string;
  status: string; marca?: string; modelo?: string; numeroSerie?: string; localizacao?: string;
  categoriaId?: string; responsavelId?: string; setorId?: string;
  dataAquisicao?: string; valorAquisicao?: number; dataGarantiaFim?: string; observacoes?: string;
  ip?: string | null; monitorar?: boolean; online?: boolean | null; ultimoPing?: string | null; latenciaMs?: number | null;
  garantiaOk?: boolean | null; garantiaVencida?: boolean; garantiaRisco?: boolean | null;
  criadoEm: string; atualizadoEm: string;
  categoria?: { id: string; nome: string; cor: string; icone: string; };
  responsavel?: { id: string; nome: string; email: string; avatar?: string; };
  setor?: { id: string; nome: string; cor?: string; };
  transferencias?: Transferencia[];
};
type Transferencia = {
  id: string; motivo?: string; criadoEm: string;
  deResponsavel?: { id: string; nome: string; };
  paraResponsavel?: { id: string; nome: string; };
  realizadoPor: { id: string; nome: string; };
};
type Stats = { total: number; porStatus: Record<string,number>; porCategoria: any[]; garantiaVencendo: any[]; };

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string,string> = {
  ativo:          "var(--accent-green)",
  inativo:        "var(--text-muted)",
  em_manutencao:  "var(--accent-amber)",
  descartado:     "var(--accent-red)",
  emprestado:     "var(--accent-cyan)",
};
const STATUS_LABELS: Record<string,string> = {
  ativo:"Ativo", inativo:"Inativo", em_manutencao:"Manutenção", descartado:"Descartado", emprestado:"Emprestado",
};
const STATUS_LIST = ["ativo","inativo","em_manutencao","descartado","emprestado"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtMoney = (v?: number) => v != null ? v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "—";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, onClick, active }: { label:string; value:number|string; color:string; onClick?:()=>void; active?:boolean; }) {
  return (
    <div className="card" onClick={onClick} style={{ padding:"16px 18px", borderLeft:`3px solid ${color}`, cursor:onClick?"pointer":"default", background:active?"var(--bg-hover)":"" }}>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"var(--font-mono)" }}>{value}</div>
      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{label}</div>
    </div>
  );
}

// ── AtivoForm ─────────────────────────────────────────────────────────────────
function AtivoForm({ ativo, categorias, users, setores, onSave, onCancel }: {
  ativo?: Ativo; categorias: Categoria[];
  users: {id:string;nome:string}[]; setores: {id:string;nome:string}[];
  onSave: (a: Ativo) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<any>(ativo || { status:"ativo" });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!d.nome?.trim()) { setErr("Nome obrigatorio"); return; }
    setSaving(true); setErr("");
    try {
      const res = ativo
        ? await api.put("/ativos/" + ativo.id, d)
        : await api.post("/ativos", d);
      onSave(res.data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth:680, display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h2 style={{ fontSize:16, fontWeight:700, fontFamily:"var(--font-display)" }}>{ativo ? "Editar ativo" : "Novo ativo"}</h2>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize:12, color:"var(--accent-red)", padding:"8px 12px", background:"rgba(239,68,68,0.08)", borderRadius:6 }}>{err}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <F label="NOME *"><input className="input-o" value={d.nome||""} onChange={e=>set("nome",e.target.value)} placeholder="Nome do ativo" /></F>
        </div>
        <F label="CÓDIGO (auto se vazio)"><input className="input-o" value={d.codigo||""} onChange={e=>set("codigo",e.target.value)} placeholder="Ex: AT-00001" /></F>
        <F label="STATUS">
          <select className="input-o" value={d.status||"ativo"} onChange={e=>set("status",e.target.value)}>
            {STATUS_LIST.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </F>
        <F label="CATEGORIA">
          <select className="input-o" value={d.categoriaId||""} onChange={e=>set("categoriaId",e.target.value||null)}>
            <option value="">Sem categoria</option>
            {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </F>
        <F label="RESPONSÁVEL">
          <select className="input-o" value={d.responsavelId||""} onChange={e=>set("responsavelId",e.target.value||null)}>
            <option value="">Sem responsável</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </F>
        <F label="SETOR">
          <select className="input-o" value={d.setorId||""} onChange={e=>set("setorId",e.target.value||null)}>
            <option value="">Sem setor</option>
            {setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </F>
        <F label="LOCALIZAÇÃO"><input className="input-o" value={d.localizacao||""} onChange={e=>set("localizacao",e.target.value)} placeholder="Sala, andar, prédio..." /></F>
        <F label="MARCA"><input className="input-o" value={d.marca||""} onChange={e=>set("marca",e.target.value)} /></F>
        <F label="MODELO"><input className="input-o" value={d.modelo||""} onChange={e=>set("modelo",e.target.value)} /></F>
        <F label="Nº DE SÉRIE"><input className="input-o" value={d.numeroSerie||""} onChange={e=>set("numeroSerie",e.target.value)} /></F>
        <F label="DATA AQUISIÇÃO"><input className="input-o" type="date" value={d.dataAquisicao ? d.dataAquisicao.slice(0,10) : ""} onChange={e=>set("dataAquisicao",e.target.value)} /></F>
        <F label="VALOR AQUISIÇÃO (R$)"><input className="input-o" type="number" min={0} step={0.01} value={d.valorAquisicao||""} onChange={e=>set("valorAquisicao",e.target.value?Number(e.target.value):null)} /></F>
        <F label="FIM DE GARANTIA"><input className="input-o" type="date" value={d.dataGarantiaFim ? d.dataGarantiaFim.slice(0,10) : ""} onChange={e=>set("dataGarantiaFim",e.target.value)} /></F>
        <div style={{ gridColumn:"1/-1" }}>
          <F label="OBSERVAÇÕES"><textarea className="input-o" value={d.observacoes||""} onChange={e=>set("observacoes",e.target.value)} style={{ minHeight:80, resize:"vertical" }} /></F>
        </div>
        {/* Monitoramento */}
        <div style={{ gridColumn:"1/-1", padding:"12px 14px", background:"rgba(6,182,212,0.05)", border:"1px solid rgba(6,182,212,0.15)", borderRadius:8 }}>
          <div style={{ fontSize:11, color:"var(--accent-cyan)", fontFamily:"var(--font-mono)", fontWeight:700, marginBottom:10 }}>MONITORAMENTO DE REDE</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"center" }}>
            <F label="ENDEREÇO IP (ex: 192.168.1.10)">
              <input className="input-o" value={d.ip||""} onChange={e=>set("ip",e.target.value)} placeholder="192.168.1.10" />
            </F>
            <div style={{ paddingTop:18 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={!!d.monitorar} onChange={e=>set("monitorar",e.target.checked)} style={{ width:16, height:16 }} />
                <span style={{ color:"var(--text-secondary)" }}>Monitorar este ativo</span>
              </label>
            </div>
          </div>
          {!d.ip && d.monitorar && (
            <div style={{ fontSize:11, color:"var(--accent-amber, #f59e0b)", marginTop:6 }}>⚠ Preencha o IP para que o monitoramento funcione.</div>
          )}
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, paddingTop:8 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </div>
  );
}

// ── TransferirModal ───────────────────────────────────────────────────────────
function TransferirModal({ ativo, users, setores, onDone, onClose }: {
  ativo: Ativo; users: {id:string;nome:string}[]; setores: {id:string;nome:string}[];
  onDone: (a: Ativo) => void; onClose: () => void;
}) {
  const [responsavelId, setResp] = useState(ativo.responsavelId || "");
  const [setorId,       setSetor]= useState(ativo.setorId || "");
  const [motivo,        setMotivo]= useState("");
  const [saving,        setSaving]= useState(false);
  const [err,           setErr]   = useState("");

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const { data } = await api.patch("/ativos/" + ativo.id + "/transferir", { responsavelId: responsavelId || null, setorId: setorId || null, motivo: motivo || null });
      onDone(data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div className="card" style={{ padding:"24px 28px", maxWidth:440, width:"100%", display:"flex", flexDirection:"column", gap:14 }}>
        <h3 style={{ fontSize:15, fontWeight:700, fontFamily:"var(--font-display)" }}>Transferir — {ativo.nome}</h3>
        {err && <div style={{ fontSize:12, color:"var(--accent-red)" }}>{err}</div>}
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>NOVO RESPONSÁVEL</label>
          <select className="input-o" value={responsavelId} onChange={e=>setResp(e.target.value)}>
            <option value="">Sem responsável</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>NOVO SETOR</label>
          <select className="input-o" value={setorId} onChange={e=>setSetor(e.target.value)}>
            <option value="">Sem setor</option>
            {setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>MOTIVO (opcional)</label>
          <input className="input-o" value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex: Troca de equipe, saída do funcionário..." />
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ fontSize:12 }} onClick={save} disabled={saving}>{saving?"Transferindo...":"Transferir"}</button>
        </div>
      </div>
    </div>
  );
}

// ── AtivoDetail ───────────────────────────────────────────────────────────────
function AtivoDetail({ ativo, canEdit, canTransfer, canDelete, onEdit, onTransfer, onDelete, onBack }: {
  ativo: Ativo; canEdit: boolean; canTransfer: boolean; canDelete: boolean;
  onEdit: () => void; onTransfer: () => void; onDelete: () => void; onBack: () => void;
}) {
  const col = STATUS_COLORS[ativo.status] || "var(--text-muted)";
  const catCol = ativo.categoria?.cor || "var(--border-medium)";

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onBack}>← Voltar</button>
        <div style={{ flex:1 }} />
        {canDelete   && <button className="btn btn-ghost" style={{ fontSize:12, color:"var(--accent-red)" }} onClick={onDelete}>Excluir</button>}
        {canTransfer && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onTransfer}>Transferir</button>}
        {canEdit     && <button className="btn btn-violet" style={{ fontSize:12 }} onClick={onEdit}>Editar</button>}
      </div>

      {/* Header */}
      <div className="card" style={{ padding:"20px 24px", marginBottom:16, borderLeft:`3px solid ${catCol}` }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              {ativo.categoria && <span className="badge" style={{ fontSize:11, background:catCol+"18", color:catCol, border:`1px solid ${catCol}30` }}>{ativo.categoria.nome}</span>}
              <span className="badge" style={{ fontSize:11, background:col+"15", color:col, border:`1px solid ${col}30` }}>{STATUS_LABELS[ativo.status]}</span>
              {ativo.garantiaVencida && <span className="badge" style={{ fontSize:11, background:"rgba(239,68,68,0.1)", color:"var(--accent-red)", border:"1px solid rgba(239,68,68,0.2)" }}>Garantia vencida</span>}
              {ativo.garantiaRisco   && <span className="badge" style={{ fontSize:11, background:"rgba(245,158,11,0.1)", color:"var(--accent-amber)", border:"1px solid rgba(245,158,11,0.2)" }}>Garantia vencendo</span>}
            </div>
            <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-display)", color:"var(--text-primary)" }}>{ativo.nome}</h2>
            <div style={{ fontSize:13, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:3 }}>{ativo.codigo}</div>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {[
          ["Marca",        ativo.marca],
          ["Modelo",       ativo.modelo],
          ["Nº de Série",  ativo.numeroSerie],
          ["Localização",  ativo.localizacao],
          ["Responsável",  ativo.responsavel?.nome],
          ["Setor",        ativo.setor?.nome],
          ["Aquisição",    fmtDate(ativo.dataAquisicao)],
          ["Valor",        fmtMoney(ativo.valorAquisicao)],
          ["Fim Garantia", fmtDate(ativo.dataGarantiaFim)],
          ["Cadastrado",   fmtDate(ativo.criadoEm)],
        ].map(([k, v]) => v ? (
          <div key={k as string} className="card" style={{ padding:"12px 16px" }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:3 }}>{k as string}</div>
            <div style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>{v as string}</div>
          </div>
        ) : null)}
      </div>

      {ativo.observacoes && (
        <div className="card" style={{ padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:6 }}>OBSERVAÇÕES</div>
          <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{ativo.observacoes}</p>
        </div>
      )}

      {/* Transfer history */}
      {ativo.transferencias && ativo.transferencias.length > 0 && (
        <div>
          <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", fontWeight:600, marginBottom:10 }}>HISTÓRICO DE TRANSFERÊNCIAS</div>
          <div className="card" style={{ overflow:"hidden" }}>
            {ativo.transferencias.map((t, i) => (
              <div key={t.id} style={{ padding:"12px 16px", borderBottom:i<ativo.transferencias!.length-1?"1px solid var(--border-subtle)":"none", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:"var(--text-primary)" }}>
                    {t.deResponsavel?.nome || "—"} → {t.paraResponsavel?.nome || "—"}
                  </div>
                  {t.motivo && <div style={{ fontSize:12, color:"var(--text-muted)" }}>{t.motivo}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{t.realizadoPor.nome}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(t.criadoEm)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AtivosPage() {
  const router  = useRouter();
  const { user } = useAuthStore();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ativos,     setAtivos]     = useState<Ativo[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [users,      setUsers]      = useState<{id:string;nome:string}[]>([]);
  const [setores,    setSetores]    = useState<{id:string;nome:string}[]>([]);

  const [q,           setQ]          = useState("");
  const [filterStatus,setFStatus]    = useState("");
  const [filterCat,   setFCat]       = useState("");
  const [selected,    setSelected]   = useState<Ativo | null>(null);
  const [editing,     setEditing]    = useState(false);
  const [transferring,setTransferring]= useState(false);
  const [msg,         setMsg]        = useState("");

  const canCreate   = hasPerms(user, "ativos:criar");
  const canEdit     = hasPerms(user, "ativos:editar");
  const canDelete   = hasPerms(user, "ativos:deletar");
  const canTransfer = hasPerms(user, "ativos:transferir");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ativos", { params: { q, status: filterStatus, categoriaId: filterCat, page, limit: 30 } });
      setAtivos(data.items); setTotal(data.total);
    } catch {} finally { setLoading(false); }
  }, [q, filterStatus, filterCat, page]);

  useEffect(() => {
    api.get("/ativos/categorias").then(r => setCategorias(r.data)).catch(() => {});
    api.get("/ativos/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/users").then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
    api.get("/setores").then(r => setSetores(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [q, filterStatus, filterCat]);
  useEffect(() => { load(); }, [load]);

  const openAtivo = async (a: Ativo) => {
    try { const { data } = await api.get("/ativos/" + a.id); setSelected(data); }
    catch { setSelected(a); }
    setEditing(false);
  };

  const handleSave = (saved: Ativo) => {
    setSelected(saved); setEditing(false);
    load();
    api.get("/ativos/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/ativos/categorias").then(r => setCategorias(r.data)).catch(() => {});
    showMsg("Ativo salvo!");
  };

  const handleDelete = async () => {
    if (!selected || !confirm("Remover este ativo permanentemente?")) return;
    try {
      await api.delete("/ativos/" + selected.id);
      setSelected(null); load();
      api.get("/ativos/stats").then(r => setStats(r.data)).catch(() => {});
      showMsg("Ativo removido");
    } catch { showMsg("Erro ao remover"); }
  };

  const limit = 30;
  const pages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
        {!editing && !selected && (
          <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/ativos/monitoramento")}>
            🖥 Monitoramento
          </button>
        )}
        {canCreate && !editing && !selected && (
          <button className="btn btn-violet text-xs" onClick={() => { setSelected(null); setEditing(true); }}>Novo ativo</button>
        )}
      </Topbar>

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Stats row */}
        {!editing && !selected && stats && (
          <div style={{ padding:"16px 24px 0", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, flexShrink:0 }}>
            <StatCard label="Total" value={stats.total} color="var(--accent-violet)" onClick={() => setFStatus("")} active={!filterStatus} />
            {Object.entries(stats.porStatus).map(([s, count]) => (
              <StatCard key={s} label={STATUS_LABELS[s]||s} value={count} color={STATUS_COLORS[s]||"var(--text-muted)"} onClick={() => setFStatus(filterStatus===s?"":s)} active={filterStatus===s} />
            ))}
          </div>
        )}

        {/* Garantia warning */}
        {!editing && !selected && stats?.garantiaVencendo && stats.garantiaVencendo.length > 0 && (
          <div style={{ margin:"12px 24px 0", padding:"10px 14px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:8, fontSize:12, color:"var(--accent-amber)", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontWeight:600 }}>Garantia vencendo em 30 dias:</span>
            {stats.garantiaVencendo.map((a:any) => (
              <span key={a.id} style={{ background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:4, padding:"2px 8px" }}>{a.nome} ({fmtDate(a.dataGarantiaFim)})</span>
            ))}
          </div>
        )}

        <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
          {/* Sidebar */}
          {!editing && (
            <div style={{ width:210, flexShrink:0, borderRight:"1px solid var(--border-subtle)", overflowY:"auto", padding:"16px 12px", display:"flex", flexDirection:"column", gap:4 }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontWeight:600, padding:"4px 8px", marginBottom:4 }}>CATEGORIAS</div>
              <button onClick={()=>setFCat("")} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:6, border:"none", cursor:"pointer", background:!filterCat?"var(--accent-violet-dim)":"transparent", color:!filterCat?"var(--accent-violet)":"var(--text-muted)", fontSize:13 }}>
                <span>Todos</span><span style={{ fontSize:11, fontFamily:"var(--font-mono)" }}>{stats?.total||0}</span>
              </button>
              {categorias.map(c=>(
                <button key={c.id} onClick={()=>setFCat(filterCat===c.id?"":c.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:6, border:"none", cursor:"pointer", background:filterCat===c.id?c.cor+"18":"transparent", color:filterCat===c.id?c.cor:"var(--text-secondary)", fontSize:13 }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</span>
                  <span style={{ fontSize:11, fontFamily:"var(--font-mono)", flexShrink:0, marginLeft:4 }}>{c.totalAtivos||0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Main */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
            {editing ? (
              <AtivoForm
                ativo={selected||undefined} categorias={categorias} users={users} setores={setores}
                onSave={handleSave} onCancel={() => { setEditing(false); if (!selected) setSelected(null); }}
              />
            ) : selected ? (
              <>
                <AtivoDetail
                  ativo={selected}
                  canEdit={canEdit} canTransfer={canTransfer} canDelete={canDelete}
                  onEdit={() => setEditing(true)}
                  onTransfer={() => setTransferring(true)}
                  onDelete={handleDelete}
                  onBack={() => setSelected(null)}
                />
                {transferring && (
                  <TransferirModal
                    ativo={selected} users={users} setores={setores}
                    onDone={a => { setSelected(a); setTransferring(false); load(); showMsg("Transferência realizada!"); }}
                    onClose={() => setTransferring(false)}
                  />
                )}
              </>
            ) : (
              <>
                {/* Filters */}
                <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
                  <input className="input-o" style={{ flex:1, minWidth:200, maxWidth:350 }} placeholder="Buscar por nome, código, série..." value={q} onChange={e=>setQ(e.target.value)} />
                  <select className="input-o" style={{ width:160 }} value={filterStatus} onChange={e=>setFStatus(e.target.value)}>
                    <option value="">Todos os status</option>
                    {STATUS_LIST.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  {(q||filterStatus||filterCat) && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>{setQ("");setFStatus("");setFCat("");}}>Limpar</button>}
                </div>

                <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14, fontFamily:"var(--font-mono)" }}>{total} ativo{total!==1?"s":""}</div>

                {loading ? (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                    {Array.from({length:6}).map((_,i)=><div key={i} className="card skeleton" style={{ height:110 }} />)}
                  </div>
                ) : ativos.length === 0 ? (
                  <div className="empty-state">
                    <p style={{ color:"var(--text-muted)" }}>Nenhum ativo encontrado</p>
                    {canCreate && <button className="btn btn-violet" style={{ marginTop:12 }} onClick={() => setEditing(true)}>Cadastrar ativo</button>}
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                    {ativos.map(a => {
                      const col = STATUS_COLORS[a.status]||"var(--text-muted)";
                      const catCol = a.categoria?.cor||"var(--border-medium)";
                      return (
                        <div key={a.id} className="card" onClick={() => openAtivo(a)} style={{ padding:"14px 16px", cursor:"pointer", borderLeft:`3px solid ${catCol}`, transition:"box-shadow 0.15s" }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(0,0,0,0.12)"}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow=""}
                        >
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{a.codigo}</div>
                            <div style={{ display:"flex", gap:4 }}>
                              {a.garantiaVencida && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent-red)", display:"inline-block" }} title="Garantia vencida" />}
                              {a.garantiaRisco   && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent-amber)", display:"inline-block" }} title="Garantia vencendo" />}
                              <span className="badge" style={{ fontSize:10, background:col+"15", color:col, border:`1px solid ${col}30` }}>{STATUS_LABELS[a.status]||a.status}</span>
                            </div>
                          </div>
                          <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.nome}</div>
                          {(a.marca||a.modelo) && <div style={{ fontSize:12, color:"var(--text-muted)" }}>{[a.marca, a.modelo].filter(Boolean).join(" · ")}</div>}
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8, fontSize:11, color:"var(--text-muted)" }}>
                            {a.responsavel && <span>{a.responsavel.nome}</span>}
                            {a.setor && <span>{a.setor.nome}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pages > 1 && (
                  <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:24 }}>
                    <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button>
                    <span style={{ fontSize:12, color:"var(--text-muted)", padding:"6px 12px", fontFamily:"var(--font-mono)" }}>{page} / {pages}</span>
                    <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Próximo</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
