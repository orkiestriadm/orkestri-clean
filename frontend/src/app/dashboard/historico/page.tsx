"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type AuditEntry = {
  id: string;
  userId?: string;
  modulo?: string;
  tabela: string;
  registroId: string;
  acao: string;
  descricao?: string;
  dados?: any;
  ip?: string;
  criadoEm: string;
  user?: { id: string; nome: string; email: string; avatar?: string };
};

type AuditStats = {
  total: number;
  hoje: number;
  byAcao: Record<string, number>;
  byModulo: Record<string, number>;
  topUsers: { userId: string; nome?: string; count: number }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ACAO_COLOR: Record<string, string> = {
  LOGIN: "#a78bfa", LOGOUT: "#94a3b8",
  CREATE: "#34d399", UPDATE: "#22d3ee",
  DELETE: "#f87171", APPROVE: "#fbbf24",
  BLOCK: "#f97316", UNBLOCK: "#34d399",
};

const ACAO_LABEL: Record<string, string> = {
  LOGIN: "Login", LOGOUT: "Logout",
  CREATE: "Criado", UPDATE: "Atualizado",
  DELETE: "Removido", APPROVE: "Aprovado",
  BLOCK: "Bloqueado", UNBLOCK: "Desbloqueado",
};

function acaoColor(acao: string) { return ACAO_COLOR[acao?.toUpperCase()] || "var(--text-muted)"; }
function acaoLabel(acao: string) { return ACAO_LABEL[acao?.toUpperCase()] || acao; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function groupByDay(items: AuditEntry[]): Map<string, AuditEntry[]> {
  const map = new Map<string, AuditEntry[]>();
  for (const item of items) {
    const day = fmtDate(item.criadoEm);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return map;
}

function exportCSV(items: AuditEntry[]) {
  const header = "Data,Usuário,Módulo,Tabela,Ação,Descrição,ID Registro";
  const rows = items.map(e =>
    [
      fmtDateTime(e.criadoEm),
      e.user?.nome || e.userId || "",
      e.modulo || "",
      e.tabela,
      e.acao,
      (e.descricao || "").replace(/,/g, ";"),
      e.registroId,
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Componentes base ──────────────────────────────────────────────────────────
function Spin() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function StatCard({ label, value, color, sub }: { label:string; value:number; color:string; sub?:string }) {
  return (
    <div className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
      <div>
        <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value.toLocaleString("pt-BR")}</div>
        {sub && <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize:11, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)", textTransform:"uppercase" }}>{label}</div>
    </div>
  );
}

// ── Timeline View ─────────────────────────────────────────────────────────────
function TimelineView({ items }: { items: AuditEntry[] }) {
  const groups = groupByDay(items);

  if (items.length === 0) {
    return <div className="empty-state card" style={{ padding:48 }}><p style={{ color:"var(--text-secondary)" }}>Nenhum registro encontrado</p></div>;
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {[...groups.entries()].map(([day, dayItems]) => (
        <div key={day}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, fontFamily:"var(--font-mono)", color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap" }}>{day}</div>
            <div style={{ flex:1, height:1, background:"var(--border-subtle)" }} />
            <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{dayItems.length} evento{dayItems.length!==1?"s":""}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {dayItems.map((e, i) => {
              const cor = acaoColor(e.acao);
              const isLast = i === dayItems.length - 1;
              return (
                <div key={e.id} style={{ display:"flex", gap:12, paddingBottom:isLast?0:4, position:"relative" }}>
                  {!isLast && <div style={{ position:"absolute", left:14, top:28, bottom:0, width:1, background:"var(--border-subtle)" }} />}
                  <div style={{ width:28, height:28, borderRadius:"50%", background:cor+"15", border:`1px solid ${cor}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, zIndex:1 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:cor }} />
                  </div>
                  <div className="card" style={{ flex:1, padding:"9px 14px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", flexShrink:0, width:38 }}>{fmtTime(e.criadoEm)}</div>
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", fontWeight:700, background:cor+"15", color:cor, border:`1px solid ${cor}30`, borderRadius:5, padding:"1px 7px", flexShrink:0 }}>{acaoLabel(e.acao)}</span>
                    {e.modulo && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", background:"var(--bg-hover)", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>{e.modulo}</span>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:12, color:"var(--text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>
                        {e.descricao || `${e.tabela} #${e.registroId.slice(0,8)}`}
                      </span>
                    </div>
                    {e.user && (
                      <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--accent-violet)" }}>
                          {e.user.nome.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>{e.user.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Table View ────────────────────────────────────────────────────────────────
function TableView({ items }: { items: AuditEntry[] }) {
  if (items.length === 0) {
    return <div className="empty-state card" style={{ padding:48 }}><p style={{ color:"var(--text-secondary)" }}>Nenhum registro encontrado</p></div>;
  }

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{ display:"grid", gridTemplateColumns:"140px 130px 80px 80px 1fr 120px", gap:0, padding:"8px 16px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-hover)" }}>
        {["DATA/HORA","USUARIO","MODULO","ACAO","DESCRICAO","REGISTRO"].map(h=>(
          <span key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", letterSpacing:".08em", color:"var(--text-muted)" }}>{h}</span>
        ))}
      </div>
      {items.map((e, i) => {
        const cor = acaoColor(e.acao);
        return (
          <div key={e.id} style={{ display:"grid", gridTemplateColumns:"140px 130px 80px 80px 1fr 120px", gap:0, padding:"9px 16px", borderBottom:i<items.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center" }}
            onMouseEnter={ev=>(ev.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
            onMouseLeave={ev=>(ev.currentTarget as HTMLElement).style.background="transparent"}
          >
            <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{fmtDateTime(e.criadoEm)}</span>
            <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
              {e.user ? (
                <>
                  <div style={{ width:18, height:18, borderRadius:"50%", background:"var(--accent-violet-dim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>
                    {e.user.nome.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize:11, color:"var(--text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.user.nome}</span>
                </>
              ) : <span style={{ fontSize:11, color:"var(--text-muted)" }}>sistema</span>}
            </div>
            <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{e.modulo || e.tabela}</span>
            <span style={{ fontSize:10, fontFamily:"var(--font-mono)", fontWeight:700, background:cor+"15", color:cor, border:`1px solid ${cor}30`, borderRadius:5, padding:"1px 7px", textAlign:"center", display:"inline-block" }}>{acaoLabel(e.acao)}</span>
            <span style={{ fontSize:11, color:"var(--text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>
              {e.descricao || `${e.tabela} #${e.registroId.slice(0,8)}`}
            </span>
            <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis" }}>
              {e.registroId.slice(0, 8)}…
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function HistoricoPage() {
  const { user } = useAuthStore();
  const canAccess = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("historico:ver");

  const [stats,    setStats]    = useState<AuditStats | null>(null);
  const [items,    setItems]    = useState<AuditEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<"timeline"|"tabela">("timeline");
  const [modulos,  setModulos]  = useState<string[]>([]);

  // Filtros
  const [q,          setQ]          = useState("");
  const [fModulo,    setFModulo]    = useState("");
  const [fAcao,      setFAcao]      = useState("");
  const [fFrom,      setFFrom]      = useState("");
  const [fTo,        setFTo]        = useState("");

  const LIMIT = 50;
  const ACOES = ["LOGIN","CREATE","UPDATE","DELETE","APPROVE","BLOCK","UNBLOCK"];

  const loadStats = useCallback(() => {
    api.get("/audit/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/audit/modulos").then(r => setModulos(r.data)).catch(() => {});
  }, []);

  const loadItems = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: any = { page: pg, limit: LIMIT };
      if (q)       params.q = q;
      if (fModulo) params.modulo = fModulo;
      if (fAcao)   params.acao = fAcao;
      if (fFrom)   params.from = fFrom;
      if (fTo)     params.to = fTo;
      const r = await api.get("/audit", { params });
      setItems(r.data.items || []);
      setTotal(r.data.total || 0);
      setPage(pg);
    } catch {} finally { setLoading(false); }
  }, [q, fModulo, fAcao, fFrom, fTo]);

  useEffect(() => { if (canAccess) { loadStats(); loadItems(1); } else { setLoading(false); } }, [canAccess]);

  const applyFilters = () => loadItems(1);
  const clearFilters = () => { setQ(""); setFModulo(""); setFAcao(""); setFFrom(""); setFTo(""); };

  if (!canAccess) return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="empty-state" style={{ marginTop:80 }}><p style={{ color:"var(--text-muted)" }}>Acesso restrito — permissão historico:ver necessária</p></div>
    </div>
  );

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = !!(q || fModulo || fAcao || fFrom || fTo);

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => exportCSV(items)} disabled={items.length===0}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        {/* Stats */}
        {stats && (
          <div className="animate-up" style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
              <StatCard label="Total 30d" value={stats.total} color="var(--accent-violet)" />
              <StatCard label="Hoje" value={stats.hoje} color="var(--accent-green)" />
              <StatCard label="Módulos ativos" value={Object.keys(stats.byModulo).length} color="var(--accent-cyan)" />
              <div className="card" style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Por ação (30d)</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {Object.entries(stats.byAcao).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([a,c])=>(
                    <span key={a} style={{ fontSize:10, fontFamily:"var(--font-mono)", background:acaoColor(a)+"15", color:acaoColor(a), border:`1px solid ${acaoColor(a)}30`, borderRadius:5, padding:"1px 7px" }}>{a} {c}</span>
                  ))}
                </div>
              </div>
            </div>
            {stats.topUsers?.length > 0 && (
              <div className="card" style={{ padding:"14px 16px" }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Usuários mais ativos (30d)</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {stats.topUsers.map((u) => (
                    <button
                      key={u.userId}
                      onClick={() => { setQ(u.nome || u.userId); applyFilters(); }}
                      style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 10px", borderRadius:8,
                        background:"var(--bg-hover)", border:"1px solid var(--border-subtle)",
                        cursor:"pointer", transition:"all 0.15s" }}
                    >
                      <div style={{ width:18, height:18, borderRadius:"50%", background:"var(--accent-violet-dim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>
                        {(u.nome || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize:11, color:"var(--text-secondary)" }}>{u.nome || "Usuário"}</span>
                      <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{u.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="card" style={{ padding:"14px 16px", display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:1, minWidth:180 }}>
            <label style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"block", marginBottom:4 }}>BUSCA</label>
            <input className="input-o" placeholder="Usuário, descrição, ID..." value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&applyFilters()} />
          </div>
          <div style={{ width:150 }}>
            <label style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"block", marginBottom:4 }}>MÓDULO</label>
            <select className="input-o" value={fModulo} onChange={e=>setFModulo(e.target.value)}>
              <option value="">Todos</option>
              {modulos.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ width:130 }}>
            <label style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"block", marginBottom:4 }}>AÇÃO</label>
            <select className="input-o" value={fAcao} onChange={e=>setFAcao(e.target.value)}>
              <option value="">Todas</option>
              {ACOES.map(a=><option key={a} value={a}>{acaoLabel(a)}</option>)}
            </select>
          </div>
          <div style={{ width:140 }}>
            <label style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"block", marginBottom:4 }}>DE</label>
            <input className="input-o" type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} />
          </div>
          <div style={{ width:140 }}>
            <label style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", display:"block", marginBottom:4 }}>ATÉ</label>
            <input className="input-o" type="date" value={fTo} onChange={e=>setFTo(e.target.value)} />
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button className="btn btn-violet" style={{ fontSize:12 }} onClick={applyFilters}>Filtrar</button>
            {hasFilters && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={clearFilters}>Limpar</button>}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:6 }}>
            {(["timeline","tabela"] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} className={`btn ${view===v?"btn-violet":"btn-ghost"}`} style={{ fontSize:12, padding:"6px 14px" }}>
                {v==="timeline"?"Timeline":"Tabela"}
              </button>
            ))}
          </div>
          <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
            {total.toLocaleString("pt-BR")} registro{total!==1?"s":""}
            {hasFilters && " (filtrado)"}
          </span>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:48, gap:12 }}>
            <Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando...</span>
          </div>
        ) : view==="timeline" ? (
          <TimelineView items={items} />
        ) : (
          <TableView items={items} />
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:8, paddingTop:8 }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page<=1} onClick={()=>loadItems(page-1)}>← Anterior</button>
            <span style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
              Página {page} de {totalPages}
            </span>
            <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page>=totalPages} onClick={()=>loadItems(page+1)}>Próxima →</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
