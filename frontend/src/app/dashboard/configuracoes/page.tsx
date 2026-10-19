"use client";
import SegurancaConfig from "@/components/ui/SegurancaConfig";
import SistemaConfig from "@/components/ui/SistemaConfig";
import IntegracoesConfig from "@/components/ui/IntegracoesConfig";

import { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { sounds } from "@/lib/soundEngine";

type AlertCfg = { id: string; minutos: number; ativo: boolean; emoji: string; titulo: string; mensagem: string; };
type PwdReq    = { id: string; titulo: string; mensagem: string; lida: boolean; criadoEm: string; };
type NotifHist = { id: string; tipo: string; titulo: string; mensagem?: string; lida: boolean; criadoEm: string; };

const SOUND_ITEMS = [
  { key:"reminder60", label:"60 minutos antes", desc:"1 bip suave" },
  { key:"reminder15", label:"15 minutos antes", desc:"2 bips medios" },
  { key:"reminder5",  label:"5 minutos antes",  desc:"3 bips urgentes" },
  { key:"now",        label:"Na hora exata",     desc:"Sirene pulsante" },
];
const VARS = ["{evento}", "{horario}", "{url}"];
const TABS = [
  { key:"alertas",       label:"Alertas Visuais" },
  { key:"sons",          label:"Sons" },
  { key:"solicitacoes",  label:"Solicitacoes de Senha" },
  { key:"historico",     label:"Historico" },
  { key:"integracoes",   label:"Integrações" },
  { key:"sistema",       label:"Sistema" },
  { key:"seguranca",     label:"Seguranca" },
];

function Spin() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

export default function ConfiguracoesPage() {
  const { user } = useAuthStore();
  const [tab, setTab]         = useState("alertas");
  const [configs, setConfigs] = useState<AlertCfg[]>([]);
  const [requests, setReqs]   = useState<PwdReq[]>([]);
  const [history, setHist]    = useState<NotifHist[]>([]);
  const [volume, setVolume]   = useState(0.5);
  const [msg, setMsg]         = useState("");
  const [editId, setEditId]   = useState<string|null>(null);
  const [editD, setEditD]     = useState<Partial<AlertCfg>>({});
  const [saving, setSaving]   = useState(false);
  const [novoAlerta, setNovoAlerta] = useState<Partial<AlertCfg>|null>(null);

  const showMsg = (m: string, ms = 3000) => { setMsg(m); setTimeout(() => setMsg(""), ms); };

  useEffect(() => {
    if (!user?.isMaster) return;
    api.get("/alert-configs").then(r => setConfigs(r.data)).catch(() => {});
    api.get("/notifications/password-requests").then(r => setReqs(r.data)).catch(() => {});
    api.get("/notifications/history").then(r => setHist(r.data)).catch(() => {});
  }, [user]);

  const saveCfg = async (id: string, data: Partial<AlertCfg>) => {
    setSaving(true);
    try { await api.put("/alert-configs/" + id, data); setConfigs(p => p.map(c => c.id === id ? { ...c, ...data } : c)); setEditId(null); showMsg("Salvo!"); }
    catch { showMsg("Erro ao salvar"); } finally { setSaving(false); }
  };

  const carregarConfigs = async () => {
    try { const r = await api.get("/alert-configs"); setConfigs(r.data); showMsg("Atualizado"); } catch { showMsg("Erro ao atualizar"); }
  };

  const createCfg = async () => {
    if (!novoAlerta) return;
    const min = Number(novoAlerta.minutos);
    if (isNaN(min) || min < 0 || min > 1440) { showMsg("Informe os minutos (0 a 1440)"); return; }
    if (!novoAlerta.titulo?.trim() || !novoAlerta.mensagem?.trim()) { showMsg("Preencha título e mensagem"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/alert-configs", { minutos: min, titulo: novoAlerta.titulo.trim(), mensagem: novoAlerta.mensagem, emoji: (novoAlerta.emoji || "🔔").trim() });
      setConfigs(p => [...p, data].sort((a, b) => b.minutos - a.minutos));
      setNovoAlerta(null); showMsg("Lembrete criado!");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Erro ao criar"); } finally { setSaving(false); }
  };

  const deleteCfg = async (id: string) => {
    if (!confirm("Remover este lembrete? Ele deixa de ser enviado.")) return;
    try { await api.delete("/alert-configs/" + id); setConfigs(p => p.filter(c => c.id !== id)); showMsg("Lembrete removido"); }
    catch { showMsg("Erro ao remover"); }
  };

  const resolveReq = async (id: string) => {
    await api.post("/notifications/password-requests/" + id + "/resolve");
    setReqs(p => p.map(r => r.id === id ? { ...r, lida: true } : r));
    showMsg("Marcado como resolvido");
  };

  const testAlert = async () => {
    await api.post("/notifications/test-alert");
    sounds.notification(volume);
    showMsg("Alerta de teste criado e som tocado!");
  };

  if (!user?.isMaster) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div className="empty-state" style={{ marginTop:80 }}><p style={{ color:"var(--text-muted)" }}>Acesso restrito a masters</p></div>
    </div>
  );

  const pendentes = requests.filter(r => !r.lida).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        {msg && <span style={{ fontSize:12, color: msg.includes("Erro")||msg.includes("Falha") ? "var(--accent-red)" : "var(--accent-green)", fontFamily:"var(--font-mono)" }}>{msg}</span>}
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={testAlert}>Testar alerta</button>
      </Topbar>

      {/* Tabs sem emojis */}
      <div style={{ display:"flex", gap:0, padding:"0 24px", borderBottom:"1px solid var(--border-subtle)", overflowX:"auto", flexShrink:0 }}>
        {TABS.map(t => {
          const label = t.key === "solicitacoes" && pendentes > 0 ? `${t.label} (${pendentes})` : t.label;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:"12px 18px", background:"none", border:"none", borderBottom:tab===t.key?"2px solid var(--accent-violet)":"2px solid transparent", color:tab===t.key?"var(--accent-violet)":"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t.key?600:400, whiteSpace:"nowrap", marginBottom:-1, transition:"all 0.15s" }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:24 }}>

        {/* ALERTAS */}
        {tab === "alertas" && (
          <div style={{ maxWidth:640, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div>
                <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Lembretes de compromisso</h3>
                <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Enviados por WhatsApp antes de cada evento da Agenda. Use {"{evento}"}, {"{horario}"} e {"{url}"} nas mensagens.</p>
              </div>
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                <button className="btn btn-ghost" style={{ fontSize:12, display:"inline-flex", alignItems:"center", gap:6 }} onClick={carregarConfigs} title="Atualizar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                  Atualizar
                </button>
                <button className="btn btn-violet" style={{ fontSize:12, display:"inline-flex", alignItems:"center", gap:6 }} onClick={()=>setNovoAlerta(novoAlerta?null:{ minutos:undefined, emoji:"🔔", titulo:"", mensagem:"Seu evento começa em breve:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}" })}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Adicionar lembrete
                </button>
              </div>
            </div>

            {novoAlerta && (
              <div className="card" style={{ padding:"16px 20px", border:"1px dashed var(--accent-violet, #f97316)", borderRadius:12, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"70px 110px 1fr", gap:10 }}>
                  <div><label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>EMOJI</label><input className="input-o" value={novoAlerta.emoji||""} onChange={e=>setNovoAlerta(p=>({...p!,emoji:e.target.value}))} style={{ textAlign:"center", fontSize:18 }} /></div>
                  <div><label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>MINUTOS ANTES</label><input className="input-o" type="number" min={0} max={1440} placeholder="30" value={novoAlerta.minutos ?? ""} onChange={e=>setNovoAlerta(p=>({...p!,minutos:e.target.value===""?undefined:Number(e.target.value)}))} /></div>
                  <div><label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>TÍTULO</label><input className="input-o" placeholder="Lembrete — 30 minutos" value={novoAlerta.titulo||""} onChange={e=>setNovoAlerta(p=>({...p!,titulo:e.target.value}))} /></div>
                </div>
                <div>
                  <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>MENSAGEM WHATSAPP</label>
                  <textarea className="input-o" value={novoAlerta.mensagem||""} onChange={e=>setNovoAlerta(p=>({...p!,mensagem:e.target.value}))} style={{ minHeight:80, resize:"vertical", fontFamily:"var(--font-mono)", fontSize:12 }} />
                  <div style={{ display:"flex", gap:4, marginTop:4 }}>
                    {VARS.map(v=><button key={v} onClick={()=>setNovoAlerta(p=>({...p!,mensagem:(p!.mensagem||"")+v}))} style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:4, padding:"2px 7px", fontSize:10, color:"var(--accent-violet)", cursor:"pointer", fontFamily:"var(--font-mono)" }}>{v}</button>)}
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                  <button className="btn btn-ghost" onClick={()=>setNovoAlerta(null)}>Cancelar</button>
                  <button className="btn btn-violet" onClick={createCfg} disabled={saving}>{saving?<Spin/>:"Criar lembrete"}</button>
                </div>
              </div>
            )}

            {configs.map(cfg => {
              const isEdit = editId === cfg.id;
              const local = isEdit ? { ...cfg, ...editD } : cfg;
              const color = cfg.minutos <= 0 ? "var(--accent-red)" : cfg.minutos <= 5 ? "#f97316" : cfg.minutos <= 15 ? "var(--accent-amber)" : "var(--accent-violet)";
              const timeLabel = cfg.minutos === 0 ? "Na hora" : cfg.minutos < 60 ? `${cfg.minutos}min antes` : "1h antes";
              return (
                <div key={cfg.id} className="card" style={{ padding:"16px 20px", borderLeft:`3px solid ${color}`, opacity:cfg.ativo?1:0.55 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>{local.emoji}</span>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{local.titulo}</span>
                          <span className="badge" style={{ fontSize:10, background:color+"15", color, border:`1px solid ${color}30` }}>{timeLabel}</span>
                        </div>
                        {!isEdit && <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{local.mensagem.split("\n")[0]}</p>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className={`btn ${cfg.ativo?"btn-ghost":"btn-violet"}`} style={{ fontSize:11, padding:"4px 10px" }} onClick={() => saveCfg(cfg.id, { ativo:!cfg.ativo })}>{cfg.ativo?"Desativar":"Ativar"}</button>
                      <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => { if(isEdit){setEditId(null);setEditD({});}else{setEditId(cfg.id);setEditD({});} }}>{isEdit?"Cancelar":"Editar"}</button>
                      <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 8px", color:"var(--accent-red)" }} onClick={() => deleteCfg(cfg.id)} title="Excluir">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                      </button>
                    </div>
                  </div>
                  {isEdit && (
                    <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:12 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"70px 1fr", gap:10 }}>
                        <div><label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>EMOJI</label><input className="input-o" value={local.emoji} onChange={e=>setEditD(p=>({...p,emoji:e.target.value}))} style={{ textAlign:"center", fontSize:18 }} /></div>
                        <div><label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>TITULO</label><input className="input-o" value={local.titulo} onChange={e=>setEditD(p=>({...p,titulo:e.target.value}))} /></div>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>MENSAGEM WHATSAPP</label>
                        <textarea className="input-o" value={local.mensagem} onChange={e=>setEditD(p=>({...p,mensagem:e.target.value}))} style={{ minHeight:80, resize:"vertical", fontFamily:"var(--font-mono)", fontSize:12 }} />
                        <div style={{ display:"flex", gap:4, marginTop:4 }}>
                          {VARS.map(v=><button key={v} onClick={()=>setEditD(p=>({...p,mensagem:(p.mensagem||cfg.mensagem)+v}))} style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:4, padding:"2px 7px", fontSize:10, color:"var(--accent-violet)", cursor:"pointer", fontFamily:"var(--font-mono)" }}>{v}</button>)}
                        </div>
                      </div>
                      <div style={{ background:"rgba(34,211,238,0.05)", border:"1px solid rgba(34,211,238,0.15)", borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:"var(--accent-cyan)", marginBottom:4 }}>Previa:</div>
                        <div style={{ fontSize:11, color:"var(--text-secondary)", fontFamily:"var(--font-mono)", lineHeight:1.6, whiteSpace:"pre-line" }}>
                          {local.emoji} Orkestri{"\n"}{(local.mensagem||"").replace(/{evento}/g,"Reuniao").replace(/{horario}/g,"18:00").replace(/{url}/g,"http://orkestri")}
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                        <button className="btn btn-ghost" onClick={()=>{setEditId(null);setEditD({});}}>Cancelar</button>
                        <button className="btn btn-violet" onClick={()=>saveCfg(cfg.id,editD)} disabled={saving}>{saving?<Spin/>:"Salvar"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SONS */}
        {tab === "sons" && (
          <div style={{ maxWidth:480 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:20 }}>Sons gerados diretamente pelo navegador. Sem arquivos externos.</p>
            <div className="card" style={{ padding:"14px 18px", marginBottom:14 }}>
              <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:8 }}>VOLUME: {Math.round(volume*100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} style={{ width:"100%", accentColor:"var(--accent-violet)" }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {SOUND_ITEMS.map(s => (
                <div key={s.key} className="card" style={{ padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div><div style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>{s.label}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.desc}</div></div>
                  <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>(sounds as any)[s.key]?.(volume)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Testar
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-violet" style={{ width:"100%", marginTop:14 }} onClick={()=>sounds.test(volume)}>Testar sequencia completa</button>
          </div>
        )}

        {/* SOLICITACOES */}
        {tab === "solicitacoes" && (
          <div style={{ maxWidth:640 }}>
            <div style={{ marginBottom:16 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700 }}>Solicitacoes de redefinicao de senha</h3>
              <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{pendentes} pendente{pendentes !== 1?"s":""}</p>
            </div>
            {requests.length === 0 ? (
              <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Nenhuma solicitacao recebida</p></div>
            ) : (
              <div className="card">
                {requests.map((r,i) => (
                  <div key={r.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderBottom:i<requests.length-1?"1px solid var(--border-subtle)":"none", opacity:r.lida?0.5:1, transition:"background 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:r.lida?400:500, color:"var(--text-primary)" }}>{r.titulo}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{r.mensagem}</div>
                      <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:2 }}>{new Date(r.criadoEm).toLocaleString("pt-BR")}</div>
                    </div>
                    {r.lida ? <span className="badge badge-green" style={{ fontSize:10 }}>Resolvido</span> : (
                      <button className="btn btn-violet" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>resolveReq(r.id)}>Marcar resolvido</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORICO */}
        {tab === "seguranca" && <SegurancaConfig />}
          {tab === "integracoes" && <IntegracoesConfig />}
          {tab === "sistema" && <SistemaConfig />}
          {tab === "historico" && (
          <div style={{ maxWidth:680 }}>
            <div style={{ marginBottom:16 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700 }}>Historico de notificacoes</h3>
              <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Ultimas 50 notificacoes</p>
            </div>
            {history.length === 0 ? (
              <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Nenhuma notificacao no historico</p></div>
            ) : (
              <div className="card">
                {history.map((n,i) => {
                  const c = n.tipo.includes("agora") ? "var(--accent-red)" : n.tipo.includes("lembrete") ? "var(--accent-amber)" : n.tipo.includes("senha") ? "var(--accent-violet)" : "var(--accent-cyan)";
                  return (
                    <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:i<history.length-1?"1px solid var(--border-subtle)":"none", opacity:n.lida?0.55:1, transition:"background 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                    >
                      <div style={{ width:7, height:7, borderRadius:"50%", background:c, flexShrink:0, boxShadow:n.lida?"none":`0 0 5px ${c}` }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:n.lida?400:500, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.titulo}</div>
                        {n.mensagem && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{n.mensagem}</div>}
                      </div>
                      <div style={{ flexShrink:0, textAlign:"right" }}>
                        <span className="badge" style={{ fontSize:10, background:c+"15", color:c, border:`1px solid ${c}30` }}>{n.tipo}</span>
                        <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:3 }}>{new Date(n.criadoEm).toLocaleString("pt-BR")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}