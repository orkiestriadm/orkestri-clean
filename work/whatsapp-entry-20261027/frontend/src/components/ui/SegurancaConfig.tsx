"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

type Policy = {
  minLength: number; requireUpper: boolean; requireLower: boolean;
  requireNumber: boolean; requireSpecial: boolean;
  expiracaoDias: number; historicoSenhas: number;
};

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function Toggle({ value, onChange, color="var(--accent-violet)" }: { value:boolean; onChange:(v:boolean)=>void; color?:string }) {
  return (
    <div onClick={()=>onChange(!value)} style={{ width:40, height:22, borderRadius:11, background:value?color:"var(--border-medium)", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%", background:"white", top:2, left:value?20:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

// â"€â"€ Componente 2FA â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function TwoFactorSection() {
  const { user } = useAuthStore();
  const [ativo,       setAtivo]       = useState(false);
  const [step,        setStep]        = useState<"idle"|"setup"|"verify"|"backup"|"disable">("idle");
  const [qrCode,      setQrCode]      = useState("");
  const [secret,      setSecret]      = useState("");
  const [token,       setToken]       = useState("");
  const [senha,       setSenha]       = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    api.get("/auth/2fa/status").then(r => setAtivo(r.data.ativo)).catch(() => {});
  }, []);

  const startSetup = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("setup");
    } catch (e:any) { setError(e.response?.data?.message || "Erro ao configurar"); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    if (token.length !== 6) { setError("O codigo deve ter 6 digitos"); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/auth/2fa/verify", { token });
      setBackupCodes(data.backupCodes);
      setAtivo(true);
      setStep("backup");
    } catch { setError("Codigo invalido. Verifique o app e tente novamente."); }
    finally { setLoading(false); }
  };

  const disable = async () => {
    if (!senha) { setError("Informe sua senha para desativar"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/2fa/disable", { senha });
      setAtivo(false); setStep("idle"); setSenha("");
    } catch { setError("Senha incorreta"); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:ativo?"rgba(52,211,153,0.1)":"var(--bg-hover)", border:`1px solid ${ativo?"rgba(52,211,153,0.3)":"var(--border-subtle)"}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ativo?"var(--accent-green)":"var(--text-muted)"} strokeWidth="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Autenticacao de dois fatores (2FA)</div>
            <div style={{ fontSize:11, color:ativo?"var(--accent-green)":"var(--text-muted)", marginTop:2 }}>{ativo ? "Ativo  -  sua conta esta protegida" : "Inativo  -  adicione uma camada extra de seguranca"}</div>
          </div>
        </div>
        <span className={`badge ${ativo?"badge-green":"badge-red"}`} style={{ fontSize:11 }}>{ativo?"ATIVO":"INATIVO"}</span>
      </div>

      {/* Estado idle */}
      {step === "idle" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>
            O 2FA adiciona uma camada extra de seguranca. Apos ativar, voce precisara de um codigo do app autenticador (Google Authenticator, Authy) alem da senha para fazer login.
          </p>
          {!ativo ? (
            <button className="btn btn-violet" style={{ alignSelf:"flex-start" }} onClick={startSetup} disabled={loading}>
              {loading ? <Spin/> : "Ativar 2FA"}
            </button>
          ) : (
            <button className="btn btn-danger" style={{ alignSelf:"flex-start" }} onClick={()=>setStep("disable")}>
              Desativar 2FA
            </button>
          )}
        </div>
      )}

      {/* Setup: QR Code */}
      {step === "setup" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <p style={{ fontSize:13, color:"var(--text-secondary)" }}>
            Escaneie o QR Code abaixo com o app Google Authenticator ou Authy:
          </p>
          <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
            {qrCode && <img src={qrCode} alt="QR Code 2FA" style={{ width:160, height:160, borderRadius:10, border:"1px solid var(--border-subtle)", background:"white", padding:8 }} />}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:6 }}>OU INSIRA O CODIGO MANUALMENTE:</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--accent-violet)", background:"var(--bg-hover)", padding:"10px 14px", borderRadius:8, letterSpacing:"0.15em", wordBreak:"break-all" }}>{secret}</div>
              <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:8, lineHeight:1.5 }}>
                Apos escanear, insira o codigo de 6 digitos gerado pelo app para confirmar a ativacao.
              </p>
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>CODIGO DE VERIFICACAO</label>
            <div style={{ display:"flex", gap:8 }}>
              <input className="input-o" placeholder="000000" value={token} onChange={e=>setToken(e.target.value.replace(/\D/g,"").slice(0,6))} style={{ maxWidth:160, fontFamily:"var(--font-mono)", fontSize:18, letterSpacing:"0.2em", textAlign:"center" }} maxLength={6} autoFocus />
              <button className="btn btn-violet" onClick={verify} disabled={loading||token.length!==6}>{loading?<Spin/>:"Verificar e ativar"}</button>
              <button className="btn btn-ghost" onClick={()=>setStep("idle")}>Cancelar</button>
            </div>
          </div>
          {error && <p style={{ fontSize:12, color:"var(--accent-red)" }}>{error}</p>}
        </div>
      )}

      {/* Backup codes */}
      {step === "backup" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--accent-green)", marginBottom:4 }}>2FA ativado com sucesso!</div>
            <p style={{ fontSize:12, color:"var(--text-secondary)", lineHeight:1.5 }}>
              Guarde os codigos de backup abaixo em local seguro. Cada codigo pode ser usado uma vez caso perca acesso ao app autenticador.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {backupCodes.map((code, i) => (
              <div key={i} style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"var(--accent-violet)", background:"var(--bg-hover)", padding:"8px 14px", borderRadius:8, letterSpacing:"0.1em", textAlign:"center", border:"1px solid var(--border-subtle)" }}>{code}</div>
            ))}
          </div>
          <button className="btn btn-violet" style={{ alignSelf:"flex-start" }} onClick={()=>setStep("idle")}>Concluir</button>
        </div>
      )}

      {/* Desativar */}
      {step === "disable" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"12px 16px" }}>
            <p style={{ fontSize:13, color:"var(--accent-red)" }}>Ao desativar o 2FA, sua conta ficara menos protegida. Confirme sua senha para continuar.</p>
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>SUA SENHA ATUAL</label>
            <input className="input-o" type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Digite sua senha" autoFocus style={{ maxWidth:280 }} />
          </div>
          {error && <p style={{ fontSize:12, color:"var(--accent-red)" }}>{error}</p>}
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-ghost" onClick={()=>{ setStep("idle"); setSenha(""); setError(""); }}>Cancelar</button>
            <button className="btn btn-danger" onClick={disable} disabled={loading}>{loading?<Spin/>:"Confirmar desativacao"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// â"€â"€ Componente Politica de Senhas â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function PasswordPolicySection({ isMaster }: { isMaster: boolean }) {
  const [policy,  setPolicy]  = useState<Policy|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    api.get("/auth/password-policy").then(r => setPolicy(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      await api.post("/auth/password-policy", policy);
      setMsg({ text:"Politica salva com sucesso!", ok:true });
    } catch { setMsg({ text:"Erro ao salvar politica.", ok:false }); }
    finally { setSaving(false); setTimeout(()=>setMsg(null), 3000); }
  };

  const strength = (): { label:string; color:string; pct:number } => {
    if (!policy) return { label:"", color:"", pct:0 };
    let score = 0;
    if (policy.minLength >= 8)  score++;
    if (policy.minLength >= 12) score++;
    if (policy.requireUpper)    score++;
    if (policy.requireLower)    score++;
    if (policy.requireNumber)   score++;
    if (policy.requireSpecial)  score++;
    if (score <= 2) return { label:"Fraca", color:"var(--accent-red)", pct:score*16 };
    if (score <= 4) return { label:"Media", color:"var(--accent-amber)", pct:score*16 };
    return { label:"Forte", color:"var(--accent-green)", pct:Math.min(100, score*16) };
  };

  const str = strength();

  if (!policy) return <div style={{ padding:24, textAlign:"center" }}><Spin/></div>;

  return (
    <div className="card" style={{ padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Politica de Senhas</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{isMaster ? "Configuracao global aplicada a todos os usuarios" : "Requisitos para sua senha"}</div>
        </div>
      </div>

      {/* Indicador de forca */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Forca da politica atual</span>
          <span style={{ fontSize:12, fontWeight:600, color:str.color }}>{str.label}</span>
        </div>
        <div style={{ height:6, background:"var(--border-subtle)", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${str.pct}%`, background:str.color, borderRadius:3, transition:"width 0.5s" }} />
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Comprimento minimo */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <label style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>Comprimento minimo</label>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:16, fontWeight:700, color:"var(--accent-violet)" }}>{policy.minLength}</span>
          </div>
          <input type="range" min={4} max={24} value={policy.minLength} onChange={e=>setPolicy({...policy,minLength:Number(e.target.value)})} disabled={!isMaster}
            style={{ width:"100%", accentColor:"var(--accent-violet)" }} />
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
            <span>4 (minimo)</span><span>8 (recomendado)</span><span>12 (forte)</span><span>24 (maximo)</span>
          </div>
        </div>

        {/* Requisitos */}
        <div>
          <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10 }}>REQUISITOS OBRIGATORIOS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { key:"requireUpper",   label:"Letras maiusculas",       desc:"Ex: A, B, C" },
              { key:"requireLower",   label:"Letras minusculas",       desc:"Ex: a, b, c" },
              { key:"requireNumber",  label:"Numeros",                 desc:"Ex: 1, 2, 3" },
              { key:"requireSpecial", label:"Caracteres especiais",    desc:"Ex: @, #, !" },
            ].map(item => (
              <div key={item.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:8, background:"var(--bg-hover)", border:`1px solid ${(policy as any)[item.key]?"rgba(124,58,237,0.2)":"var(--border-subtle)"}` }}>
                <div>
                  <div style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>{item.label}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:1 }}>{item.desc}</div>
                </div>
                {isMaster ? (
                  <Toggle value={(policy as any)[item.key]} onChange={v=>setPolicy({...policy,[item.key]:v})} />
                ) : (
                  <span className={`badge ${(policy as any)[item.key]?"badge-violet":"badge-gray"}`} style={{ fontSize:10 }}>{(policy as any)[item.key]?"Obrigatorio":"Opcional"}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Configuracoes avancadas (master only) */}
        {isMaster && (
          <div>
            <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10 }}>CONFIGURACOES AVANCADAS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>EXPIRACAO DA SENHA (DIAS)</label>
                <select className="input-o" value={policy.expiracaoDias} onChange={e=>setPolicy({...policy,expiracaoDias:Number(e.target.value)})}>
                  <option value={0}>Sem expiracao</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={90}>90 dias</option>
                  <option value={180}>180 dias</option>
                </select>
                <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>0 = nunca expira</p>
              </div>
              <div>
                <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>HISTORICO DE SENHAS</label>
                <select className="input-o" value={policy.historicoSenhas} onChange={e=>setPolicy({...policy,historicoSenhas:Number(e.target.value)})}>
                  <option value={0}>Sem restricao</option>
                  <option value={3}>Ultimas 3 senhas</option>
                  <option value={5}>Ultimas 5 senhas</option>
                  <option value={10}>Ultimas 10 senhas</option>
                </select>
                <p style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>Impede reutilizacao de senhas recentes</p>
              </div>
            </div>
          </div>
        )}

        {/* Preview da politica */}
        <div style={{ background:"var(--bg-hover)", borderRadius:8, padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:6 }}>EXEMPLO DE SENHA VALIDA</div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent-violet)", letterSpacing:"0.1em" }}>
            {[
              policy.requireUpper   ? "A" : "",
              policy.requireLower   ? "b" : "",
              policy.requireNumber  ? "4" : "",
              policy.requireSpecial ? "@" : "",
            ].join("") + "x".repeat(Math.max(0, policy.minLength - 4))}
          </div>
          <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>
            Min. {policy.minLength} chars
            {policy.requireUpper ? " + maiuscula" : ""}
            {policy.requireLower ? " + minuscula" : ""}
            {policy.requireNumber ? " + numero" : ""}
            {policy.requireSpecial ? " + especial" : ""}
          </div>
        </div>

        {/* Feedback e botao salvar */}
        {msg && (
          <div style={{ padding:"10px 14px", borderRadius:8, background:msg.ok?"rgba(52,211,153,0.08)":"rgba(220,38,38,0.08)", border:`1px solid ${msg.ok?"rgba(52,211,153,0.25)":"rgba(220,38,38,0.25)"}`, color:msg.ok?"var(--accent-green)":"var(--accent-red)", fontSize:13 }}>{msg.text}</div>
        )}

        {isMaster && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button className="btn btn-violet" style={{ minWidth:140 }} onClick={save} disabled={saving}>{saving?<Spin/>:"Salvar politica"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// â"€â"€ Pagina de Seguranca â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function SegurancaConfig() {
  const { user } = useAuthStore();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:680 }}>
      <TwoFactorSection />
      <PasswordPolicySection isMaster={user?.isMaster || false} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}