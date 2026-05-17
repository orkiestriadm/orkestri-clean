"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type Config = {
  logsPath: string; logsRetencaoHoras: string;
  backupPath: string; backupFullCron: string; backupIncrementalCron: string;
  backupFullAtivo: boolean; backupIncrementalAtivo: boolean;
  ultimoBackupFull?: string; ultimoBackupIncremental?: string; ultimaLimpezaLogs?: string;
};
type Backups = { full: string[]; incremental: string[] };

function fmt(iso?: string) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("pt-BR");
}

function Spin() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>; }

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`badge ${ok?"badge-green":"badge-red"}`} style={{ fontSize:10 }}>{label}</span>
  );
}

export default function SistemaConfig() {
  const [config,  setConfig]  = useState<Config|null>(null);
  const [backups, setBackups] = useState<Backups|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null);
  const [runningFull, setRunningFull] = useState(false);
  const [runningInc,  setRunningInc]  = useState(false);
  const [cleaningLogs,setCleaningLogs]= useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([api.get("/sistema/config"), api.get("/sistema/backup/list")]);
      setConfig(cRes.data);
      setBackups(bRes.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.post("/sistema/config", config);
      setMsg({ text:"Configuracoes salvas com sucesso!", ok:true });
    } catch { setMsg({ text:"Erro ao salvar configuracoes.", ok:false }); }
    finally { setSaving(false); setTimeout(()=>setMsg(null), 3000); }
  };

  const runFull = async () => {
    setRunningFull(true);
    try {
      const { data } = await api.post("/sistema/backup/full");
      if (data.sucesso) setMsg({ text:`Backup full gerado: ${data.arquivo}`, ok:true });
      else setMsg({ text:"Erro: " + data.erro, ok:false });
      load();
    } catch { setMsg({ text:"Erro ao executar backup.", ok:false }); }
    finally { setRunningFull(false); setTimeout(()=>setMsg(null), 4000); }
  };

  const runInc = async () => {
    setRunningInc(true);
    try {
      const { data } = await api.post("/sistema/backup/incremental");
      if (data.sucesso) setMsg({ text:`Backup incremental gerado: ${data.arquivo}`, ok:true });
      else setMsg({ text:"Erro: " + data.erro, ok:false });
      load();
    } catch { setMsg({ text:"Erro ao executar backup.", ok:false }); }
    finally { setRunningInc(false); setTimeout(()=>setMsg(null), 4000); }
  };

  const cleanLogs = async () => {
    setCleaningLogs(true);
    try {
      const { data } = await api.post("/sistema/logs/limpar");
      setMsg({ text:`Limpeza concluida: ${data.removidos} registros removidos.`, ok:true });
      load();
    } catch { setMsg({ text:"Erro na limpeza.", ok:false }); }
    finally { setCleaningLogs(false); setTimeout(()=>setMsg(null), 3000); }
  };

  if (loading || !config) return (
    <div style={{ display:"flex", justifyContent:"center", padding:48 }}><Spin/></div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, maxWidth:680 }}>

      {/* Mensagem de feedback */}
      {msg && (
        <div style={{ padding:"10px 16px", borderRadius:8, background:msg.ok?"rgba(52,211,153,0.1)":"rgba(220,38,38,0.1)", border:`1px solid ${msg.ok?"rgba(52,211,153,0.3)":"rgba(220,38,38,0.3)"}`, color:msg.ok?"var(--accent-green)":"var(--accent-red)", fontSize:13 }}>
          {msg.text}
        </div>
      )}

      {/* â"€â"€ LOGS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="card" style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Configuracao de Logs</h3>
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Ultima limpeza: {fmt(config.ultimaLimpezaLogs)}</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round"/></svg>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>CAMINHO DOS LOGS</label>
            <input className="input-o" value={config.logsPath} onChange={e=>setConfig({...config,logsPath:e.target.value})} placeholder="/app/logs" />
            <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>Caminho dentro do container. Na maquina host: C:\orkestri-clean\logs</p>
          </div>

          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:8 }}>TEMPO DE RETENCAO DOS LOGS</label>
            <div style={{ display:"flex", gap:8 }}>
              {[
                { value:"24", label:"24 horas", desc:"Mais agressivo" },
                { value:"48", label:"48 horas", desc:"Recomendado" },
                { value:"120", label:"120 horas", desc:"5 dias" },
              ].map(opt => (
                <button key={opt.value} onClick={()=>setConfig({...config,logsRetencaoHoras:opt.value})}
                  style={{ flex:1, padding:"12px 8px", borderRadius:10, border:`2px solid ${config.logsRetencaoHoras===opt.value?"var(--accent-violet)":"var(--border-subtle)"}`, background:config.logsRetencaoHoras===opt.value?"var(--accent-violet-dim)":"var(--bg-hover)", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:config.logsRetencaoHoras===opt.value?"var(--accent-violet)":"var(--text-primary)" }}>{opt.label}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={cleanLogs} disabled={cleaningLogs}>
              {cleaningLogs ? <Spin/> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>}
              Limpar logs agora
            </button>
            <p style={{ fontSize:11, color:"var(--text-muted)", alignSelf:"center" }}>Remove logs lidos e arquivos antigos conforme retencao configurada</p>
          </div>
        </div>
      </div>

      {/* â"€â"€ BACKUP â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="card" style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
          <div>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Configuracao de Backup</h3>
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Backup full: {fmt(config.ultimoBackupFull)} | Incremental: {fmt(config.ultimoBackupIncremental)}</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>CAMINHO DO BACKUP</label>
            <input className="input-o" value={config.backupPath} onChange={e=>setConfig({...config,backupPath:e.target.value})} placeholder="/app/backup" />
            <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>Na maquina host: C:\orkestri-clean\backup | Subpastas: \full e \incremental</p>
          </div>

          {/* Backup Full */}
          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Backup Full</span>
                <StatusBadge ok={config.backupFullAtivo} label={config.backupFullAtivo?"Ativo":"Inativo"} />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <span style={{ fontSize:11, color:"var(--text-muted)" }}>{config.backupFullAtivo?"Desativar":"Ativar"}</span>
                <div onClick={()=>setConfig({...config,backupFullAtivo:!config.backupFullAtivo})}
                  style={{ width:36, height:20, borderRadius:10, background:config.backupFullAtivo?"var(--accent-green)":"var(--border-medium)", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", width:16, height:16, borderRadius:"50%", background:"white", top:2, left:config.backupFullAtivo?18:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </label>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>FREQUENCIA</label>
              <div style={{ display:"flex", gap:6 }}>
                {[{value:"daily",label:"Diario (24h)"},{value:"weekly",label:"Semanal (7d)"}].map(opt => (
                  <button key={opt.value} onClick={()=>setConfig({...config,backupFullCron:opt.value})}
                    style={{ flex:1, padding:"8px", borderRadius:8, border:`1.5px solid ${config.backupFullCron===opt.value?"var(--accent-green)":"var(--border-subtle)"}`, background:config.backupFullCron===opt.value?"rgba(52,211,153,0.08)":"transparent", cursor:"pointer", fontSize:12, color:config.backupFullCron===opt.value?"var(--accent-green)":"var(--text-secondary)", fontWeight:config.backupFullCron===opt.value?600:400, transition:"all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:8 }}>Copia completa do banco de dados. Armazenado em: backup/full/</p>
            <button className="btn btn-ghost" style={{ fontSize:12, marginTop:10 }} onClick={runFull} disabled={runningFull}>
              {runningFull ? <><Spin/> Executando...</> : "Executar backup full agora"}
            </button>
          </div>

          {/* Backup Incremental */}
          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Backup Incremental</span>
                <StatusBadge ok={config.backupIncrementalAtivo} label={config.backupIncrementalAtivo?"Ativo":"Inativo"} />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <span style={{ fontSize:11, color:"var(--text-muted)" }}>{config.backupIncrementalAtivo?"Desativar":"Ativar"}</span>
                <div onClick={()=>setConfig({...config,backupIncrementalAtivo:!config.backupIncrementalAtivo})}
                  style={{ width:36, height:20, borderRadius:10, background:config.backupIncrementalAtivo?"var(--accent-cyan)":"var(--border-medium)", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", width:16, height:16, borderRadius:"50%", background:"white", top:2, left:config.backupIncrementalAtivo?18:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </label>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>FREQUENCIA</label>
              <div style={{ display:"flex", gap:6 }}>
                {[{value:"hourly",label:"Por hora"},{value:"6h",label:"A cada 6h"}].map(opt => (
                  <button key={opt.value} onClick={()=>setConfig({...config,backupIncrementalCron:opt.value})}
                    style={{ flex:1, padding:"8px", borderRadius:8, border:`1.5px solid ${config.backupIncrementalCron===opt.value?"var(--accent-cyan)":"var(--border-subtle)"}`, background:config.backupIncrementalCron===opt.value?"rgba(34,211,238,0.08)":"transparent", cursor:"pointer", fontSize:12, color:config.backupIncrementalCron===opt.value?"var(--accent-cyan)":"var(--text-secondary)", fontWeight:config.backupIncrementalCron===opt.value?600:400, transition:"all 0.15s" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:8 }}>Copia apenas os dados alterados na ultima janela de tempo. Armazenado em: backup/incremental/</p>
            <button className="btn btn-ghost" style={{ fontSize:12, marginTop:10 }} onClick={runInc} disabled={runningInc}>
              {runningInc ? <><Spin/> Executando...</> : "Executar backup incremental agora"}
            </button>
          </div>
        </div>
      </div>

      {/* â"€â"€ LISTA DE BACKUPS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {backups && (backups.full.length > 0 || backups.incremental.length > 0) && (
        <div className="card" style={{ padding:"20px 24px" }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:16 }}>Backups Disponiveis</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--accent-green)", letterSpacing:"0.08em", marginBottom:8 }}>FULL ({backups.full.length})</div>
              {backups.full.length === 0 ? <p style={{ fontSize:12, color:"var(--text-muted)" }}>Nenhum backup full</p> :
              backups.full.map(f => (
                <div key={f} style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-secondary)", padding:"4px 0", borderBottom:"1px solid var(--border-subtle)" }}>{f}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--accent-cyan)", letterSpacing:"0.08em", marginBottom:8 }}>INCREMENTAL ({backups.incremental.length})</div>
              {backups.incremental.length === 0 ? <p style={{ fontSize:12, color:"var(--text-muted)" }}>Nenhum backup incremental</p> :
              backups.incremental.map(f => (
                <div key={f} style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-secondary)", padding:"4px 0", borderBottom:"1px solid var(--border-subtle)" }}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Salvar */}
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button className="btn btn-violet" style={{ minWidth:160 }} onClick={save} disabled={saving}>
          {saving ? <Spin/> : "Salvar configuracoes"}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}