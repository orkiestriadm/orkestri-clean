"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type WfRequest = {
  id: string; tipo: string; titulo: string; descricao: string | null;
  payload: any; valor: number | null; status: "PENDENTE"|"APROVADA"|"REJEITADA"|"CANCELADA";
  solicitante: { id: string; nome: string; email: string; avatar?: string | null };
  aprovadorAtual: { id: string; nome: string } | null;
  aprovadoPor: { id: string; nome: string } | null;
  rejeitadoPor: { id: string; nome: string } | null;
  aprovadoEm: string | null; rejeitadoEm: string | null; motivoRejeicao: string | null;
  _count?: { aprovacoes: number };
  aprovacoes?: { id: string; nivel: number; decisao: string; observacoes: string|null; criadoEm: string; aprovador: { id: string; nome: string } }[];
  criadoEm: string;
};

type Stats = { minhasPendentes: number; aguardandoMinhaAprovacao: number; aprovadas: number; rejeitadas: number };

const TIPOS: Record<string, { label: string; color: string; icon: string }> = {
  despesa:              { label: "Despesa",               color: "#fbbf24", icon: "$" },
  horas_extra:          { label: "Horas extra",           color: "#22d3ee", icon: "+" },
  alteracao_cadastral:  { label: "Alteração cadastral",   color: "#a78bfa", icon: "✎" },
  folga_compensatoria:  { label: "Folga compensatória",   color: "#34d399", icon: "↺" },
  compra:               { label: "Compra",                color: "#f472b6", icon: "🛒" },
  viagem:               { label: "Viagem",                color: "#60a5fa", icon: "✈" },
  outro:                { label: "Outro",                 color: "#94a3b8", icon: "?" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "#fbbf24", APROVADA: "#34d399", REJEITADA: "#f87171", CANCELADA: "#94a3b8",
};

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}
function Avatar({ nome, size=32 }: { nome:string; size?:number }) {
  const i = nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>{i}</div>;
}

function NovaSolicitacaoModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [f, setF] = useState({ tipo: "despesa", titulo: "", descricao: "", valor: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isMonetario = ["despesa","compra","viagem"].includes(f.tipo);
  const save = async () => {
    if (!f.titulo.trim()) { setErr("Título obrigatório"); return; }
    setLoading(true); setErr("");
    try {
      await api.post("/workflows/requests", {
        tipo: f.tipo,
        titulo: f.titulo.trim(),
        descricao: f.descricao || undefined,
        valor: isMonetario && f.valor ? parseFloat(f.valor) : undefined,
      });
      onSave(); onClose();
    } catch(e:any) { setErr(e?.response?.data?.message||"Erro ao criar"); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700 }}>Nova solicitação</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>TIPO DE SOLICITAÇÃO</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
              {Object.entries(TIPOS).map(([k,v])=>(
                <button key={k} type="button" onClick={()=>setF(p=>({...p,tipo:k}))}
                  style={{
                    padding:"10px 8px", borderRadius:8, border:"1px solid",
                    borderColor: f.tipo===k ? v.color : "var(--border-subtle)",
                    background: f.tipo===k ? v.color+"15" : "transparent",
                    color: f.tipo===k ? v.color : "var(--text-secondary)",
                    fontSize:11, fontWeight:f.tipo===k?600:400, cursor:"pointer", textAlign:"center",
                    transition:"all 0.15s",
                  }}>
                  <div style={{ fontSize:16, marginBottom:2 }}>{v.icon}</div>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>TÍTULO *</label>
            <input className="input-o" value={f.titulo} onChange={e=>setF(p=>({...p,titulo:e.target.value}))} placeholder="Ex: Reembolso almoço com cliente" />
          </div>
          {isMonetario && (
            <div>
              <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>VALOR (R$)</label>
              <input className="input-o" type="number" step="0.01" min="0" value={f.valor} onChange={e=>setF(p=>({...p,valor:e.target.value}))} placeholder="0.00" />
              {f.valor && parseFloat(f.valor) > 5000 && (
                <div style={{ fontSize:11, color:"var(--accent-cyan)", marginTop:4 }}>
                  ⓘ Valores acima de R$ 5.000 sobem 1 nível na hierarquia
                </div>
              )}
            </div>
          )}
          <div>
            <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>DESCRIÇÃO / JUSTIFICATIVA</label>
            <textarea className="input-o" rows={3} value={f.descricao} onChange={e=>setF(p=>({...p,descricao:e.target.value}))} placeholder="Detalhes da solicitação..." style={{ resize:"vertical" }} />
          </div>
          {err && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12 }}>{err}</div>}
          <div style={{ background:"rgba(34,211,238,0.06)", border:"1px solid rgba(34,211,238,0.2)", borderRadius:8, padding:"10px 14px", fontSize:11, color:"var(--text-secondary)" }}>
            A solicitação será enviada ao seu <strong>gestor direto</strong> (definido em Colaboradores). Você receberá notificação quando for analisada.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:"Enviar solicitação"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisaoModal({ request, decisao, onClose, onSave }: { request: WfRequest; decisao: "APROVAR"|"REJEITAR"; onClose:()=>void; onSave:()=>void }) {
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (decisao === "REJEITAR" && !motivo.trim()) { setErr("Motivo obrigatório"); return; }
    setLoading(true); setErr("");
    try {
      if (decisao === "APROVAR") await api.patch(`/workflows/requests/${request.id}/aprovar`, { observacoes });
      else                       await api.patch(`/workflows/requests/${request.id}/rejeitar`, { motivo, observacoes });
      onSave(); onClose();
    } catch(e:any) { setErr(e?.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };
  const danger = decisao === "REJEITAR";
  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:460 }}>
        <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, marginBottom:16 }}>{danger ? "Rejeitar solicitação" : "Aprovar solicitação"}</h3>
        <div style={{ background:"var(--bg-secondary)", borderRadius:8, padding:"12px 14px", marginBottom:14, fontSize:13 }}>
          <div style={{ color:"var(--text-secondary)", fontSize:12, marginBottom:2 }}>Solicitação de <strong>{request.solicitante.nome}</strong>:</div>
          <div style={{ fontWeight:600 }}>{request.titulo}</div>
          {request.valor != null && <div style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent-cyan)", marginTop:4 }}>R$ {request.valor.toFixed(2)}</div>}
        </div>
        {danger && (
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>MOTIVO DA REJEIÇÃO *</label>
            <textarea className="input-o" rows={2} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Por que está sendo rejeitada..." style={{ resize:"vertical" }} />
          </div>
        )}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>OBSERVAÇÕES (OPCIONAL)</label>
          <textarea className="input-o" rows={2} value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Comentários adicionais..." style={{ resize:"vertical" }} />
        </div>
        {err && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12, marginBottom:12 }}>{err}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className={`btn ${danger?"btn-danger":"btn-violet"}`} style={{ flex:2 }} onClick={submit} disabled={loading}>{loading?<Spin/>:danger?"Confirmar rejeição":"Aprovar"}</button>
        </div>
      </div>
    </div>
  );
}

function RequestDetailModal({ request, onClose }: { request: WfRequest; onClose:()=>void }) {
  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:600 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18, fontWeight:700, color: TIPOS[request.tipo]?.color }}>{TIPOS[request.tipo]?.icon}</span>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700 }}>{request.titulo}</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div className="card" style={{ padding:"10px 14px" }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:4 }}>SOLICITANTE</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Avatar nome={request.solicitante.nome} size={28} />
              <div style={{ fontSize:13, fontWeight:500 }}>{request.solicitante.nome}</div>
            </div>
          </div>
          <div className="card" style={{ padding:"10px 14px" }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:4 }}>STATUS</div>
            <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"3px 10px", borderRadius:20, background:STATUS_COLORS[request.status]+"18", color:STATUS_COLORS[request.status], border:`1px solid ${STATUS_COLORS[request.status]}40`, fontWeight:600 }}>{request.status}</span>
          </div>
          {request.valor != null && (
            <div className="card" style={{ padding:"10px 14px" }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:4 }}>VALOR</div>
              <div style={{ fontSize:18, fontWeight:700, color:"var(--accent-cyan)", fontFamily:"var(--font-mono)" }}>R$ {request.valor.toFixed(2)}</div>
            </div>
          )}
          {request.aprovadorAtual && (
            <div className="card" style={{ padding:"10px 14px" }}>
              <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:4 }}>AGUARDANDO APROVAÇÃO DE</div>
              <div style={{ fontSize:13, fontWeight:500 }}>{request.aprovadorAtual.nome}</div>
            </div>
          )}
        </div>
        {request.descricao && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:6 }}>DESCRIÇÃO</div>
            <div style={{ padding:"10px 14px", borderRadius:8, background:"var(--bg-secondary)", border:"1px solid var(--border-subtle)", fontSize:13 }}>{request.descricao}</div>
          </div>
        )}
        {request.motivoRejeicao && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)" }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--accent-red)", letterSpacing:"0.08em", marginBottom:4 }}>MOTIVO DA REJEIÇÃO</div>
            <div style={{ fontSize:13, color:"var(--text-primary)" }}>{request.motivoRejeicao}</div>
          </div>
        )}
        {request.aprovacoes && request.aprovacoes.length > 0 && (
          <div>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:8 }}>HISTÓRICO DE APROVAÇÕES</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {request.aprovacoes.map(a=>(
                <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px", borderRadius:8, background:"var(--bg-secondary)", border:"1px solid var(--border-subtle)" }}>
                  <div style={{ width:24, height:24, borderRadius:"50%", background:a.decisao==="APROVADO"?"rgba(52,211,153,0.15)":"rgba(220,38,38,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {a.decisao==="APROVADO" ?
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{a.aprovador.nome} <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>nível {a.nivel}</span></div>
                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>{new Date(a.criadoEm).toLocaleString("pt-BR")}</div>
                    {a.observacoes && <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:4, fontStyle:"italic" }}>"{a.observacoes}"</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AprovacoesPage() {
  const { user } = useAuthStore();
  // Default = "minhas" (foco do usuario comum). Aprovador (que tem coisa
  // aguardando ele) e Master usam as outras abas para acoes.
  const [tab, setTab] = useState<"minhas"|"aguardando"|"todas">("minhas");
  const canConfigure = !!user?.isMaster
    || (user?.permissions || []).some((p: string) => p === "*" || p === "aprovacoes:configurar");
  const [requests, setRequests] = useState<WfRequest[]>([]);
  const [stats, setStats] = useState<Stats|null>(null);
  const [loading, setLoading] = useState(true);
  const [modalNova, setModalNova] = useState(false);
  const [modalDecisao, setModalDecisao] = useState<{ request: WfRequest; decisao: "APROVAR"|"REJEITAR" }|null>(null);
  const [modalDetail, setModalDetail] = useState<WfRequest|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api.get("/workflows/requests/stats"),
        api.get("/workflows/requests", {
          params: tab === "minhas" ? { minhas: true } : tab === "aguardando" ? { aguardandoMinhaAprovacao: true } : {},
        }),
      ]);
      setStats(s.data);
      setRequests(list.data);
    } catch {} finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    try { const r = await api.get(`/workflows/requests/${id}`); setModalDetail(r.data); } catch {}
  };

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar solicitação?")) return;
    try { await api.patch(`/workflows/requests/${id}/cancelar`); load(); } catch {}
  };
  const remover = async (id: string) => {
    if (!confirm("Remover solicitação?")) return;
    try { await api.delete(`/workflows/requests/${id}`); load(); } catch {}
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        {canConfigure && (
          <a href="/dashboard/aprovacoes/configuracao" className="btn btn-ghost" style={{ fontSize:12 }} title="Definir quem aprova cada setor">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configurar aprovadores
          </a>
        )}
        <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>setModalNova(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Nova solicitação
        </button>
      </Topbar>
      <div style={{ flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:20 }}>
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {[
              { label:"MINHAS PENDENTES",           value:stats.minhasPendentes,          color:"#fbbf24" },
              { label:"AGUARDANDO MINHA APROVAÇÃO", value:stats.aguardandoMinhaAprovacao, color:"var(--accent-violet)" },
              { label:"APROVADAS",                   value:stats.aprovadas,                color:"var(--accent-green)" },
              { label:"REJEITADAS",                  value:stats.rejeitadas,               color:"var(--accent-red)" },
            ].map(s=>(
              <div key={s.label} className="card" style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", borderBottom:"1px solid var(--border-subtle)" }}>
          {[
            { key:"minhas",     label:"Minhas Solicitações",   count:stats?.minhasPendentes || 0 },
            { key:"aguardando", label:"Aprovações Pendentes",  count:stats?.aguardandoMinhaAprovacao || 0 },
            // Historico so faz sentido para Master/admin (filtra "todas" do tenant)
            ...(user?.isMaster ? [{ key:"todas", label:"Histórico", count:0 }] : []),
          ].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key as any)}
              style={{
                padding:"12px 18px", background:"none", border:"none", cursor:"pointer",
                borderBottom: tab===t.key?"2px solid var(--accent-violet)":"2px solid transparent",
                color: tab===t.key?"var(--accent-violet)":"var(--text-muted)",
                fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t.key?600:400, marginBottom:-1,
              }}>
              {t.label}{t.count > 0 && <span style={{ marginLeft:6, fontSize:10, fontFamily:"var(--font-mono)", background:"var(--bg-hover)", padding:"1px 6px", borderRadius:8 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="animate-up card" style={{ padding:0, overflow:"hidden" }}>
          {loading ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando...</span></div>
          ) : requests.length===0 ? (
            <div className="empty-state"><p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Nenhuma solicitação</p></div>
          ) : requests.map((r,i)=>{
            const t = TIPOS[r.tipo] || TIPOS.outro;
            const canAprovar = r.status==="PENDENTE" && (r.aprovadorAtual?.id === user?.id || user?.isMaster);
            const canCancelar = r.status==="PENDENTE" && r.solicitante.id === user?.id;
            const canRemover = ["PENDENTE","REJEITADA","CANCELADA"].includes(r.status) && (r.solicitante.id === user?.id || user?.isMaster);
            return (
              <div key={r.id} style={{ display:"grid", gridTemplateColumns:"auto 1fr auto auto", gap:14, padding:"14px 20px", borderBottom:i<requests.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", transition:"background 0.15s", cursor:"pointer" }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                onClick={()=>loadDetail(r.id)}
              >
                <div style={{ width:36, height:36, borderRadius:8, background:t.color+"15", border:`1px solid ${t.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:t.color, fontWeight:700 }}>{t.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{r.titulo}</span>
                    <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:t.color, padding:"1px 6px", borderRadius:8, background:t.color+"10" }}>{t.label}</span>
                    {r.valor != null && <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--accent-cyan)" }}>R$ {r.valor.toFixed(2)}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                    {r.solicitante.nome} • {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
                    {r.aprovadorAtual && r.status==="PENDENTE" && <> • aguardando <strong>{r.aprovadorAtual.nome}</strong></>}
                  </div>
                </div>
                <span style={{ fontSize:10, fontFamily:"var(--font-mono)", padding:"3px 10px", borderRadius:20, background:STATUS_COLORS[r.status]+"18", color:STATUS_COLORS[r.status], border:`1px solid ${STATUS_COLORS[r.status]}40`, fontWeight:600 }}>{r.status}</span>
                <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
                  {canAprovar && (
                    <>
                      <button className="btn-icon" title="Aprovar" style={{ color:"var(--accent-green)" }} onClick={()=>loadDetail(r.id).then(()=>setModalDecisao({ request:r, decisao:"APROVAR" }))}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="btn-icon" title="Rejeitar" style={{ color:"var(--accent-red)" }} onClick={()=>loadDetail(r.id).then(()=>setModalDecisao({ request:r, decisao:"REJEITAR" }))}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
                      </button>
                    </>
                  )}
                  {canCancelar && (
                    <button className="btn-icon" title="Cancelar" onClick={()=>cancelar(r.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    </button>
                  )}
                  {canRemover && (
                    <button className="btn-icon" title="Remover" style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }} onClick={()=>remover(r.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalNova && <NovaSolicitacaoModal onClose={()=>setModalNova(false)} onSave={load} />}
      {modalDetail && <RequestDetailModal request={modalDetail} onClose={()=>setModalDetail(null)} />}
      {modalDecisao && <DecisaoModal request={modalDecisao.request} decisao={modalDecisao.decisao} onClose={()=>setModalDecisao(null)} onSave={load} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
