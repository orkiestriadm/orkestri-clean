"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
type Ativo = {
  id: string; codigo: string; nome: string; status: string; tipo?: string;
  responsavelId?: string; responsavel?: { id: string; nome: string };
  fornecedorId?: string; dataGarantiaFim?: string; categoriaId?: string;
  categoria?: { id: string; nome: string; cor: string };
};
type Contrato = { id: string; titulo: string; status: string; responsavelId?: string; vigenciaFim?: string; valor?: number };
type Usuario   = { id: string; nome: string; email: string };
type Fornecedor= { id: string; razaoSocial?: string; nomeFantasia?: string };
type NodeTipo  = "ativo" | "usuario" | "contrato" | "fornecedor";
type GraphNode = { id: string; tipo: NodeTipo; label: string; status?: string; relations: string[] };

// ── Constants ──────────────────────────────────────────────────────────────────
const SC: Record<string, string> = {
  ativo:"var(--accent-green)", inativo:"var(--text-muted)", em_manutencao:"var(--accent-amber)",
  descartado:"var(--accent-red)", vigente:"var(--accent-green)", vencendo:"var(--accent-amber)",
  vencido:"var(--accent-red)", suspenso:"var(--text-muted)",
};
const SL: Record<string, string> = { ativo:"Ativo", inativo:"Inativo", em_manutencao:"Manutenção", descartado:"Descartado", emprestado:"Emprestado" };
const NC: Record<NodeTipo, string> = { ativo:"var(--accent-violet)", usuario:"var(--accent-cyan)", contrato:"var(--accent-green)", fornecedor:"var(--accent-amber)" };
const NI: Record<NodeTipo, string> = { ativo:"⚙", usuario:"👤", contrato:"📄", fornecedor:"🏭" };

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const garantiaStatus = (fim?: string): "ok" | "vencendo" | "vencida" | null => {
  if (!fim) return null;
  const d = Math.ceil((new Date(fim).getTime() - Date.now()) / 86400000);
  return d < 0 ? "vencida" : d <= 30 ? "vencendo" : "ok";
};
const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s;

// ── SVG Relationship Graph ─────────────────────────────────────────────────────
function RelationshipGraph({ center, satellites, onNodeClick }: {
  center: Ativo; satellites: { node: GraphNode; angle: number }[]; onNodeClick: (n: GraphNode) => void;
}) {
  const W = 520, H = 360, cx = W / 2, cy = H / 2, R = 130;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
      <defs>
        <radialGradient id="gc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(109,40,217,0.3)" />
          <stop offset="100%" stopColor="rgba(109,40,217,0.06)" />
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="4 4"/>
      {satellites.map(({ node, angle }) => {
        const sx = cx + R * Math.cos(angle), sy = cy + R * Math.sin(angle);
        return <line key={node.id} x1={cx} y1={cy} x2={sx} y2={sy} stroke={NC[node.tipo]} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray={node.tipo==="contrato"?"6 3":undefined}/>;
      })}
      <circle cx={cx} cy={cy} r={36} fill="url(#gc)" stroke="var(--accent-violet)" strokeWidth="2" filter="url(#glow)"/>
      <text x={cx} y={cy-8} textAnchor="middle" fontSize="18">⚙</text>
      <text x={cx} y={cy+8} textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontWeight="600" fontFamily="var(--font-body)">{center.codigo}</text>
      <text x={cx} y={cy+22} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-body)">{truncate(center.nome, 14)}</text>
      {satellites.map(({ node, angle }) => {
        const sx = cx + R * Math.cos(angle), sy = cy + R * Math.sin(angle);
        const c = NC[node.tipo];
        return (
          <g key={node.id} onClick={() => onNodeClick(node)} style={{ cursor:"pointer" }}>
            <circle cx={sx} cy={sy} r={26} fill={c+"18"} stroke={c} strokeWidth="1.5"/>
            <text x={sx} y={sy-4} textAnchor="middle" fontSize="13">{NI[node.tipo]}</text>
            <text x={sx} y={sy+9} textAnchor="middle" fontSize="9" fill={c} fontWeight="600" fontFamily="var(--font-body)">{truncate(node.label, 12)}</text>
            <text x={sx} y={sy+20} textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">{node.tipo}</text>
          </g>
        );
      })}
      {satellites.length === 0 && <text x={cx} y={cy+65} textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-body)">Nenhuma relação encontrada</text>}
    </svg>
  );
}

// ── Impact Analysis Panel ──────────────────────────────────────────────────────
function ImpactPanel({ asset, contratos, ativos, fornecedores, users }: {
  asset: Ativo; contratos: Contrato[]; ativos: Ativo[]; fornecedores: Fornecedor[]; users: Usuario[];
}) {
  const { relContratos, fornecedor, peers, owner, gst } = useMemo(() => ({
    relContratos: contratos.filter(c => asset.responsavelId && c.responsavelId === asset.responsavelId),
    fornecedor:   asset.fornecedorId ? fornecedores.find(f => f.id === asset.fornecedorId) : null,
    peers:        asset.fornecedorId ? ativos.filter(a => a.id !== asset.id && a.fornecedorId === asset.fornecedorId) : [],
    owner:        asset.responsavelId ? users.find(u => u.id === asset.responsavelId) : null,
    gst:          garantiaStatus(asset.dataGarantiaFim),
  }), [asset, contratos, ativos, fornecedores, users]);

  const gstColor = gst === "vencida" ? "var(--accent-red)" : gst === "vencendo" ? "var(--accent-amber)" : "var(--accent-green)";
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="card-premium" style={{ padding:"10px 14px", marginBottom:8 }}>
      <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontWeight:600, letterSpacing:"0.08em", marginBottom:10 }}>IMPACTO ESTIMADO</div>

      <Row label="RESPONSÁVEL">
        {owner ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"var(--accent-cyan)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:700, flexShrink:0 }}>
              {owner.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>{owner.nome}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{owner.email}</div>
            </div>
          </div>
        ) : <div style={{ fontSize:12, color:"var(--text-muted)" }}>Sem responsável</div>}
      </Row>

      {gst && (
        <Row label="GARANTIA">
          <div style={{ display:"flex", alignItems:"center", gap:6, borderLeft:`3px solid ${gstColor}`, paddingLeft:8 }}>
            <span style={{ fontSize:12, fontWeight:600, color:gstColor }}>
              {gst === "vencida" ? "Vencida" : gst === "vencendo" ? "Vencendo (≤30d)" : "OK"}
            </span>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>{fmtDate(asset.dataGarantiaFim)}</span>
          </div>
        </Row>
      )}

      <Row label="CONTRATOS EM RISCO">
        {relContratos.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--text-muted)" }}>Nenhum contrato associado</div>
        ) : relContratos.map(c => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span style={{ fontSize:12 }}>📄</span>
            <span style={{ fontSize:12, color:"var(--text-primary)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.titulo}</span>
            <span style={{ fontSize:10, color:SC[c.status]||"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{c.status}</span>
          </div>
        ))}
      </Row>

      {fornecedor && (
        <Row label="ATIVOS NO MESMO FORNECEDOR">
          <div style={{ fontSize:11, color:"var(--accent-amber)", marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
            <span>🏭</span><span style={{ fontWeight:600 }}>{fornecedor.nomeFantasia || fornecedor.razaoSocial || "Fornecedor"}</span>
          </div>
          {peers.length === 0
            ? <div style={{ fontSize:11, color:"var(--text-muted)" }}>Único ativo deste fornecedor</div>
            : peers.slice(0, 4).map(a => (
              <div key={a.id} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:SC[a.status]||"var(--text-muted)", display:"inline-block", flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"var(--text-secondary)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.nome}</span>
                <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", flexShrink:0 }}>{a.codigo}</span>
              </div>
            ))}
          {peers.length > 4 && <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>+{peers.length - 4} mais</div>}
        </Row>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CMDBPage() {
  const [ativos,      setAtivos]      = useState<Ativo[]>([]);
  const [contratos,   setContratos]   = useState<Contrato[]>([]);
  const [users,       setUsers]       = useState<Usuario[]>([]);
  const [fornecedores,setFornecedores]= useState<Fornecedor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterStatus,setFilterStatus]= useState("");
  const [selected,    setSelected]    = useState<Ativo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aR, cR, uR] = await Promise.all([
        api.get("/ativos",   { params:{ limit:200 } }),
        api.get("/contratos",{ params:{ limit:200 } }),
        api.get("/users",    { params:{ ativos:true, limit:200 } }),
      ]);
      setAtivos(   aR.data?.items || aR.data || []);
      setContratos(Array.isArray(cR.data) ? cR.data : cR.data?.items || []);
      setUsers(    Array.isArray(uR.data) ? uR.data : uR.data?.users || uR.data?.data || []);
      try {
        const fR = await api.get("/suppliers", { params:{ limit:200 } });
        setFornecedores(Array.isArray(fR.data) ? fR.data : fR.data?.items || []);
      } catch {
        try {
          const fR = await api.get("/cadastros/fornecedores", { params:{ limit:200 } });
          setFornecedores(Array.isArray(fR.data) ? fR.data : fR.data?.items || []);
        } catch { setFornecedores([]); }
      }
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const satellites = useMemo(() => {
    if (!selected) return [];
    const nodes: { node: GraphNode; angle: number }[] = [];
    if (selected.responsavelId) {
      const u = users.find(x => x.id === selected.responsavelId);
      if (u) nodes.push({ node:{ id:u.id, tipo:"usuario", label:u.nome, relations:[] }, angle:-Math.PI/2 });
    }
    const c = contratos.find(x => x.responsavelId === selected.responsavelId && selected.responsavelId);
    if (c) nodes.push({ node:{ id:c.id, tipo:"contrato", label:c.titulo, status:c.status, relations:[] }, angle:0 });
    if (selected.fornecedorId) {
      const f = fornecedores.find(x => x.id === selected.fornecedorId);
      if (f) nodes.push({ node:{ id:f.id, tipo:"fornecedor", label:f.nomeFantasia||f.razaoSocial||"Fornecedor", relations:[] }, angle:Math.PI/4 });
    }
    ativos.filter(a => a.id !== selected.id && a.responsavelId === selected.responsavelId && selected.responsavelId)
      .slice(0, 3).forEach((a, i) => nodes.push({ node:{ id:a.id, tipo:"ativo", label:a.nome, status:a.status, relations:[] }, angle:Math.PI+(i-1)*(Math.PI/5) }));
    return nodes;
  }, [selected, users, contratos, fornecedores, ativos]);

  const filtered = useMemo(() => {
    let l = ativos;
    if (search) { const q = search.toLowerCase(); l = l.filter(a => a.nome.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)); }
    if (filterStatus) l = l.filter(a => a.status === filterStatus);
    return l;
  }, [ativos, search, filterStatus]);

  const uniqueStatuses = useMemo(() => [...new Set(ativos.map(a => a.status))], [ativos]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <Topbar>
        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>CMDB — {ativos.length} ativos</span>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={load}>↻ Atualizar</button>
      </Topbar>

      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
        {/* ── Left panel ── */}
        <div style={{ width:360, flexShrink:0, borderRight:"1px solid var(--border-subtle)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"14px 16px 10px", borderBottom:"1px solid var(--border-subtle)", display:"flex", flexDirection:"column", gap:8 }}>
            <input className="input-o" placeholder="Buscar por nome ou código…" value={search} onChange={e=>setSearch(e.target.value)} style={{ fontSize:12 }}/>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px", background:!filterStatus?"var(--accent-violet-dim)":"", color:!filterStatus?"var(--accent-violet)":"" }} onClick={()=>setFilterStatus("")}>Todos</button>
              {uniqueStatuses.map(s => (
                <button key={s} className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px", background:filterStatus===s?(SC[s]||"var(--bg-hover)")+"20":"", color:filterStatus===s?SC[s]||"var(--text-primary)":"" }}
                  onClick={()=>setFilterStatus(filterStatus===s?"":s)}>
                  {SL[s]||s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {loading ? (
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:8 }}>
                {[...Array(6)].map((_,i)=><div key={i} className="card skeleton" style={{ height:58 }}/>)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>Nenhum ativo encontrado</div>
            ) : filtered.map(a => {
              const sel = selected?.id === a.id;
              const cc  = a.categoria?.cor || "var(--border-medium)";
              return (
                <div key={a.id} onClick={()=>setSelected(sel?null:a)}
                  style={{ padding:"10px 16px", cursor:"pointer", borderBottom:"1px solid var(--border-subtle)", background:sel?"var(--bg-active)":"transparent", borderLeft:sel?"3px solid var(--accent-violet)":"3px solid transparent", transition:"background 0.12s" }}
                  onMouseEnter={e=>{ if(!sel) (e.currentTarget as HTMLElement).style.background="var(--bg-hover)"; }}
                  onMouseLeave={e=>{ if(!sel) (e.currentTarget as HTMLElement).style.background="transparent"; }}
                >
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:SC[a.status]||"var(--text-muted)", display:"inline-block", flexShrink:0, marginTop:4 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                        <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", flexShrink:0 }}>{a.codigo}</span>
                        {a.categoria && <span style={{ fontSize:10, color:cc, background:cc+"18", border:`1px solid ${cc}30`, borderRadius:4, padding:"1px 5px" }}>{a.categoria.nome}</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, color:sel?"var(--accent-violet)":"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.nome}</div>
                      {a.responsavel && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{a.responsavel.nome}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right area ── */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
          {!selected ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, color:"var(--text-muted)", padding:40 }}>
              <svg width="60" height="60" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="var(--border-medium)" strokeWidth="1.5" strokeDasharray="4 4"/>
                <circle cx="32" cy="32" r="13" stroke="var(--accent-violet)" strokeWidth="1.5" opacity="0.4"/>
                <circle cx="32" cy="32" r="5" fill="var(--accent-violet)" opacity="0.6"/>
                {([[0,-28],[24,14],[-24,14]] as [number,number][]).map(([dx,dy],i)=><circle key={i} cx={32+dx} cy={32+dy} r="5" fill="var(--border-medium)"/>)}
              </svg>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:15, fontWeight:600, color:"var(--text-secondary)", fontFamily:"var(--font-display)" }}>Selecione um ativo</div>
                <div style={{ fontSize:12, marginTop:4 }}>Clique na lista para visualizar relações e análise de impacto</div>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-card)", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexShrink:0 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{selected.codigo}</span>
                    {selected.categoria && <span style={{ fontSize:10, color:selected.categoria.cor, background:selected.categoria.cor+"18", border:`1px solid ${selected.categoria.cor}30`, borderRadius:4, padding:"1px 6px" }}>{selected.categoria.nome}</span>}
                    <span style={{ fontSize:10, color:SC[selected.status]||"var(--text-muted)", background:(SC[selected.status]||"var(--text-muted)")+"15", borderRadius:4, padding:"1px 6px", fontFamily:"var(--font-mono)" }}>{SL[selected.status]||selected.status}</span>
                  </div>
                  <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", fontFamily:"var(--font-display)" }}>{selected.nome}</div>
                  {selected.responsavel && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Responsável: <span style={{ color:"var(--accent-cyan)", fontWeight:500 }}>{selected.responsavel.nome}</span></div>}
                  {selected.dataGarantiaFim && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, fontFamily:"var(--font-mono)" }}>Garantia até: {fmtDate(selected.dataGarantiaFim)}</div>}
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={()=>alert("Exportar — em breve")}>↓ Exportar</button>
                  <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={()=>setSelected(null)}>✕</button>
                </div>
              </div>

              {/* Graph + impact */}
              <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 280px", overflow:"hidden" }}>
                <div style={{ padding:"20px 24px", overflowY:"auto", borderRight:"1px solid var(--border-subtle)", display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontWeight:600, letterSpacing:"0.08em" }}>
                    MAPA DE RELAÇÕES — {satellites.length} conexão{satellites.length!==1?"ões":""}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {(["ativo","usuario","contrato","fornecedor"] as NodeTipo[]).map(t=>(
                      <div key={t} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--text-muted)" }}>
                        <span style={{ width:9, height:9, borderRadius:"50%", background:NC[t], display:"inline-block" }}/><span style={{ fontFamily:"var(--font-mono)", textTransform:"capitalize" }}>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card-premium" style={{ padding:"16px 8px", background:"var(--bg-primary)" }}>
                    <RelationshipGraph center={selected} satellites={satellites} onNodeClick={node=>{ if(node.tipo==="ativo"){ const a=ativos.find(x=>x.id===node.id); if(a) setSelected(a); } }}/>
                  </div>
                  {satellites.length > 0 && satellites.map(({ node }) => (
                    <div key={node.id} className="card-premium"
                      style={{ padding:"10px 14px", display:"flex", alignItems:"center", gap:10, cursor:node.tipo==="ativo"?"pointer":"default" }}
                      onClick={()=>{ if(node.tipo==="ativo"){ const a=ativos.find(x=>x.id===node.id); if(a) setSelected(a); } }}
                    >
                      <span style={{ width:28, height:28, borderRadius:"50%", background:NC[node.tipo]+"20", border:`1.5px solid ${NC[node.tipo]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{NI[node.tipo]}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{node.label}</div>
                        <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", textTransform:"uppercase" }}>{node.tipo}</div>
                      </div>
                      {node.status && <span style={{ fontSize:10, color:SC[node.status]||"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{node.status}</span>}
                      {node.tipo==="ativo" && <span style={{ fontSize:10, color:"var(--text-muted)" }}>→</span>}
                    </div>
                  ))}
                </div>
                <div style={{ padding:"20px 16px", overflowY:"auto" }}>
                  <ImpactPanel asset={selected} contratos={contratos} ativos={ativos} fornecedores={fornecedores} users={users}/>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
