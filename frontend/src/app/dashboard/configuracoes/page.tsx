"use client";
import SegurancaConfig from "@/components/ui/SegurancaConfig";
import SistemaConfig from "@/components/ui/SistemaConfig";

import { useState, useEffect } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { sounds } from "@/lib/soundEngine";

type AlertCfg = { id: string; minutos: number; ativo: boolean; emoji: string; titulo: string; mensagem: string; };
type PwdReq    = { id: string; titulo: string; mensagem: string; lida: boolean; criadoEm: string; };
type NotifHist = { id: string; tipo: string; titulo: string; mensagem?: string; lida: boolean; criadoEm: string; };
type SlaRegra  = { id: string; nome: string; prioridade: string; categoria: string | null; prazoRespostaH: number; prazoResolucaoH: number; ativo: boolean; };

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
  { key:"whatsapp",      label:"WhatsApp" },
  { key:"solicitacoes",  label:"Solicitacoes de Senha" },
  { key:"historico",     label:"Historico" },
  { key:"sla",           label:"SLA" },
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
  const [waStatus, setWaSt]   = useState<any>(null);
  const [qrData, setQrData]   = useState<string|null>(null);
  const [connecting, setCon]  = useState(false);
  const [phone, setPhone]     = useState("");
  const [waOn, setWaOn]       = useState(false);
  const [msg, setMsg]         = useState("");
  const [editId, setEditId]   = useState<string|null>(null);
  const [editD, setEditD]     = useState<Partial<AlertCfg>>({});
  const [saving, setSaving]   = useState(false);

  // SLA state
  const [slaRegras, setSlaRegras]   = useState<SlaRegra[]>([]);
  const [slaEditId, setSlaEditId]   = useState<string|null>(null);
  const [slaEditD,  setSlaEditD]    = useState<Partial<SlaRegra>>({});
  const [slaNew,    setSlaNew]      = useState(false);
  const [slaNewD,   setSlaNewD]     = useState<Partial<SlaRegra>>({ prioridade:"media", prazoRespostaH:4, prazoResolucaoH:24 });
  const [slaMsg,    setSlaMsg]      = useState("");

  const showMsg = (m: string, ms = 3000) => { setMsg(m); setTimeout(() => setMsg(""), ms); };

  useEffect(() => {
    if (!user?.isMaster) return;
    api.get("/alert-configs").then(r => setConfigs(r.data)).catch(() => {});
    api.get("/notifications/password-requests").then(r => setReqs(r.data)).catch(() => {});
    api.get("/notifications/history").then(r => setHist(r.data)).catch(() => {});
    api.get("/notifications/whatsapp/status").then(r => setWaSt(r.data)).catch(() => {});
    api.get("/notifications/profile/whatsapp").then(r => { setPhone(r.data.whatsapp||""); setWaOn(r.data.whatsappAlertas||false); }).catch(() => {});
    api.get("/sla/regras").then(r => setSlaRegras(r.data)).catch(() => {});
  }, [user]);

  // Poll status WA
  useEffect(() => {
    if (tab !== "whatsapp") return;
    const iv = setInterval(() => {
      api.get("/notifications/whatsapp/status").then(r => {
        setWaSt(r.data);
        if (r.data.connected) setQrData(null);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(iv);
  }, [tab]);

  const saveCfg = async (id: string, data: Partial<AlertCfg>) => {
    setSaving(true);
    try { await api.put("/alert-configs/" + id, data); setConfigs(p => p.map(c => c.id === id ? { ...c, ...data } : c)); setEditId(null); showMsg("Salvo!"); }
    catch { showMsg("Erro ao salvar"); } finally { setSaving(false); }
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

  const testWA = async () => {
    showMsg("Enviando...");
    try {
      const { data } = await api.post("/notifications/test-whatsapp");
      showMsg(data.ok ? "Mensagem enviada com sucesso!" : "Falha: " + (data.message || "Verifique os logs"), 5000);
    } catch { showMsg("Erro na requisicao"); }
  };

  const connectWA = async () => {
    setCon(true); setQrData(null);
    try {
      await api.post("/notifications/whatsapp/connect");
      await new Promise(r => setTimeout(r, 3000));
      const { data } = await api.get("/notifications/whatsapp/qrcode");
      const b64 = data?.qrcode?.base64 || data?.base64;
      const code = data?.code;
      if (b64) setQrData("b64:" + b64.replace(/^data:image\/[a-z]+;base64,/, ""));
      else if (code) setQrData("txt:" + code);
      else showMsg("QR nao disponivel - tente novamente", 4000);
    } catch (e: any) { showMsg("Erro: " + e.message); }
    setCon(false);
  };

  const disconnectWA = async () => {
    await api.post("/notifications/whatsapp/disconnect");
    setWaSt({ connected: false, status: "disconnected" });
    setQrData(null);
  };

  const saveWA = async () => {
    await api.post("/notifications/profile/whatsapp", { whatsapp: phone, whatsappAlertas: waOn });
    showMsg("Configuracoes salvas!");
  };

  const slaShowMsg = (m: string) => { setSlaMsg(m); setTimeout(() => setSlaMsg(""), 3500); };

  const slaCreate = async () => {
    if (!slaNewD.nome?.trim() || !slaNewD.prioridade) return slaShowMsg("Preencha nome e prioridade");
    try {
      const { data } = await api.post("/sla/regras", {
        nome: slaNewD.nome.trim(), prioridade: slaNewD.prioridade,
        categoria: slaNewD.categoria || null,
        prazoRespostaH: Number(slaNewD.prazoRespostaH) || 4,
        prazoResolucaoH: Number(slaNewD.prazoResolucaoH) || 24,
      });
      setSlaRegras(p => [...p, data]); setSlaNew(false);
      setSlaNewD({ prioridade:"media", prazoRespostaH:4, prazoResolucaoH:24 });
      slaShowMsg("Regra criada!");
    } catch (e: any) { slaShowMsg(e?.response?.data?.message || "Erro ao criar"); }
  };

  const slaSave = async (id: string) => {
    try {
      const { data } = await api.put("/sla/regras/" + id, slaEditD);
      setSlaRegras(p => p.map(r => r.id === id ? { ...r, ...data } : r));
      setSlaEditId(null); slaShowMsg("Salvo!");
    } catch (e: any) { slaShowMsg(e?.response?.data?.message || "Erro ao salvar"); }
  };

  const slaDelete = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    try {
      await api.delete("/sla/regras/" + id);
      setSlaRegras(p => p.filter(r => r.id !== id)); slaShowMsg("Regra removida");
    } catch { slaShowMsg("Erro ao remover"); }
  };

  const slaRecalcular = async () => {
    if (!confirm("Recalcular SLA de todos os chamados abertos com base nas regras atuais?")) return;
    try {
      const { data } = await api.post("/sla/recalcular");
      slaShowMsg(data.message);
    } catch { slaShowMsg("Erro ao recalcular"); }
  };

  const renderQR = () => {
    if (!qrData) return null;
    const src = qrData.startsWith("b64:")
      ? "data:image/png;base64," + qrData.slice(4)
      : "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(qrData.slice(4));
    return <img src={src} alt="QR Code WhatsApp" style={{ width:220, height:220, borderRadius:8, border:"2px solid var(--border-medium)" }} />;
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
          <div style={{ maxWidth:600, display:"flex", flexDirection:"column", gap:14 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:4 }}>Personalize os textos de cada alerta. Use {"{evento}"}, {"{horario}"} e {"{url}"} nas mensagens.</p>
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

        {/* WHATSAPP */}
        {tab === "whatsapp" && (
          <div style={{ maxWidth:500 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:20 }}>Conecte um numero dedicado para enviar alertas automaticos.</p>

            <div className="card" style={{ padding:"16px 20px", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:waStatus?.connected?12:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:waStatus?.connected?"var(--accent-green)":"var(--accent-red)", boxShadow:"0 0 8px "+(waStatus?.connected?"var(--accent-green)":"var(--accent-red)") }} />
                  <span style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>{waStatus?.connected?"Conectado":"Desconectado"}</span>
                  {waStatus?.status && <span className="badge badge-gray" style={{ fontSize:10 }}>{waStatus.status}</span>}
                </div>
                {!waStatus?.connected && <button className="btn btn-violet" style={{ fontSize:12 }} onClick={connectWA} disabled={connecting}>{connecting?<><Spin/> Aguarde...</>:"Conectar"}</button>}
                {waStatus?.connected && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={disconnectWA}>Desconectar</button>}
              </div>
              {qrData && !waStatus?.connected && (
                <div style={{ textAlign:"center", paddingTop:12 }}>
                  <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10 }}>WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo:</p>
                  <div style={{ display:"inline-block", padding:10, background:"white", borderRadius:10, marginBottom:8 }}>{renderQR()}</div>
                  <p style={{ fontSize:11, color:"var(--accent-violet)", fontFamily:"var(--font-mono)" }}>Aguardando escaneamento...</p>
                </div>
              )}
              {waStatus?.connected && (
                <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"8px 12px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span style={{ fontSize:12, color:"var(--accent-green)" }}>Conectado! Alertas serao enviados automaticamente.</span>
                </div>
              )}
            </div>

            <div className="card" style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>MEU NUMERO (com DDD)</label>
                <input className="input-o" placeholder="Ex: 11987654321" value={phone} onChange={e=>setPhone(e.target.value)} />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <input type="checkbox" checked={waOn} onChange={e=>setWaOn(e.target.checked)} style={{ accentColor:"var(--accent-violet)", width:15, height:15 }} />
                <span style={{ fontSize:13, color:"var(--text-primary)" }}>Ativar alertas no meu WhatsApp</span>
              </label>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={testWA}>Enviar mensagem de teste</button>
                <button className="btn btn-violet" style={{ flex:1 }} onClick={saveWA}>Salvar</button>
              </div>
            </div>
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

        {/* SLA */}
        {tab === "sla" && (() => {
          const priColor: Record<string,string> = { baixa:"var(--accent-green)", media:"var(--accent-cyan)", alta:"var(--accent-amber)", critica:"var(--accent-red)" };
          const priLabel: Record<string,string> = { baixa:"Baixa", media:"Media", alta:"Alta", critica:"Critica" };
          return (
            <div style={{ maxWidth:720 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, margin:0 }}>Regras de SLA</h3>
                  <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>Prazos de resposta e resolucao por prioridade. Aplicados automaticamente em novos chamados.</p>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {slaMsg && <span style={{ fontSize:12, color: slaMsg.includes("Erro")||slaMsg.includes("Falha") ? "var(--accent-red)" : "var(--accent-green)" }}>{slaMsg}</span>}
                  <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={slaRecalcular}>Recalcular SLA</button>
                  <button className="btn btn-violet" style={{ fontSize:11 }} onClick={() => { setSlaNew(true); setSlaEditId(null); }}>Nova regra</button>
                </div>
              </div>

              {/* New rule form */}
              {slaNew && (
                <div className="card" style={{ padding:"16px 18px", marginBottom:14, borderLeft:"3px solid var(--accent-violet)" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--accent-violet)", marginBottom:12, fontFamily:"var(--font-mono)" }}>NOVA REGRA</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 80px 80px", gap:10, marginBottom:12 }}>
                    <div>
                      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>NOME</label>
                      <input className="input-o" placeholder="Ex: SLA Alta" value={slaNewD.nome||""} onChange={e=>setSlaNewD(p=>({...p,nome:e.target.value}))} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>PRIORIDADE</label>
                      <select className="input-o" value={slaNewD.prioridade||"media"} onChange={e=>setSlaNewD(p=>({...p,prioridade:e.target.value}))}>
                        {["baixa","media","alta","critica"].map(p=><option key={p} value={p}>{priLabel[p]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>CATEGORIA (opcional)</label>
                      <input className="input-o" placeholder="Vazio = todas" value={slaNewD.categoria||""} onChange={e=>setSlaNewD(p=>({...p,categoria:e.target.value||null}))} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>RESPOSTA h</label>
                      <input className="input-o" type="number" min={1} value={slaNewD.prazoRespostaH||4} onChange={e=>setSlaNewD(p=>({...p,prazoRespostaH:Number(e.target.value)}))} />
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>RESOLUCAO h</label>
                      <input className="input-o" type="number" min={1} value={slaNewD.prazoResolucaoH||24} onChange={e=>setSlaNewD(p=>({...p,prazoResolucaoH:Number(e.target.value)}))} />
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                    <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={() => setSlaNew(false)}>Cancelar</button>
                    <button className="btn btn-violet" style={{ fontSize:11 }} onClick={slaCreate}>Criar</button>
                  </div>
                </div>
              )}

              {/* Rules table */}
              {slaRegras.length === 0 ? (
                <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Nenhuma regra configurada</p></div>
              ) : (
                <div className="card" style={{ overflow:"hidden" }}>
                  {/* Header */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 100px 80px 80px 80px 80px", gap:8, padding:"10px 16px", borderBottom:"1px solid var(--border-subtle)", background:"var(--bg-hover)" }}>
                    {["NOME","PRIORIDADE","CATEGORIA","RESPOSTA","RESOLUCAO","STATUS","AÇÕES"].map(h=>(
                      <div key={h} style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", fontWeight:600 }}>{h}</div>
                    ))}
                  </div>
                  {slaRegras.map((r, i) => {
                    const isEdit = slaEditId === r.id;
                    const loc = isEdit ? { ...r, ...slaEditD } : r;
                    const col = priColor[r.prioridade] || "var(--text-muted)";
                    return (
                      <div key={r.id} style={{ borderBottom: i < slaRegras.length-1 ? "1px solid var(--border-subtle)" : "none" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 100px 80px 80px 80px 80px", gap:8, padding:"12px 16px", alignItems:"center", opacity:r.ativo?1:0.5 }}>
                          {isEdit ? (
                            <input className="input-o" style={{ fontSize:12, padding:"4px 8px" }} value={loc.nome} onChange={e=>setSlaEditD(p=>({...p,nome:e.target.value}))} />
                          ) : (
                            <span style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>{r.nome}</span>
                          )}
                          <span className="badge" style={{ fontSize:10, background:col+"15", color:col, border:`1px solid ${col}30`, width:"fit-content" }}>{priLabel[r.prioridade]||r.prioridade}</span>
                          <span style={{ fontSize:12, color:"var(--text-muted)" }}>{r.categoria || "—"}</span>
                          {isEdit ? (
                            <input className="input-o" type="number" min={1} style={{ fontSize:12, padding:"4px 8px" }} value={loc.prazoRespostaH} onChange={e=>setSlaEditD(p=>({...p,prazoRespostaH:Number(e.target.value)}))} />
                          ) : (
                            <span style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--accent-cyan)" }}>{r.prazoRespostaH}h</span>
                          )}
                          {isEdit ? (
                            <input className="input-o" type="number" min={1} style={{ fontSize:12, padding:"4px 8px" }} value={loc.prazoResolucaoH} onChange={e=>setSlaEditD(p=>({...p,prazoResolucaoH:Number(e.target.value)}))} />
                          ) : (
                            <span style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--accent-violet)" }}>{r.prazoResolucaoH}h</span>
                          )}
                          <button className={`btn ${r.ativo?"btn-ghost":"btn-violet"}`} style={{ fontSize:10, padding:"3px 8px" }} onClick={() => slaSave(r.id) /* will toggle via edit */||slaSave /* dummy */}>
                            {/* toggle via direct update */}
                            <span style={{ fontSize:10 }} onClick={async e => { e.stopPropagation(); try { const {data} = await api.put("/sla/regras/"+r.id,{ativo:!r.ativo}); setSlaRegras(p=>p.map(x=>x.id===r.id?{...x,...data}:x)); } catch{} }}>{r.ativo?"Ativo":"Inativo"}</span>
                          </button>
                          <div style={{ display:"flex", gap:4 }}>
                            {isEdit ? (
                              <>
                                <button className="btn btn-ghost" style={{ fontSize:10, padding:"3px 8px" }} onClick={()=>{setSlaEditId(null);setSlaEditD({});}}>✕</button>
                                <button className="btn btn-violet" style={{ fontSize:10, padding:"3px 8px" }} onClick={()=>slaSave(r.id)}>✓</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-ghost" style={{ fontSize:10, padding:"3px 8px" }} onClick={()=>{setSlaEditId(r.id);setSlaEditD({});setSlaNew(false);}}>Editar</button>
                                <button className="btn btn-ghost" style={{ fontSize:10, padding:"3px 8px", color:"var(--accent-red)" }} onClick={()=>slaDelete(r.id)}>Del</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop:16, padding:"12px 16px", background:"var(--bg-hover)", borderRadius:8, fontSize:12, color:"var(--text-muted)" }}>
                <strong style={{ color:"var(--text-secondary)" }}>Como funciona:</strong> ao abrir um chamado, o sistema busca a regra com prioridade + categoria correspondentes. Se nao houver regra especifica de categoria, usa a regra generica da prioridade. Os campos <em>sla_resposta_at</em> e <em>sla_resolucao_at</em> sao definidos automaticamente.
              </div>
            </div>
          );
        })()}

        {/* HISTORICO */}
        {tab === "seguranca" && <SegurancaConfig />}
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