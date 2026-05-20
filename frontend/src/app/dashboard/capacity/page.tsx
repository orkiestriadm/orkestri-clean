"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Summary = {
  period: { from: string; to: string; businessDays: number; label: string };
  org: {
    colaboradoresAtivos: number; nominal: number; realizado: number; planejado: number;
    utilRealizado: number; utilPlanejado: number; sobrecarregados: number; subutilizados: number;
  };
  top5Carregados: any[];
  top5Disponiveis: any[];
};

type HeatmapCell = { date: string; horas: number; util: number; biz: boolean };
type HeatmapRow = {
  collaborator: { id: string; userId: string; nome: string; cargo: string | null; setor: { id: string; nome: string; cor: string | null } | null };
  nominal: number; realizado: number; planejado: number;
  utilRealizado: number; utilPlanejado: number; cells: HeatmapCell[];
};
type Heatmap = { period: { from: string; to: string; businessDays: number; days: string[] }; rows: HeatmapRow[] };
type Setor = { id: string; nome: string; cor?: string };

// ── Helpers visuais ───────────────────────────────────────────────────────────
function utilColor(util: number) {
  if (util === 0)   return "var(--bg-hover)";
  if (util < 30)    return "rgba(96,165,250,0.18)";   // azul claro
  if (util < 70)    return "rgba(52,211,153,0.30)";   // verde
  if (util < 90)    return "rgba(251,191,36,0.45)";   // amarelo
  if (util <= 100)  return "rgba(251,146,60,0.55)";   // laranja
  return "rgba(239,68,68,0.65)";                       // vermelho (>100)
}
function utilLabel(util: number) {
  if (util === 0)  return "Sem dados";
  if (util < 30)   return "Baixa";
  if (util < 70)   return "Saudável";
  if (util < 90)   return "Alta";
  if (util <= 100) return "Crítica";
  return "Sobrealocado";
}

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

// ── Modal detalhe colaborador ────────────────────────────────────────────────
function CollabDetailModal({ collabId, from, to, onClose }: { collabId: string; from: string; to: string; onClose: ()=>void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/capacity/collaborator/${collabId}`, { params: { from, to } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collabId, from, to]);
  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:680 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700 }}>{loading?"Carregando...":data?.collaborator?.nome||"Detalhe de Capacidade"}</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spin/></div>
        ) : data ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[
                { label:"NOMINAL",    value:data.capacity.nominal,    sufix:"h", color:"var(--text-muted)" },
                { label:"REALIZADO",  value:data.capacity.realizado,  sufix:"h", color:"var(--accent-cyan)" },
                { label:"PLANEJADO",  value:data.capacity.planejado,  sufix:"h", color:"var(--accent-violet)" },
                { label:"UTIL.",      value:data.capacity.utilPlanejado, sufix:"%", color: data.capacity.utilPlanejado>90?"var(--accent-red)":"var(--accent-green)" },
              ].map(s=>(
                <div key={s.label} className="card" style={{ padding:12 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}{s.sufix}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:8 }}>CONSUMO DIÁRIO (HORAS APONTADAS)</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                {data.days.map((d:any)=>(
                  <div key={d.date} style={{
                    aspectRatio:"1/1", borderRadius:6, background:utilColor(d.util),
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    fontSize:10, color:"var(--text-secondary)", padding:2,
                  }} title={`${d.date}: ${d.horas}h (${d.util}%)`}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-muted)" }}>{d.date.slice(8)}</div>
                    <div style={{ fontWeight:600 }}>{d.horas>0 ? `${d.horas}h` : "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color:"var(--text-muted)", fontSize:13 }}>Sem dados</p>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CapacityPage() {
  const [summary,  setSummary]  = useState<Summary|null>(null);
  const [heatmap,  setHeatmap]  = useState<Heatmap|null>(null);
  const [setores,  setSetores]  = useState<Setor[]>([]);
  const [setorId,  setSetorId]  = useState<string>("");
  const [period,   setPeriod]   = useState<"mes"|"semana"|"custom">("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [view,     setView]     = useState<"heatmap"|"tabela">("heatmap");
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<{ id: string; from: string; to: string }|null>(null);

  const periodParams = useMemo(() => {
    if (period === "semana") {
      const now = new Date();
      const d = now.getDay();
      const diff = d === 0 ? -6 : 1 - d;
      const f = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      const t = new Date(f.getFullYear(), f.getMonth(), f.getDate() + 6);
      return { from: f.toISOString().slice(0,10), to: t.toISOString().slice(0,10) };
    }
    if (period === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    const now = new Date();
    const f = new Date(now.getFullYear(), now.getMonth(), 1);
    const t = new Date(now.getFullYear(), now.getMonth()+1, 0);
    return { from: f.toISOString().slice(0,10), to: t.toISOString().slice(0,10) };
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h, st] = await Promise.all([
        api.get("/capacity/summary", { params: { period: period === "semana" ? "semana" : "mes" } }),
        api.get("/capacity/heatmap", { params: { ...periodParams, ...(setorId ? { setorId } : {}) } }),
        api.get("/setores").catch(() => ({ data: [] })),
      ]);
      setSummary(s.data);
      setHeatmap(h.data);
      setSetores(st.data);
    } catch {}
    finally { setLoading(false); }
  }, [period, setorId, periodParams]);

  useEffect(() => { load(); }, [load]);

  const cards = summary ? [
    { label:"COLABORADORES ATIVOS", value:summary.org.colaboradoresAtivos, color:"var(--accent-violet)" },
    { label:"UTILIZAÇÃO MÉDIA",     value:`${summary.org.utilPlanejado}%`,  color: summary.org.utilPlanejado>90?"var(--accent-red)":summary.org.utilPlanejado>70?"#fbbf24":"var(--accent-green)" },
    { label:"SOBRECARREGADOS (>90%)",value:summary.org.sobrecarregados,   color:"var(--accent-red)" },
    { label:"SUBUTILIZADOS (<50%)",  value:summary.org.subutilizados,     color:"var(--accent-cyan)" },
  ] : [];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div style={{ flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:20 }}>

        {/* Filtros */}
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:4 }}>
            {(["semana","mes","custom"] as const).map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} className={`btn ${period===p?"btn-violet":"btn-ghost"}`} style={{ padding:"6px 14px", fontSize:12 }}>
                {p==="semana"?"Semana":p==="mes"?"Mês":"Período"}
              </button>
            ))}
          </div>
          {period==="custom" && (
            <>
              <input className="input-o" type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ maxWidth:160 }} />
              <span style={{ color:"var(--text-muted)", fontSize:12 }}>até</span>
              <input className="input-o" type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ maxWidth:160 }} />
            </>
          )}
          <select className="input-o" value={setorId} onChange={e=>setSetorId(e.target.value)} style={{ maxWidth:200 }}>
            <option value="">Todos os setores</option>
            {setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <div style={{ flex:1 }} />
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={()=>setView("heatmap")} className={`btn ${view==="heatmap"?"btn-violet":"btn-ghost"}`} style={{ padding:"6px 12px", fontSize:12 }}>Heatmap</button>
            <button onClick={()=>setView("tabela")} className={`btn ${view==="tabela"?"btn-violet":"btn-ghost"}`} style={{ padding:"6px 12px", fontSize:12 }}>Tabela</button>
          </div>
          <button onClick={load} className="btn-icon" title="Atualizar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Cards de overview */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {loading ? (
            <div style={{ gridColumn:"1 / -1", display:"flex", justifyContent:"center", padding:30 }}><Spin/></div>
          ) : cards.map(c => (
            <div key={c.label} className="card" style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:6 }}>{c.label}</div>
              <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:700, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {summary && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="card" style={{ padding:"14px 18px" }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10 }}>TOP 5 MAIS CARREGADOS</div>
              {summary.top5Carregados.length === 0 ? <p style={{ fontSize:12, color:"var(--text-muted)" }}>Sem dados</p> : summary.top5Carregados.map((c:any)=>(
                <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize:13 }}>{c.nome} <span style={{ color:"var(--text-muted)", fontSize:11 }}>{c.setor||""}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{c.realizado}h / {c.nominal}h</span>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"2px 8px", borderRadius:20, background:utilColor(c.utilP), color:"var(--text-primary)", fontWeight:600 }}>{c.utilP}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding:"14px 18px" }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10 }}>TOP 5 COM MAIS DISPONIBILIDADE</div>
              {summary.top5Disponiveis.length === 0 ? <p style={{ fontSize:12, color:"var(--text-muted)" }}>Sem dados</p> : summary.top5Disponiveis.map((c:any)=>(
                <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize:13 }}>{c.nome} <span style={{ color:"var(--text-muted)", fontSize:11 }}>{c.setor||""}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{c.realizado}h / {c.nominal}h</span>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"2px 8px", borderRadius:20, background:utilColor(c.utilP), color:"var(--text-primary)", fontWeight:600 }}>{c.utilP}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap ou Tabela */}
        {heatmap && view==="heatmap" && (
          <div className="card" style={{ padding:"16px 18px", overflowX:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em" }}>HEATMAP DE CONSUMO ({heatmap.period.businessDays} dias úteis)</div>
              <div style={{ display:"flex", gap:10, alignItems:"center", fontSize:10, color:"var(--text-muted)" }}>
                <span>Legenda:</span>
                {[0, 30, 70, 90, 100, 120].map((u,i,arr)=>(
                  <span key={u} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:12, height:12, borderRadius:3, background:utilColor(u) }} />
                    {i===0?"0%":i===arr.length-1?">100%":`${u}%`}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:`220px repeat(${heatmap.period.days.length}, minmax(28px, 1fr))`, gap:2, fontSize:10 }}>
              <div />
              {heatmap.period.days.map(d=>{
                const day = parseInt(d.slice(8));
                const dt = new Date(d+"T00:00:00");
                const wk = dt.getDay();
                return <div key={d} style={{ textAlign:"center", color:wk===0||wk===6?"var(--text-muted)":"var(--text-secondary)", fontFamily:"var(--font-mono)", fontSize:9, padding:"2px 0" }}>{day}</div>;
              })}
              {heatmap.rows.map(row=>(
                <>
                  <div key={row.collaborator.id+"-name"} onClick={()=>setModal({ id: row.collaborator.id, from: periodParams.from, to: periodParams.to })}
                    style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"6px 10px", cursor:"pointer", borderBottom:"1px solid var(--border-subtle)", transition:"background 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <span style={{ fontSize:12, fontWeight:500 }}>{row.collaborator.nome}</span>
                    <span style={{ fontSize:10, color:"var(--text-muted)" }}>
                      {row.realizado}h real / {row.planejado}h plan ({row.utilPlanejado}%)
                    </span>
                  </div>
                  {row.cells.map(c=>(
                    <div key={row.collaborator.id+c.date}
                      title={`${c.date}: ${c.horas}h (${c.util}%) — ${utilLabel(c.util)}`}
                      style={{
                        aspectRatio:"1/1", minHeight:24, borderRadius:3,
                        background: c.biz ? utilColor(c.util) : "transparent",
                        border: c.biz ? "none" : "1px dashed var(--border-subtle)",
                        cursor: c.biz ? "pointer" : "default",
                      }}
                      onClick={()=>c.biz && setModal({ id: row.collaborator.id, from: periodParams.from, to: periodParams.to })}
                    />
                  ))}
                </>
              ))}
            </div>
            {heatmap.rows.length===0 && (
              <div style={{ textAlign:"center", padding:40, color:"var(--text-muted)", fontSize:13 }}>Nenhum colaborador cadastrado{setorId ? " neste setor" : ""}.</div>
            )}
          </div>
        )}

        {heatmap && view==="tabela" && (
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr", padding:"12px 16px", borderBottom:"1px solid var(--border-subtle)", fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em" }}>
              <span>COLABORADOR</span><span>SETOR</span><span>NOMINAL</span><span>REALIZADO</span><span>PLANEJADO</span><span>UTILIZAÇÃO</span>
            </div>
            {heatmap.rows.map(r=>(
              <div key={r.collaborator.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr", padding:"10px 16px", borderBottom:"1px solid var(--border-subtle)", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}
                onClick={()=>setModal({ id: r.collaborator.id, from: periodParams.from, to: periodParams.to })}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
              >
                <div style={{ fontSize:13, fontWeight:500 }}>{r.collaborator.nome}<div style={{ fontSize:11, color:"var(--text-muted)" }}>{r.collaborator.cargo||"—"}</div></div>
                <span style={{ fontSize:12, color:"var(--text-muted)" }}>{r.collaborator.setor?.nome||"—"}</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12 }}>{r.nominal}h</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent-cyan)" }}>{r.realizado}h</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent-violet)" }}>{r.planejado}h</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"3px 10px", borderRadius:20, background:utilColor(r.utilPlanejado), color:"var(--text-primary)", fontWeight:600, justifySelf:"start" }}>{r.utilPlanejado}%</span>
              </div>
            ))}
          </div>
        )}

      </div>
      {modal && <CollabDetailModal collabId={modal.id} from={modal.from} to={modal.to} onClose={()=>setModal(null)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
